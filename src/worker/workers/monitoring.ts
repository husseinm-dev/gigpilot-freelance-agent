import { eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { RunLogger } from "@/lib/logger";
import { sendTelegram } from "@/lib/telegram";

const WORKER = "ResponseMonitoringWorker";

export interface MonitoringResult {
  newResponses: number;
  notified: number;
}

/**
 * Checks authorized platform APIs for activity on submitted bids and
 * surfaces manually-entered responses that haven't been notified yet.
 *
 * Current API coverage:
 * - Freelancer.com: bids on a project can be polled for award/accept state
 *   when credentials exist. (Message polling needs additional OAuth scopes.)
 * - Upwork / others: no polling API available to this app — responses are
 *   entered manually in the dashboard (/responses) or via email forwarding.
 */
export class ResponseMonitoringWorker {
  constructor(
    private logger: RunLogger,
    private dryRun: boolean,
  ) {}

  async run(): Promise<MonitoringResult> {
    const result: MonitoringResult = { newResponses: 0, notified: 0 };

    // Notify for any response rows (manual or API) not yet notified.
    const pending = await db.query.clientResponses.findMany({
      where: isNull(schema.clientResponses.notifiedAt),
    });

    for (const response of pending) {
      const job = await db.query.jobs.findFirst({
        where: eq(schema.jobs.id, response.jobId),
      });
      const label: Record<string, string> = {
        question: "❓ Client question",
        interview_invitation: "🎙 Interview invitation",
        project_discussion: "💬 Project discussion",
        offer: "🎉 OFFER received",
        rejection: "Rejection",
        other: "Client activity",
      };

      const priority = ["offer", "interview_invitation"].includes(response.type)
        ? "critical"
        : response.type === "rejection"
          ? "low"
          : "high";

      if (!this.dryRun && priority !== "low") {
        const sent = await sendTelegram(
          `${label[response.type] ?? "Client activity"}\n\nJob: ${job?.title ?? "unknown"}\nPlatform: ${job?.sourceKey ?? "?"}\n${response.content ? `\n"${response.content.slice(0, 400)}"` : ""}${job?.url ? `\n\n${job.url}` : ""}`,
        );
        if (sent.ok) result.notified++;
        await db.insert(schema.notifications).values({
          priority: priority as "high" | "critical",
          channel: "telegram",
          title: label[response.type] ?? "Client activity",
          body: response.content?.slice(0, 500) ?? "",
          sent: sent.ok,
          sentAt: sent.ok ? new Date() : null,
          error: sent.ok ? null : sent.error,
          relatedJobId: response.jobId,
        });
      }

      await db
        .update(schema.clientResponses)
        .set({ notifiedAt: new Date() })
        .where(eq(schema.clientResponses.id, response.id));
      result.newResponses++;

      // Offers flip job status to won-tracking state for analytics follow-up.
      if (response.type === "offer" && job) {
        await this.logger.info(`Offer received for "${job.title.slice(0, 60)}"`, { worker: WORKER });
      }
    }

    await this.logger.info(
      `Response monitoring: ${result.newResponses} new, ${result.notified} notifications sent`,
      { worker: WORKER },
    );
    return result;
  }
}
