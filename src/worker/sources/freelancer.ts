import { env } from "@/lib/env";
import type { NormalizedJob } from "@/lib/normalize";
import type {
  SourceAdapter,
  SourceCapabilities,
  DiscoverOptions,
  SubmitBidInput,
  SubmitBidResult,
} from "./types";

const API_BASE = "https://www.freelancer.com/api";

/**
 * Freelancer.com official developer API (https://developers.freelancer.com).
 * - Project search: GET /projects/0.1/projects/active — works with an OAuth
 *   access token generated from the developer dashboard.
 * - Bid placement: POST /projects/0.1/bids — officially documented and
 *   permitted for the authenticated bidder. Uses the account's free monthly
 *   bid allowance; GigPilot never purchases bid credits.
 * Autonomous submission stays off until a successful live integration test
 * is recorded (job_sources.tested) AND the user enables autonomous mode.
 */
export class FreelancerAdapter implements SourceAdapter {
  capabilities(): SourceCapabilities {
    return {
      key: "freelancer",
      name: "Freelancer.com",
      discoverySupported: true,
      authRequired: true,
      officialApi: true,
      submissionSupported: true,
      humanConfirmationRequired: false, // API permits programmatic bids; GigPilot still defaults to approval mode
      tested: false, // flipped in DB after a verified live test
      applicationCostModel: "free", // uses free monthly bid allowance
      integrationStatus: this.isConfigured() ? "working" : "requires_credentials",
      limitations: [
        "Requires FREELANCER_OAUTH_TOKEN from the Freelancer developer dashboard",
        "Bid placement consumes the account's monthly bid allowance",
        "Autonomous mode requires a recorded successful integration test",
      ],
    };
  }

  isConfigured(): boolean {
    return Boolean(env().FREELANCER_OAUTH_TOKEN);
  }

  private headers(): Record<string, string> {
    const token = env().FREELANCER_OAUTH_TOKEN;
    if (!token) throw new Error("FREELANCER_OAUTH_TOKEN not configured");
    return { "freelancer-oauth-v1": token };
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: "FREELANCER_OAUTH_TOKEN not set" };
    }
    try {
      const res = await fetch(`${API_BASE}/users/0.1/self/`, { headers: this.headers() });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const body = (await res.json()) as { result?: { username?: string } };
      return { ok: true, message: `Authenticated as ${body.result?.username ?? "unknown"}` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async discover(opts: DiscoverOptions): Promise<NormalizedJob[]> {
    if (!this.isConfigured()) return [];
    const params = new URLSearchParams({
      limit: String(Math.min(opts.maxJobs, 100)),
      "full_description": "true",
      "job_details": "true",
      "upgrade_details": "true",
      compact: "true",
      sort_field: "time_submitted",
    });
    for (const kw of opts.keywords.slice(0, 10)) params.append("jobs[]", kw);

    const res = await fetch(
      `${API_BASE}/projects/0.1/projects/active/?${params.toString()}&query=${encodeURIComponent(
        opts.keywords.slice(0, 5).join(" OR "),
      )}`,
      { headers: this.headers() },
    );
    if (!res.ok) throw new Error(`Freelancer API error: HTTP ${res.status}`);

    const body = (await res.json()) as {
      result?: {
        projects?: Array<{
          id: number;
          seo_url?: string;
          title?: string;
          description?: string;
          preview_description?: string;
          currency?: { code?: string; exchange_rate?: number };
          budget?: { minimum?: number; maximum?: number };
          type?: string;
          jobs?: Array<{ name?: string }>;
          bid_stats?: { bid_count?: number };
          submitdate?: number;
          upgrades?: { NDA?: boolean };
        }>;
      };
    };

    const projects = body.result?.projects ?? [];
    return projects.slice(0, opts.maxJobs).map((p): NormalizedJob => {
      const rate = p.currency?.exchange_rate ?? 1;
      return {
        sourceKey: "freelancer",
        externalId: String(p.id),
        url: p.seo_url ? `https://www.freelancer.com/projects/${p.seo_url}` : undefined,
        title: p.title ?? "Untitled project",
        description: p.description || p.preview_description || "",
        budgetMinUsd: p.budget?.minimum != null ? p.budget.minimum * rate : undefined,
        budgetMaxUsd: p.budget?.maximum != null ? p.budget.maximum * rate : undefined,
        budgetType: p.type === "hourly" ? "hourly" : p.type === "fixed" ? "fixed" : "unknown",
        currency: "USD",
        skillsRequired: (p.jobs ?? []).map((j) => j.name ?? "").filter(Boolean),
        bidCount: p.bid_stats?.bid_count,
        applicationCostUsd: 0,
        postedAt: p.submitdate ? new Date(p.submitdate * 1000) : undefined,
        raw: p as unknown as Record<string, unknown>,
      };
    });
  }

  async submitBid(input: SubmitBidInput): Promise<SubmitBidResult> {
    if (!this.isConfigured()) {
      return { submitted: false, error: "FREELANCER_OAUTH_TOKEN not configured" };
    }
    // Resolve own user id (required bidder_id field)
    const selfRes = await fetch(`${API_BASE}/users/0.1/self/`, { headers: this.headers() });
    if (!selfRes.ok) return { submitted: false, error: `Auth check failed: HTTP ${selfRes.status}` };
    const self = (await selfRes.json()) as { result?: { id?: number } };
    const bidderId = self.result?.id;
    if (!bidderId) return { submitted: false, error: "Could not resolve bidder id" };

    const res = await fetch(`${API_BASE}/projects/0.1/bids/`, {
      method: "POST",
      headers: { ...this.headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: Number(input.externalJobId),
        bidder_id: bidderId,
        amount: input.bidAmountUsd,
        period: input.estimatedDays ?? 7,
        milestone_percentage: 50,
        description: input.coverLetter,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      result?: { id?: number };
      message?: string;
    };

    if (!res.ok || body.status !== "success" || !body.result?.id) {
      return {
        submitted: false,
        error: body.message ?? `HTTP ${res.status}`,
        raw: body as Record<string, unknown>,
      };
    }

    return {
      submitted: true,
      externalConfirmationId: String(body.result.id),
      externalConfirmationUrl: `https://www.freelancer.com/projects/${input.externalJobId}`,
      raw: body as Record<string, unknown>,
    };
  }
}
