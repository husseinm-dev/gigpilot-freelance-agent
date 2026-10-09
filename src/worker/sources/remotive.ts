import type { NormalizedJob } from "@/lib/normalize";
import type { SourceAdapter, SourceCapabilities, DiscoverOptions } from "./types";

/**
 * Remotive public API (https://remotive.com/api/remote-jobs).
 * Free, no auth. Software development category filter supported.
 * Application is via the original listing URL — manual submission.
 */
export class RemotiveAdapter implements SourceAdapter {
  capabilities(): SourceCapabilities {
    return {
      key: "remotive",
      name: "Remotive",
      discoverySupported: true,
      authRequired: false,
      officialApi: true,
      submissionSupported: false,
      humanConfirmationRequired: true,
      tested: false,
      applicationCostModel: "free",
      integrationStatus: "working",
      limitations: [
        "Application happens on the employer's site — READY_FOR_MANUAL_SUBMISSION",
        "Remotive asks API users to link back to the listing",
      ],
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch("https://remotive.com/api/remote-jobs?limit=1");
      return res.ok
        ? { ok: true, message: "Remotive API reachable" }
        : { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async discover(opts: DiscoverOptions): Promise<NormalizedJob[]> {
    const params = new URLSearchParams({
      category: "software-dev",
      limit: String(Math.min(opts.maxJobs * 2, 100)),
    });
    const res = await fetch(`https://remotive.com/api/remote-jobs?${params}`);
    if (!res.ok) throw new Error(`Remotive API error: HTTP ${res.status}`);

    const body = (await res.json()) as {
      jobs?: Array<{
        id: number;
        url?: string;
        title?: string;
        description?: string;
        tags?: string[];
        salary?: string;
        job_type?: string;
        publication_date?: string;
        company_name?: string;
      }>;
    };

    const keywordSet = opts.keywords.map((k) => k.toLowerCase());
    return (body.jobs ?? [])
      .filter((j) => {
        const haystack = `${j.title} ${(j.tags ?? []).join(" ")}`.toLowerCase();
        return keywordSet.some((k) => haystack.includes(k));
      })
      .slice(0, opts.maxJobs)
      .map((j): NormalizedJob => ({
        sourceKey: "remotive",
        externalId: String(j.id),
        url: j.url,
        title: `${j.title}${j.company_name ? ` — ${j.company_name}` : ""}`,
        description: j.description ?? "",
        budgetType: j.job_type === "contract" ? "unknown" : "unknown",
        skillsRequired: j.tags ?? [],
        applicationCostUsd: 0,
        postedAt: j.publication_date ? new Date(j.publication_date) : undefined,
        raw: j as unknown as Record<string, unknown>,
      }));
  }
}
