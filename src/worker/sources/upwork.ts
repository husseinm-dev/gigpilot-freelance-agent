import { env } from "@/lib/env";
import type { NormalizedJob } from "@/lib/normalize";
import type { SourceAdapter, SourceCapabilities, DiscoverOptions } from "./types";

const GRAPHQL_ENDPOINT = "https://api.upwork.com/graphql";

/**
 * Upwork adapter — INDIVIDUAL freelancer account, honest capability report.
 *
 * Verified facts about Upwork's integration surface (researched Oct 2025):
 * - Public web scraping is prohibited by Upwork ToS. Not implemented.
 * - The official API (GraphQL at api.upwork.com/graphql) requires an
 *   approved API key + OAuth2. Marketplace Job Postings search
 *   (`marketplaceJobPostingsSearch`) additionally requires Upwork's
 *   partner-level API approval, which is granted case-by-case.
 * - The official Upwork MCP server (https://mcp.upwork.com/mcp) exposes job
 *   search and proposal drafting to MCP CLIENTS (Claude, ChatGPT connectors,
 *   etc.) after the user OAuths. It is designed for interactive assistant
 *   sessions; proposal submission ALWAYS requires the user to confirm in
 *   Upwork's UI. A headless worker cannot — and must not — bypass that.
 *
 * Consequences implemented here:
 * - Discovery works ONLY when UPWORK_ACCESS_TOKEN (OAuth2 bearer with an
 *   approved API key) is configured. Otherwise the adapter reports
 *   requires_credentials and returns no jobs.
 * - Submission is NEVER automated. Proposals are queued as
 *   AWAITING_APPROVAL with a deep link so you can review and submit through
 *   Upwork's own flow (optionally assisted by the official MCP server in
 *   your AI client). Connects cost is estimated and tracked, never purchased.
 */
export class UpworkAdapter implements SourceAdapter {
  capabilities(): SourceCapabilities {
    return {
      key: "upwork",
      name: "Upwork (individual freelancer)",
      discoverySupported: this.isConfigured(),
      authRequired: true,
      officialApi: true,
      submissionSupported: false, // submission confirmation is mandatory on Upwork
      humanConfirmationRequired: true,
      tested: false,
      applicationCostModel: "connects",
      integrationStatus: this.isConfigured() ? "requires_approval" : "requires_credentials",
      limitations: [
        "Requires an approved Upwork API key and OAuth2 token (UPWORK_ACCESS_TOKEN)",
        "marketplaceJobPostingsSearch requires Upwork partner API approval",
        "Proposal submission always requires your confirmation in Upwork's UI/MCP flow — never automated",
        "Applying costs Connects (~$0.15 each); GigPilot tracks but never buys Connects",
        "Scraping Upwork is prohibited and not implemented",
      ],
    };
  }

  isConfigured(): boolean {
    return Boolean(env().UPWORK_ACCESS_TOKEN);
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { ok: false, message: "UPWORK_ACCESS_TOKEN not set (requires approved Upwork API key)" };
    }
    try {
      const res = await fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env().UPWORK_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: "query { user { id } }" }),
      });
      if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };
      const body = (await res.json()) as { data?: { user?: { id?: string } }; errors?: unknown[] };
      if (body.errors?.length) return { ok: false, message: `GraphQL errors: ${JSON.stringify(body.errors).slice(0, 200)}` };
      return { ok: true, message: `Authenticated (user ${body.data?.user?.id ?? "unknown"})` };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : String(err) };
    }
  }

  async discover(opts: DiscoverOptions): Promise<NormalizedJob[]> {
    if (!this.isConfigured()) return [];

    const query = `
      query Search($filter: MarketplaceJobPostingsSearchFilter, $sort: [MarketplaceJobPostingSearchSortAttribute], $pagination: MarketplaceJobPostingsSearchPagination) {
        marketplaceJobPostingsSearch(marketPlaceJobFilter: $filter, searchType: USER_JOBS_SEARCH, sortAttributes: $sort, pagination: $pagination) {
          edges {
            node {
              id
              title
              description
              ciphertext
              amount { rawValue currency }
              hourlyBudgetMin { rawValue }
              hourlyBudgetMax { rawValue }
              skills { name }
              category
              createdDateTime
              totalApplicants
              client { location { country } verificationStatus totalHires totalPostedJobs totalFeedback }
            }
          }
        }
      }`;

    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env().UPWORK_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          filter: { searchExpression_eq: opts.keywords.slice(0, 5).join(" OR ") },
          sort: [{ field: "RECENCY" }],
          pagination: { first: Math.min(opts.maxJobs, 50) },
        },
      }),
    });

    if (!res.ok) throw new Error(`Upwork API error: HTTP ${res.status}`);
    const body = (await res.json()) as {
      data?: {
        marketplaceJobPostingsSearch?: {
          edges?: Array<{
            node: {
              id: string;
              title?: string;
              description?: string;
              ciphertext?: string;
              amount?: { rawValue?: string };
              hourlyBudgetMin?: { rawValue?: string };
              hourlyBudgetMax?: { rawValue?: string };
              skills?: Array<{ name?: string }>;
              category?: string;
              createdDateTime?: string;
              totalApplicants?: number;
              client?: {
                location?: { country?: string };
                verificationStatus?: string;
                totalPostedJobs?: number;
                totalFeedback?: number;
              };
            };
          }>;
        };
      };
      errors?: Array<{ message?: string }>;
    };

    if (body.errors?.length) {
      throw new Error(`Upwork GraphQL error: ${body.errors[0]?.message ?? "unknown"}`);
    }

    const edges = body.data?.marketplaceJobPostingsSearch?.edges ?? [];
    return edges.map(({ node }): NormalizedJob => {
      const fixed = node.amount?.rawValue ? Number(node.amount.rawValue) : undefined;
      return {
        sourceKey: "upwork",
        externalId: node.id,
        url: node.ciphertext ? `https://www.upwork.com/jobs/${node.ciphertext}` : undefined,
        title: node.title ?? "Untitled job",
        description: node.description ?? "",
        budgetMinUsd: fixed ?? (node.hourlyBudgetMin?.rawValue ? Number(node.hourlyBudgetMin.rawValue) : undefined),
        budgetMaxUsd: fixed ?? (node.hourlyBudgetMax?.rawValue ? Number(node.hourlyBudgetMax.rawValue) : undefined),
        budgetType: fixed != null ? "fixed" : node.hourlyBudgetMin ? "hourly" : "unknown",
        skillsRequired: (node.skills ?? []).map((s) => s.name ?? "").filter(Boolean),
        category: node.category,
        clientCountry: node.client?.location?.country,
        clientVerified: node.client?.verificationStatus === "VERIFIED",
        clientRating: node.client?.totalFeedback,
        clientJobsPosted: node.client?.totalPostedJobs,
        bidCount: node.totalApplicants,
        // Conservative default Connects estimate; actual cost shown at approval time
        connectsRequired: 12,
        applicationCostUsd: 12 * 0.15,
        postedAt: node.createdDateTime ? new Date(node.createdDateTime) : undefined,
        raw: node as unknown as Record<string, unknown>,
      };
    });
  }
}
