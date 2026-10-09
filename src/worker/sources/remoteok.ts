import type { NormalizedJob } from "@/lib/normalize";
import type { SourceAdapter, SourceCapabilities, DiscoverOptions } from "./types";

/**
 * RemoteOK public JSON API (https://remoteok.com/api).
 * Free, no auth, explicitly public with attribution + link-back required.
 * Listings are jobs (often contract/freelance-friendly); application is via
 * the original listing URL, so submission is manual.
 */
export class RemoteOkAdapter implements SourceAdapter {
  capabilities(): SourceCapabilities {
    return {
      key: "remoteok",
      name: "RemoteOK",
      discoverySupported: true,
      authRequired: false,
      officialApi: true,
      submissionSupported: false,
      humanConfirmationRequired: true,
      tested: false,
      applicationCostModel: "free",
      integrationStatus: "working",
      limitations: [
        "Application happens on the employer's site — GigPilot marks these READY_FOR_MANUAL_SUBMISSION",
        "API requires attribution and link back to RemoteOK",
        "Mostly full-time/contract roles; deterministic filters remove poor fits",
      ],
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch("https://remoteok.com/api", {
        headers: { "User-Agent": "GigPilot (https://github.com/husseinm-dev/gigpilot-freelance-agent)" },
      });
      return res.ok
        ? { ok: true, message: "RemoteOK API reachable" }
        : { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async discover(opts: DiscoverOptions): Promise<NormalizedJob[]> {
    const res = await fetch("https://remoteok.com/api", {
      headers: { "User-Agent": "GigPilot (https://github.com/husseinm-dev/gigpilot-freelance-agent)" },
    });
    if (!res.ok) throw new Error(`RemoteOK API error: HTTP ${res.status}`);

    const body = (await res.json()) as Array<{
      id?: string | number;
      slug?: string;
      position?: string;
      description?: string;
      tags?: string[];
      salary_min?: number;
      salary_max?: number;
      url?: string;
      date?: string;
      company?: string;
      legal?: string;
    }>;

    const keywordSet = opts.keywords.map((k) => k.toLowerCase());
    return body
      .filter((item) => item.id && item.position) // first element is a legal notice
      .filter((item) => {
        const haystack = `${item.position} ${(item.tags ?? []).join(" ")} ${item.description ?? ""}`.toLowerCase();
        return keywordSet.some((k) => haystack.includes(k));
      })
      .slice(0, opts.maxJobs)
      .map((item): NormalizedJob => ({
        sourceKey: "remoteok",
        externalId: String(item.id),
        url: item.url,
        title: `${item.position}${item.company ? ` — ${item.company}` : ""}`,
        description: item.description ?? "",
        budgetMinUsd: item.salary_min || undefined,
        budgetMaxUsd: item.salary_max || undefined,
        budgetType: "unknown",
        skillsRequired: item.tags ?? [],
        applicationCostUsd: 0,
        postedAt: item.date ? new Date(item.date) : undefined,
        raw: item as Record<string, unknown>,
      }));
  }
}
