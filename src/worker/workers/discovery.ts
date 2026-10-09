import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { RunLogger } from "@/lib/logger";
import { normalizeJob, dedupeBatch, contentHash } from "@/lib/normalize";
import type { AutomationSettings } from "@/lib/settings-schema";
import { allAdapters } from "../sources/registry";

const WORKER = "JobDiscoveryWorker";

const DEFAULT_KEYWORDS = [
  "react", "next.js", "nextjs", "vue", "nuxt", "typescript", "javascript",
  "node", "wordpress", "php", "tailwind", "web developer", "web development",
  "frontend", "front-end", "full stack", "fullstack", "website",
];

export interface DiscoveryResult {
  discovered: number;
  saved: number;
  duplicates: number;
  sourceErrors: Record<string, string>;
}

export class JobDiscoveryWorker {
  constructor(
    private settings: AutomationSettings,
    private logger: RunLogger,
    private runId?: string,
  ) {}

  async run(): Promise<DiscoveryResult> {
    const result: DiscoveryResult = { discovered: 0, saved: 0, duplicates: 0, sourceErrors: {} };

    const sourceRows = await db.query.jobSources.findMany({
      where: eq(schema.jobSources.enabled, true),
    });
    const enabledKeys = new Map(sourceRows.map((s) => [s.key, s]));

    // Free-to-apply sources first so the free allowance is used before
    // anything that costs credits/Connects.
    const adapters = allAdapters()
      .filter((a) => enabledKeys.has(a.capabilities().key) && a.capabilities().discoverySupported)
      .sort((a, b) => {
        const costRank = (m: string) => (m === "free" ? 0 : 1);
        return costRank(a.capabilities().applicationCostModel) - costRank(b.capabilities().applicationCostModel);
      });

    if (adapters.length === 0) {
      await this.logger.warn("No enabled sources support discovery", { worker: WORKER });
      return result;
    }

    const perSourceBudget = Math.max(5, Math.floor(this.settings.maxJobsPerRun / adapters.length));
    const collected = [];

    for (const adapter of adapters) {
      const caps = adapter.capabilities();
      const sourceRow = enabledKeys.get(caps.key)!;
      try {
        if (!adapter.isConfigured()) {
          await this.logger.warn(`Source ${caps.key} enabled but not configured — skipping`, { worker: WORKER });
          continue;
        }
        const jobs = await adapter.discover({
          maxJobs: perSourceBudget,
          keywords: DEFAULT_KEYWORDS,
          sourceConfig: sourceRow.config,
        });
        collected.push(...jobs.map(normalizeJob));
        await db
          .update(schema.jobSources)
          .set({ lastSyncAt: new Date(), lastError: null, updatedAt: new Date() })
          .where(eq(schema.jobSources.id, sourceRow.id));
        await this.logger.info(`Discovered ${jobs.length} jobs from ${caps.key}`, { worker: WORKER });
        // Simple politeness delay between sources
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.sourceErrors[caps.key] = message;
        await db
          .update(schema.jobSources)
          .set({ lastError: message, updatedAt: new Date() })
          .where(eq(schema.jobSources.id, sourceRow.id));
        await this.logger.error(`Source ${caps.key} failed: ${message}`, { worker: WORKER });
      }
    }

    result.discovered = collected.length;
    const unique = dedupeBatch(collected).slice(0, this.settings.maxJobsPerRun);

    // Cross-run dedupe: skip ids and content hashes we already have.
    const hashes = unique.map((j) => contentHash(j.title, j.description));
    const existingByHash = hashes.length
      ? await db.query.jobs.findMany({
          where: inArray(schema.jobs.contentHash, hashes),
          columns: { contentHash: true },
        })
      : [];
    const knownHashes = new Set(existingByHash.map((j) => j.contentHash));

    const sourceIdByKey = new Map(sourceRows.map((s) => [s.key, s.id]));

    for (const job of unique) {
      const hash = contentHash(job.title, job.description);
      if (knownHashes.has(hash)) {
        result.duplicates++;
        continue;
      }
      const sourceId = sourceIdByKey.get(job.sourceKey);
      if (!sourceId) continue;

      const inserted = await db
        .insert(schema.jobs)
        .values({
          sourceId,
          sourceKey: job.sourceKey,
          externalId: job.externalId,
          url: job.url,
          title: job.title,
          description: job.description,
          contentHash: hash,
          budgetMinUsd: job.budgetMinUsd != null ? String(job.budgetMinUsd) : null,
          budgetMaxUsd: job.budgetMaxUsd != null ? String(job.budgetMaxUsd) : null,
          budgetType: job.budgetType,
          currency: job.currency,
          skillsRequired: job.skillsRequired,
          category: job.category,
          clientCountry: job.clientCountry,
          clientVerified: job.clientVerified,
          clientRating: job.clientRating != null ? String(job.clientRating) : null,
          clientJobsPosted: job.clientJobsPosted,
          bidCount: job.bidCount,
          applicationCostUsd: String(job.applicationCostUsd ?? 0),
          connectsRequired: job.connectsRequired,
          postedAt: job.postedAt,
          raw: job.raw,
        })
        .onConflictDoNothing({ target: [schema.jobs.sourceKey, schema.jobs.externalId] })
        .returning({ id: schema.jobs.id });

      if (inserted.length > 0) {
        result.saved++;
        knownHashes.add(hash);
      } else {
        result.duplicates++;
      }
    }

    await this.logger.info(
      `Discovery complete: ${result.saved} new, ${result.duplicates} duplicates, ${Object.keys(result.sourceErrors).length} source errors`,
      { worker: WORKER },
    );
    return result;
  }
}
