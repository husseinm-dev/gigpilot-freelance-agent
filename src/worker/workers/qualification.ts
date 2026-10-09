import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { RunLogger } from "@/lib/logger";
import { getProfileContext, type ProfileContext } from "@/lib/profile";
import type { AutomationSettings } from "@/lib/settings-schema";
import { structuredCall } from "@/lib/ai/openai";
import { evaluationSchema } from "@/lib/ai/schemas";
import { BudgetExceededError } from "@/lib/costs/budget";
import { deterministicFilter } from "./deterministic-filter";

const WORKER = "JobQualificationWorker";

export interface QualificationResult {
  filtered: number;
  evaluated: number;
  qualified: number;
  aiCostUsd: number;
  budgetExhausted: boolean;
}

export class JobQualificationWorker {
  constructor(
    private settings: AutomationSettings,
    private logger: RunLogger,
    private runId?: string,
  ) {}

  async run(): Promise<QualificationResult> {
    const result: QualificationResult = {
      filtered: 0,
      evaluated: 0,
      qualified: 0,
      aiCostUsd: 0,
      budgetExhausted: false,
    };

    const profile = await getProfileContext();
    const candidates = await db.query.jobs.findMany({
      where: inArray(schema.jobs.status, ["discovered"]),
      orderBy: (jobs, { desc }) => [desc(jobs.discoveredAt)],
      limit: 200,
    });

    if (candidates.length === 0) {
      await this.logger.info("No new jobs to qualify", { worker: WORKER });
      return result;
    }

    // Phase 1: deterministic filtering (free, explainable)
    const promising: { job: typeof candidates[number]; score: number }[] = [];
    for (const job of candidates) {
      const det = deterministicFilter(
        {
          title: job.title,
          description: job.description,
          skillsRequired: job.skillsRequired,
          budgetMinUsd: job.budgetMinUsd != null ? Number(job.budgetMinUsd) : null,
          budgetMaxUsd: job.budgetMaxUsd != null ? Number(job.budgetMaxUsd) : null,
          budgetType: job.budgetType,
          clientVerified: job.clientVerified,
          clientRating: job.clientRating != null ? Number(job.clientRating) : null,
          bidCount: job.bidCount,
          applicationCostUsd: job.applicationCostUsd != null ? Number(job.applicationCostUsd) : null,
          postedAt: job.postedAt,
        },
        profile,
        this.settings,
      );

      await db.insert(schema.jobScores).values({
        jobId: job.id,
        deterministicScore: det.deterministicScore,
        techMatchScore: det.techMatchScore,
        budgetScore: det.budgetScore,
        recencyScore: det.recencyScore,
        clientScore: det.clientScore,
        passed: det.passed,
        rejectionReasons: det.rejectionReasons,
      });

      if (det.passed) {
        // Prioritize free applications when enabled
        let rank = det.deterministicScore;
        if (
          this.settings.preferFreeApplicationSources &&
          (job.applicationCostUsd == null || Number(job.applicationCostUsd) === 0)
        ) {
          rank += 10;
        }
        promising.push({ job, score: rank });
      } else {
        result.filtered++;
        await db
          .update(schema.jobs)
          .set({
            status: "filtered_out",
            statusReason: det.rejectionReasons.join("; ") || `Score ${det.deterministicScore} below threshold`,
            updatedAt: new Date(),
          })
          .where(eq(schema.jobs.id, job.id));
      }
    }

    promising.sort((a, b) => b.score - a.score);
    const toEvaluate = promising.slice(0, this.settings.maxEvaluationsPerRun);

    // Anything past the AI cap stays "discovered" for the next run.
    await this.logger.info(
      `Deterministic filter: ${promising.length} promising of ${candidates.length}; evaluating top ${toEvaluate.length}`,
      { worker: WORKER },
    );

    // Phase 2: AI evaluation
    for (const { job } of toEvaluate) {
      try {
        const evaluation = await this.evaluateJob(job, profile);
        result.evaluated++;
        result.aiCostUsd += evaluation.costUsd;

        const qualified =
          evaluation.data.score >= this.settings.minQualificationScore &&
          evaluation.data.recommendation === "pursue";

        await db.insert(schema.jobEvaluations).values({
          jobId: job.id,
          model: evaluation.model,
          score: evaluation.data.score,
          recommendation: evaluation.data.recommendation,
          reasons: evaluation.data.reasons,
          risks: evaluation.data.risks,
          estimatedHours: String(evaluation.data.estimated_hours),
          suggestedBidUsd: String(evaluation.data.suggested_bid_usd),
          confidence: evaluation.data.confidence,
          rawResponse: evaluation.data as unknown as Record<string, unknown>,
          inputTokens: evaluation.inputTokens,
          outputTokens: evaluation.outputTokens,
          costUsd: String(evaluation.costUsd),
        });

        await db
          .update(schema.jobs)
          .set({
            status: qualified ? "qualified" : "disqualified",
            statusReason: qualified
              ? `AI score ${evaluation.data.score}`
              : `AI score ${evaluation.data.score} (${evaluation.data.recommendation})`,
            updatedAt: new Date(),
          })
          .where(eq(schema.jobs.id, job.id));

        if (qualified) result.qualified++;
      } catch (err) {
        if (err instanceof BudgetExceededError) {
          result.budgetExhausted = true;
          await this.logger.warn("OpenAI budget exhausted — stopping evaluations", { worker: WORKER });
          break;
        }
        await this.logger.error(
          `Evaluation failed for job ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
          { worker: WORKER },
        );
      }
    }

    return result;
  }

  private async evaluateJob(
    job: { id: string; title: string; description: string; skillsRequired: string[]; budgetMinUsd: string | null; budgetMaxUsd: string | null; budgetType: string | null; clientVerified: boolean | null; clientRating: string | null; clientJobsPosted: number | null; bidCount: number | null; sourceKey: string; applicationCostUsd: string | null; postedAt: Date | null },
    profile: ProfileContext,
  ) {
    const clientFacts: string[] = [];
    if (job.clientVerified != null) clientFacts.push(`Payment verified: ${job.clientVerified}`);
    if (job.clientRating != null) clientFacts.push(`Rating: ${job.clientRating}`);
    if (job.clientJobsPosted != null) clientFacts.push(`Jobs posted: ${job.clientJobsPosted}`);
    if (job.bidCount != null) clientFacts.push(`Current bids/applicants: ${job.bidCount}`);

    const system = `You evaluate freelance web-development opportunities for a solo developer (business: ${profile.businessName}) with ${profile.yearsOfExperience} years of experience. Skills: ${profile.skills.map((s) => s.name).join(", ")}. Domain strengths: healthcare and pharmaceutical digital experiences.
Judge ONLY from the data provided. If client data is absent, set client_credibility to "unknown" — never invent client information. Penalize vague scope, unrealistic deadlines, suspicious payment arrangements, and skill mismatches. Budget preferences: minimum $${this.settings.minBudgetUsd}, sweet spot $${this.settings.preferredBudgetMinUsd}-$${this.settings.preferredBudgetMaxUsd}. Favor small-to-medium scope the developer can deliver solo. Factor in the application cost if any.`;

    const user = `PLATFORM: ${job.sourceKey}
TITLE: ${job.title}
BUDGET: ${job.budgetMinUsd ?? "?"}-${job.budgetMaxUsd ?? "?"} USD (${job.budgetType ?? "unknown"})
SKILLS LISTED: ${job.skillsRequired.join(", ") || "none listed"}
APPLICATION COST: $${job.applicationCostUsd ?? "0"}
POSTED: ${job.postedAt?.toISOString() ?? "unknown"}
CLIENT DATA: ${clientFacts.join("; ") || "none available"}

DESCRIPTION:
${job.description.slice(0, 4000)}`;

    return structuredCall({
      model: this.settings.evaluationModel,
      schema: evaluationSchema,
      schemaName: "job_evaluation",
      system,
      user,
      maxOutputTokens: 700,
      purpose: "qualification",
      runId: this.runId,
    });
  }
}
