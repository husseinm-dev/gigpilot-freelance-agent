import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { RunLogger } from "@/lib/logger";
import type { AutomationSettings } from "@/lib/settings-schema";
import { adapterByKey } from "../sources/registry";

const WORKER = "BidSubmissionWorker";

export interface SubmissionResult {
  submitted: number;
  queuedForApproval: number;
  readyForManual: number;
  errors: number;
}

/**
 * Three modes:
 * - disabled: nothing happens.
 * - approval_required (DEFAULT): proposals wait for explicit user approval.
 *   Approved proposals on platforms with tested programmatic submission get
 *   submitted; everything else becomes READY_FOR_MANUAL_SUBMISSION.
 * - autonomous: only platforms whose adapter reports submissionSupported,
 *   humanConfirmationRequired=false AND whose job_sources row is marked
 *   tested=true may be submitted unattended. Upwork never qualifies.
 */
export class BidSubmissionWorker {
  constructor(
    private settings: AutomationSettings,
    private logger: RunLogger,
    private dryRun: boolean,
    private runId?: string,
  ) {}

  async run(): Promise<SubmissionResult> {
    const result: SubmissionResult = { submitted: 0, queuedForApproval: 0, readyForManual: 0, errors: 0 };

    if (this.settings.submissionMode === "disabled") {
      await this.logger.info("Submission mode is DISABLED — skipping", { worker: WORKER });
      return result;
    }

    // Mark newly generated proposals as awaiting approval and count them.
    const awaiting = await db.query.proposals.findMany({
      where: eq(schema.proposals.status, "awaiting_approval"),
    });
    result.queuedForApproval = awaiting.length;

    for (const proposal of awaiting) {
      await db
        .update(schema.jobs)
        .set({ status: "awaiting_approval", updatedAt: new Date() })
        .where(and(eq(schema.jobs.id, proposal.jobId), eq(schema.jobs.status, "proposal_generated")));
    }

    // Process explicitly approved proposals.
    const approved = await db.query.proposals.findMany({
      where: eq(schema.proposals.status, "approved"),
      limit: this.settings.maxBidsPerRun * 2,
    });

    // Autonomous mode: also auto-approve nothing — autonomy only changes
    // whether an APPROVED proposal may be sent without a second confirmation.
    // In autonomous mode, proposals on fully-authorized platforms skip the
    // manual approval step.
    let autonomousCandidates: typeof approved = [];
    if (this.settings.submissionMode === "autonomous") {
      autonomousCandidates = await db.query.proposals.findMany({
        where: eq(schema.proposals.status, "awaiting_approval"),
        limit: this.settings.maxBidsPerRun,
      });
    }

    const queue = [...approved, ...autonomousCandidates];
    for (const proposal of queue) {
      if (result.submitted >= this.settings.maxBidsPerRun) break;
      if (!(await this.underDailyLimit())) {
        await this.logger.warn("Daily bid limit reached — stopping submissions", { worker: WORKER });
        break;
      }
      const outcome = await this.processProposal(proposal);
      if (outcome === "submitted") result.submitted++;
      else if (outcome === "manual") result.readyForManual++;
      else if (outcome === "error") result.errors++;
    }

    return result;
  }

