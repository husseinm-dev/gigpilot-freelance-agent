import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";
import type { NormalizedJob } from "@/lib/normalize";
import type { SourceAdapter, SourceCapabilities, DiscoverOptions } from "./types";

interface RssItem {
  title?: string;
  link?: string;
  guid?: string | { "#text"?: string };
  description?: string;
  pubDate?: string;
  category?: string | string[];
}

/**
 * Generic RSS adapter for permitted feeds. Defaults to WeWorkRemotely's
 * public programming feed; additional feeds are configurable per source
 * (job_sources.config.feeds). Submission is always manual.
 */
export class RssAdapter implements SourceAdapter {
  constructor(
    private key = "rss",
    private name = "RSS feeds",
    private defaultFeeds: string[] = [
      "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    ],
  ) {}

  capabilities(): SourceCapabilities {
    return {
      key: this.key,
      name: this.name,
      discoverySupported: true,
      authRequired: false,
      officialApi: false,
      submissionSupported: false,
      humanConfirmationRequired: true,
      tested: false,
      applicationCostModel: "free",
      integrationStatus: "working",
      limitations: [
        "Only add feeds whose terms permit automated consumption",
        "No budget/client metadata in most feeds — AI evaluation fills gaps conservatively",
        "Application is manual via the listing URL",
      ],
    };
  }

  isConfigured(): boolean {
    return true;
  }

  private feeds(config?: Record<string, unknown>): string[] {
    const configured = config?.feeds;
    if (Array.isArray(configured) && configured.every((f) => typeof f === "string")) {
      return configured as string[];
    }
    return this.defaultFeeds;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (this.defaultFeeds.length === 0) {
      return { ok: true, message: "No feeds configured — add feeds in the source config" };
    }
    try {
      const res = await fetch(this.defaultFeeds[0], {
        headers: { "User-Agent": "GigPilot (https://github.com/husseinm-dev/gigpilot-freelance-agent)" },
      });
      return res.ok
        ? { ok: true, message: `Feed reachable: ${this.defaultFeeds[0]}` }
        : { ok: false, message: `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async discover(opts: DiscoverOptions): Promise<NormalizedJob[]> {
    const parser = new XMLParser({ ignoreAttributes: false });
    const keywordSet = opts.keywords.map((k) => k.toLowerCase());
    const out: NormalizedJob[] = [];

    for (const feedUrl of this.feeds(opts.sourceConfig)) {
      try {
        const res = await fetch(feedUrl, {
          headers: { "User-Agent": "GigPilot (https://github.com/husseinm-dev/gigpilot-freelance-agent)" },
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const parsed = parser.parse(xml) as {
          rss?: { channel?: { item?: RssItem | RssItem[] } };
        };
        const items = parsed.rss?.channel?.item;
        const list: RssItem[] = Array.isArray(items) ? items : items ? [items] : [];

        for (const item of list) {
          if (out.length >= opts.maxJobs) break;
          const title = item.title ?? "";
          const description = item.description ?? "";
          const haystack = `${title} ${description}`.toLowerCase();
          if (!keywordSet.some((k) => haystack.includes(k))) continue;

          const guid = typeof item.guid === "object" ? item.guid?.["#text"] : item.guid;
          const link = item.link ?? "";
          const externalId =
            guid || link || createHash("sha1").update(title + description).digest("hex");

          out.push({
            sourceKey: this.key,
            externalId: String(externalId),
            url: link || undefined,
            title,
            description,
            budgetType: "unknown",
            skillsRequired: Array.isArray(item.category)
              ? item.category
              : item.category
                ? [item.category]
                : [],
            applicationCostUsd: 0,
            postedAt: item.pubDate ? new Date(item.pubDate) : undefined,
            raw: { feedUrl },
          });
        }
      } catch {
        // A failing feed must not break the whole discovery run.
        continue;
      }
    }
    return out;
  }
}
