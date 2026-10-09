import { eq } from "drizzle-orm";
import { db, schema, sql } from "@/db/client";
import { RunLogger } from "@/lib/logger";
import { getSettings } from "@/lib/settings";
import { getBudgetSnapshot } from "@/lib/costs/budget";
import { sendTelegram, formatRunSummary } from "@/lib/telegram";
import { env } from "@/lib/env";
import { currentSlot, manualSlotKey } from "./schedule";
import { JobDiscoveryWorker } from "./workers/discovery";
import { JobQualificationWorker } from "./workers/qualification";
import { ProposalGenerationWorker } from "./workers/proposal";
import { BidSubmissionWorker } from "./workers/submission";
import { ResponseMonitoringWorker } from "./workers/monitoring";

// pg advisory lock id for run overlap prevention
const RUN_LOCK_ID = 834_112_007;

export interface HuntOptions {
  trigger: "scheduled" | "manual" | "dry_run";
  dryRun: boolean;
}

export async function hunt(opts: HuntOptions): Promise<void> {
  const logger = new RunLogger();
  const settings = await getSettings();

  // Emergency pause switch
  if (settings.paused && opts.trigger !== "dry_run") {
    console.log("Automation is PAUSED (settings.paused). Exiting.");
    return;
  }

  // Determine slot (idempotency for scheduled runs)
  let slotKey: string;
  let label: string;
  if (opts.trigger === "scheduled") {
    const slot = currentSlot();
    if (!slot) {
      console.log("Current time is outside both run windows (9AM / 6PM America/New_York). Exiting.");
      return;
    }
    slotKey = slot.slotKey;
    label = `${slot.label} run`;
  } else {
    slotKey = manualSlotKey();
    label = opts.dryRun ? "dry run" : "manual run";
  }

  // Overlap prevention: advisory lock held for the whole run.
  const [lock] = await sql`SELECT pg_try_advisory_lock(${RUN_LOCK_ID}) AS acquired`;
  if (!lock.acquired) {
    console.log("Another automation run is in progress. Exiting.");
    return;
  }

  let runId: string | undefined;
  try {
    // Slot idempotency: unique slot_key means a delayed duplicate trigger
    // cannot start a second run for the same slot.
    const inserted = await db
      .insert(schema.automationRuns)
      .values({
        slotKey,
        trigger: opts.trigger,
        dryRun: opts.dryRun,
        status: "running",
      })
      .onConflictDoNothing({ target: [schema.automationRuns.slotKey] })
      .returning({ id: schema.automationRuns.id });

    if (inserted.length === 0) {
      console.log(`Run for slot ${slotKey} already executed. Exiting (idempotent).`);
      return;
    }
    runId = inserted[0].id;
    logger.setRunId(runId);
    await logger.info(`Starting ${label} (slot: ${slotKey}, dryRun: ${opts.dryRun})`);

    // --- Pipeline ---
    const discovery = await new JobDiscoveryWorker(settings, logger, runId).run();
    const qualification = await new JobQualificationWorker(settings, logger, runId).run();
    const proposals = await new ProposalGenerationWorker(settings, logger, runId).run();
    const submission = await new BidSubmissionWorker(settings, logger, opts.dryRun, runId).run();
    const monitoring = await new ResponseMonitoringWorker(logger, opts.dryRun).run();

    const runCost = qualification.aiCostUsd + proposals.aiCostUsd;
    const openaiBudget = await getBudgetSnapshot("openai");

    await db
      .update(schema.automationRuns)
      .set({
        status: "completed",
        jobsDiscovered: discovery.saved,
        jobsQualified: qualification.qualified,
        proposalsGenerated: proposals.generated,
        bidsSubmitted: submission.submitted,
        awaitingApproval: submission.queuedForApproval,
        aiCostUsd: String(runCost),
        finishedAt: new Date(),
      })
      .where(eq(schema.automationRuns.id, runId));

    // Telegram run summary
    const summary = formatRunSummary({
      label,
      jobsDiscovered: discovery.saved,
      qualified: qualification.qualified,
      proposalsGenerated: proposals.generated,
      bidsSubmitted: submission.submitted,
      awaitingApproval: submission.queuedForApproval,
      readyForManual: submission.readyForManual,
      runCostUsd: runCost,
      monthlyCostUsd: openaiBudget.spentUsd,
      dashboardUrl: env().DASHBOARD_URL,
      dryRun: opts.dryRun,
    });
    if (!opts.dryRun) {
      const sent = await sendTelegram(summary);
      if (!sent.ok) await logger.warn(`Telegram summary failed: ${sent.error}`);
    } else {
      console.log("\n--- DRY RUN SUMMARY (not sent) ---\n" + summary + "\n");
    }

    if (qualification.budgetExhausted || proposals.budgetExhausted) {
      if (!opts.dryRun) {
        await sendTelegram(
          `⚠️ OpenAI monthly budget limit reached ($${openaiBudget.limitUsd}). AI calls are paused until next month or until you raise the budget in /settings/budgets.`,
        );
      }
    }

    await logger.info(
      `Run complete: ${discovery.saved} discovered, ${qualification.qualified} qualified, ${proposals.generated} proposals, ${submission.submitted} submitted, monitoring ${monitoring.newResponses} responses, cost $${runCost.toFixed(4)}`,
    );
  } catch (err) {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err);
    console.error("Run failed:", message);
    if (runId) {
      await db
        .update(schema.automationRuns)
        .set({ status: "failed", error: message.slice(0, 2000), finishedAt: new Date() })
        .where(eq(schema.automationRuns.id, runId));
    }
    if (!opts.dryRun) {
      await sendTelegram(
        `🚨 GigPilot automation run FAILED\n\n${message.slice(0, 500)}\n\nCheck GitHub Actions logs and /automation in the dashboard.`,
      ).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    await sql`SELECT pg_advisory_unlock(${RUN_LOCK_ID})`;
    await sql.end({ timeout: 5 });
  }
}