  private async underDailyLimit(): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [{ count }] = await db
      .select({ count: dsql<number>`count(*)::int` })
      .from(schema.submissionAttempts)
      .where(
        and(
          eq(schema.submissionAttempts.status, "submitted"),
          gte(schema.submissionAttempts.startedAt, startOfDay),
        ),
      );
    return count < this.settings.maxBidsPerDay;
  }

  private async processProposal(proposal: {
    id: string;
    jobId: string;
    status: string;
    coverLetter: string;
    bidAmountUsd: string | null;
    estimatedDays: number | null;
  }): Promise<"submitted" | "manual" | "skipped" | "error"> {
    const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, proposal.jobId) });
    if (!job) return "skipped";

    const adapter = adapterByKey(job.sourceKey);
    const caps = adapter?.capabilities();
    const sourceRow = await db.query.jobSources.findFirst({
      where: eq(schema.jobSources.key, job.sourceKey),
    });

    const idempotencyKey = `${job.sourceKey}:${job.externalId}`;

    // Duplicate-bid prevention: unique idempotency key on submission_attempts.
    const existingAttempt = await db.query.submissionAttempts.findFirst({
      where: eq(schema.submissionAttempts.idempotencyKey, idempotencyKey),
    });
    if (existingAttempt && ["submitted", "in_progress"].includes(existingAttempt.status)) {
      await this.logger.warn(`Duplicate bid prevented for ${idempotencyKey}`, { worker: WORKER });
      return "skipped";
    }

    const canAutoSubmit =
      Boolean(adapter?.submitBid) &&
      caps?.submissionSupported === true &&
      caps.humanConfirmationRequired === false &&
      sourceRow?.tested === true;

    // Autonomous-mode proposals that are still awaiting_approval may only be
    // sent on fully-authorized platforms; everything else stays queued.
    if (proposal.status === "awaiting_approval" && !canAutoSubmit) return "skipped";

    // Required-field validation — never submit incomplete bids.
    if (!proposal.coverLetter?.trim() || proposal.bidAmountUsd == null) {
      await this.logger.error(`Proposal ${proposal.id} missing required fields`, { worker: WORKER });
      return "error";
    }

    if (!canAutoSubmit) {
      // Approved but platform can't submit programmatically → manual.
      await db
        .update(schema.proposals)
        .set({ status: "ready_for_manual_submission", updatedAt: new Date() })
        .where(eq(schema.proposals.id, proposal.id));
      await db
        .update(schema.jobs)
        .set({ status: "ready_for_manual_submission", updatedAt: new Date() })
        .where(eq(schema.jobs.id, job.id));
      await this.logger.info(
        `Proposal ${proposal.id} ready for manual submission on ${job.sourceKey}`,
        { worker: WORKER },
      );
      return "manual";
    }

    if (this.dryRun) {
      await this.logger.info(`[DRY RUN] Would submit bid for ${idempotencyKey}`, { worker: WORKER });
      return "skipped";
    }

    // Record the attempt first (unique key guards double submission).
    const inserted = await db
      .insert(schema.submissionAttempts)
      .values({
        proposalId: proposal.id,
        jobId: job.id,
        platform: job.sourceKey,
        mode: this.settings.submissionMode,
        idempotencyKey,
        status: "in_progress",
        attemptNumber: (existingAttempt?.attemptNumber ?? 0) + 1,
      })
      .onConflictDoNothing({ target: [schema.submissionAttempts.idempotencyKey] })
      .returning({ id: schema.submissionAttempts.id });

    let attemptId = inserted[0]?.id;
    if (!attemptId) {
      if (existingAttempt && existingAttempt.status === "failed") {
        await db
          .update(schema.submissionAttempts)
          .set({
            status: "in_progress",
            attemptNumber: existingAttempt.attemptNumber + 1,
            startedAt: new Date(),
          })
          .where(eq(schema.submissionAttempts.id, existingAttempt.id));
        attemptId = existingAttempt.id;
      } else {
        return "skipped";
      }
    }

    try {
      const submission = await adapter!.submitBid!({
        externalJobId: job.externalId,
        coverLetter: proposal.coverLetter,
        bidAmountUsd: Number(proposal.bidAmountUsd),
        estimatedDays: proposal.estimatedDays ?? undefined,
      });

      if (!submission.submitted) {
        throw new Error(submission.error ?? "Submission failed without details");
      }

      // Only mark SUBMITTED once the platform confirms.
      await db.insert(schema.submissionConfirmations).values({
        attemptId,
        externalConfirmationId: submission.externalConfirmationId,
        externalConfirmationUrl: submission.externalConfirmationUrl,
        raw: submission.raw,
      });
      await db
        .update(schema.submissionAttempts)
        .set({ status: "submitted", completedAt: new Date() })
        .where(eq(schema.submissionAttempts.id, attemptId));
      await db
        .update(schema.proposals)
        .set({ status: "submitted", updatedAt: new Date() })
        .where(eq(schema.proposals.id, proposal.id));
      await db
        .update(schema.jobs)
        .set({ status: "submitted", updatedAt: new Date() })
        .where(eq(schema.jobs.id, job.id));

      await this.logger.info(
        `Bid submitted on ${job.sourceKey} (confirmation ${submission.externalConfirmationId})`,
        { worker: WORKER },
      );
      return "submitted";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(schema.submissionAttempts)
        .set({ status: "failed", errorDetails: message, completedAt: new Date() })
        .where(eq(schema.submissionAttempts.id, attemptId));
      await this.logger.error(`Submission failed for ${idempotencyKey}: ${message}`, { worker: WORKER });
      return "error";
    }
  }
}
