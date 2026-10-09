import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { RunLogger } from "@/lib/logger";
import { getProfileContext, type ProfileContext } from "@/lib/profile";
import type { AutomationSettings } from "@/lib/settings-schema";
import { structuredCall } from "@/lib/ai/openai";
import { proposalSchema } from "@/lib/ai/schemas";
import { BudgetExceededError } from "@/lib/costs/budget";

const WORKER = "ProposalGenerationWorker";

export interface ProposalResult {
  generated: number;
  aiCostUsd: number;
  budgetExhausted: boolean;
}

export class ProposalGenerationWorker {
  constructor(
    private settings: AutomationSettings,
    private logger: RunLogger,
    private runId?: string,
  ) {}

  async run(): Promise<ProposalResult> {
    const result: ProposalResult = { generated: 0, aiCostUsd: 0, budgetExhausted: false };
    const profile = await getProfileContext();

    // Best qualified jobs first; limit is a cap, not a quota.
    const qualified = await db.query.jobs.findMany({
      where: eq(schema.jobs.status, "qualified"),
      limit: this.settings.maxProposalsPerRun * 2,
    });

    if (qualified.length === 0) {
      await this.logger.info("No qualified jobs awaiting proposals", { worker: WORKER });
      return result;
    }

    for (const job of qualified) {
      if (result.generated >= this.settings.maxProposalsPerRun) break;

      // One proposal per job, ever (unique index also enforces this).
      const existing = await db.query.proposals.findFirst({
        where: eq(schema.proposals.jobId, job.id),
      });
      if (existing) continue;

      const evaluation = await db.query.jobEvaluations.findFirst({
        where: eq(schema.jobEvaluations.jobId, job.id),
        orderBy: [desc(schema.jobEvaluations.createdAt)],
      });

      try {
        const draft = await this.generateProposal(job, profile, evaluation ?? undefined);
        result.aiCostUsd += draft.costUsd;

        const wordCount = draft.data.cover_letter.split(/\s+/).length;
        if (wordCount < 40) {
          await this.logger.warn(`Proposal for ${job.id} too short (${wordCount} words) — skipping`, { worker: WORKER });
          continue;
        }

        const [proposal] = await db
          .insert(schema.proposals)
          .values({
            jobId: job.id,
            evaluationId: evaluation?.id,
            status: "awaiting_approval",
            coverLetter: draft.data.cover_letter,
            bidAmountUsd: String(draft.data.bid_amount_usd),
            bidType: draft.data.bid_type,
            estimatedDays: draft.data.estimated_days,
            clarifyingQuestion: draft.data.clarifying_question,
            model: draft.model,
            inputTokens: draft.inputTokens,
            outputTokens: draft.outputTokens,
            costUsd: String(draft.costUsd),
          })
          .onConflictDoNothing({ target: [schema.proposals.jobId] })
          .returning({ id: schema.proposals.id });

        if (!proposal) continue;

        await db.insert(schema.proposalVersions).values({
          proposalId: proposal.id,
          version: 1,
          coverLetter: draft.data.cover_letter,
          bidAmountUsd: String(draft.data.bid_amount_usd),
          editedBy: "system",
        });

        await db
          .update(schema.jobs)
          .set({ status: "proposal_generated", updatedAt: new Date() })
          .where(eq(schema.jobs.id, job.id));

        result.generated++;
        await this.logger.info(`Proposal generated for "${job.title.slice(0, 60)}"`, { worker: WORKER });
      } catch (err) {
        if (err instanceof BudgetExceededError) {
          result.budgetExhausted = true;
          await this.logger.warn("OpenAI budget exhausted — stopping proposal generation", { worker: WORKER });
          break;
        }
        await this.logger.error(
          `Proposal generation failed for ${job.id}: ${err instanceof Error ? err.message : String(err)}`,
          { worker: WORKER },
        );
      }
    }

    return result;
  }

  private async generateProposal(
    job: {
      title: string;
      description: string;
      sourceKey: string;
      budgetMinUsd: string | null;
      budgetMaxUsd: string | null;
      budgetType: string | null;
      skillsRequired: string[];
    },
    profile: ProfileContext,
    evaluation?: { suggestedBidUsd: string | null; estimatedHours: string | null },
  ) {
    const portfolioText = profile.portfolio.length
      ? profile.portfolio
          .map((p) => `- ${p.title} (${p.technologies.join(", ")})${p.url ? ` — ${p.url}` : ""}`)
          .join("\n")
      : "(no portfolio entries configured — do NOT invent any past projects)";

    const system = `You write freelance proposals for ${profile.businessName} (${profile.website}), a web development business run by a solo developer with ${profile.yearsOfExperience} years of professional experience.

VERIFIED FACTS — the ONLY claims you may make:
- Skills: ${profile.skills.map((s) => s.name).join(", ")}
- Deep experience with healthcare and pharmaceutical digital experiences
- Verified portfolio:
${portfolioText}

STYLE RULES:
- Natural, concise, professional but conversational
- Confident without exaggeration; not obviously AI-generated
- No buzzwords, no generic intros ("I hope this finds you well", "I am excited to"), no flattery
- Open with something specific to THIS project
- ${this.settings.proposalMinWords}-${this.settings.proposalMaxWords} words
- Explain a concrete, relevant implementation approach
- Give a realistic estimate when appropriate; NEVER promise impossible deadlines
- Ask at most one genuinely useful question
- NEVER invent employees, team size, certifications, testimonials, or past projects not listed above
- Reference ${profile.businessName} naturally where branding fits; it's one developer, so write as "I"
${profile.proposalSignature ? `- Sign off with: ${profile.proposalSignature}` : ""}`;

    const user = `PLATFORM: ${job.sourceKey}
PROJECT: ${job.title}
BUDGET: ${job.budgetMinUsd ?? "?"}-${job.budgetMaxUsd ?? "?"} USD (${job.budgetType ?? "unknown"})
SKILLS LISTED: ${job.skillsRequired.join(", ") || "none"}
${evaluation?.suggestedBidUsd ? `EVALUATOR'S SUGGESTED BID: $${evaluation.suggestedBidUsd}` : ""}
${evaluation?.estimatedHours ? `EVALUATOR'S HOURS ESTIMATE: ${evaluation.estimatedHours}h` : ""}

PROJECT DESCRIPTION:
${job.description.slice(0, 4000)}

Write the proposal and set a realistic bid (respect the client's stated budget range when reasonable).`;

    return structuredCall({
      model: this.settings.proposalModel,
      schema: proposalSchema,
      schemaName: "proposal_draft",
      system,
      user,
      maxOutputTokens: 900,
      purpose: "proposal",
      runId: this.runId,
    });
  }
}
