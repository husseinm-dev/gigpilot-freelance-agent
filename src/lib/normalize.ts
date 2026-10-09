import { createHash } from "node:crypto";

export interface NormalizedJob {
  sourceKey: string;
  externalId: string;
  url?: string;
  title: string;
  description: string;
  budgetMinUsd?: number;
  budgetMaxUsd?: number;
  budgetType?: "fixed" | "hourly" | "unknown";
  currency?: string;
  skillsRequired: string[];
  category?: string;
  clientCountry?: string;
  clientVerified?: boolean;
  clientRating?: number;
  clientJobsPosted?: number;
  bidCount?: number;
  applicationCostUsd?: number;
  connectsRequired?: number;
  postedAt?: Date;
  raw?: Record<string, unknown>;
}

/** Strip HTML, collapse whitespace, trim. */
export function cleanText(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Content hash for cross-source duplicate detection. Normalizes the
 * title + first 1000 chars of the description so that the same job
 * posted on two boards hashes identically.
 */
export function contentHash(title: string, description: string): string {
  const normalized = (cleanText(title) + "|" + cleanText(description).slice(0, 1000))
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, "");
  return createHash("sha256").update(normalized).digest("hex");
}

export function normalizeJob(job: NormalizedJob): NormalizedJob {
  return {
    ...job,
    title: cleanText(job.title).slice(0, 500),
    description: cleanText(job.description).slice(0, 20000),
    skillsRequired: Array.from(
      new Set(job.skillsRequired.map((s) => s.trim().toLowerCase()).filter(Boolean)),
    ),
    currency: job.currency ?? "USD",
    budgetType: job.budgetType ?? "unknown",
  };
}

/** Deduplicate a batch in memory by (sourceKey, externalId) and content hash. */
export function dedupeBatch(jobsIn: NormalizedJob[]): NormalizedJob[] {
  const seenIds = new Set<string>();
  const seenHashes = new Set<string>();
  const out: NormalizedJob[] = [];
  for (const job of jobsIn) {
    const idKey = `${job.sourceKey}:${job.externalId}`;
    const hash = contentHash(job.title, job.description);
    if (seenIds.has(idKey) || seenHashes.has(hash)) continue;
    seenIds.add(idKey);
    seenHashes.add(hash);
    out.push(job);
  }
  return out;
}
