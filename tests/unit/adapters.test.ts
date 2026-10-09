import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { FreelancerAdapter } from "@/worker/sources/freelancer";
import { RemoteOkAdapter } from "@/worker/sources/remoteok";
import { RssAdapter } from "@/worker/sources/rss";
import { UpworkAdapter } from "@/worker/sources/upwork";
import { ManualImportAdapter } from "@/worker/sources/manual";
import { allAdapters } from "@/worker/sources/registry";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("capability honesty", () => {
  it("no manual-only adapter claims discovery or submission", () => {
    for (const adapter of allAdapters()) {
      const caps = adapter.capabilities();
      if (caps.integrationStatus === "manual_only") {
        expect(caps.discoverySupported).toBe(false);
        expect(caps.submissionSupported).toBe(false);
      }
    }
  });

  it("Upwork never claims unattended submission", () => {
    const caps = new UpworkAdapter().capabilities();
    expect(caps.submissionSupported).toBe(false);
    expect(caps.humanConfirmationRequired).toBe(true);
    expect(caps.applicationCostModel).toBe("connects");
  });

  it("Upwork reports requires_credentials without a token", () => {
    const caps = new UpworkAdapter().capabilities();
    expect(caps.integrationStatus).toBe("requires_credentials");
    expect(caps.discoverySupported).toBe(false);
  });

  it("Freelancer requires credentials and reports untested by default", () => {
    const caps = new FreelancerAdapter().capabilities();
    expect(caps.authRequired).toBe(true);
    expect(caps.tested).toBe(false);
  });
});

describe("FreelancerAdapter", () => {
  beforeEach(() => vi.stubEnv("FREELANCER_OAUTH_TOKEN", "test-token"));

  it("normalizes projects from the API response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          result: {
            projects: [
              {
                id: 123,
                seo_url: "my-project",
                title: "React dashboard",
                description: "Build a React dashboard with charts and auth.",
                currency: { code: "USD", exchange_rate: 1 },
                budget: { minimum: 500, maximum: 1000 },
                type: "fixed",
                jobs: [{ name: "React" }, { name: "JavaScript" }],
                bid_stats: { bid_count: 7 },
                submitdate: 1760000000,
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const jobs = await new FreelancerAdapter().discover({ maxJobs: 10, keywords: ["react"] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      sourceKey: "freelancer",
      externalId: "123",
      title: "React dashboard",
      budgetMinUsd: 500,
      budgetMaxUsd: 1000,
      budgetType: "fixed",
      bidCount: 7,
      applicationCostUsd: 0,
    });
    expect(jobs[0].skillsRequired).toEqual(["React", "JavaScript"]);
  });

  it("returns empty without credentials", async () => {
    vi.stubEnv("FREELANCER_OAUTH_TOKEN", "");
    const jobs = await new FreelancerAdapter().discover({ maxJobs: 10, keywords: ["react"] });
    expect(jobs).toEqual([]);
  });

  it("does not mark a bid submitted unless the platform confirms", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { id: 42, username: "me" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "error", message: "Insufficient bids" }), { status: 400 }));

    const result = await new FreelancerAdapter().submitBid({
      externalJobId: "123",
      coverLetter: "A real cover letter",
      bidAmountUsd: 800,
    });
    expect(result.submitted).toBe(false);
    expect(result.error).toContain("Insufficient bids");
  });

  it("returns confirmation id on successful bid", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { id: 42 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "success", result: { id: 9876 } }), { status: 200 }));

    const result = await new FreelancerAdapter().submitBid({
      externalJobId: "123",
      coverLetter: "A real cover letter",
      bidAmountUsd: 800,
      estimatedDays: 10,
    });
    expect(result.submitted).toBe(true);
    expect(result.externalConfirmationId).toBe("9876");
  });
});

describe("RemoteOkAdapter", () => {
  it("filters by keywords and skips the legal notice entry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify([
          { legal: "API terms..." },
          {
            id: 1, position: "React Developer", company: "Acme",
            description: "Frontend work with React", tags: ["react", "frontend"],
            url: "https://remoteok.com/jobs/1", date: "2025-10-01T00:00:00Z",
          },
          {
            id: 2, position: "Chef", company: "Kitchen",
            description: "Cooking", tags: ["cooking"],
            url: "https://remoteok.com/jobs/2", date: "2025-10-01T00:00:00Z",
          },
        ]),
        { status: 200 },
      ),
    );

    const jobs = await new RemoteOkAdapter().discover({ maxJobs: 10, keywords: ["react"] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].externalId).toBe("1");
    expect(jobs[0].title).toContain("React Developer");
  });
});

describe("RssAdapter", () => {
  it("parses RSS items and filters by keywords", async () => {
    const xml = `<?xml version="1.0"?>
      <rss version="2.0"><channel>
        <item>
          <title>Senior Next.js Engineer</title>
          <link>https://example.com/job/1</link>
          <guid>job-1</guid>
          <description>Remote Next.js and TypeScript role</description>
          <pubDate>Wed, 01 Oct 2025 12:00:00 GMT</pubDate>
          <category>Programming</category>
        </item>
        <item>
          <title>Accountant</title>
          <link>https://example.com/job/2</link>
          <guid>job-2</guid>
          <description>Bookkeeping role</description>
        </item>
      </channel></rss>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(xml, { status: 200 }));

    const adapter = new RssAdapter("test-rss", "Test feed", ["https://example.com/feed.rss"]);
    const jobs = await adapter.discover({ maxJobs: 10, keywords: ["next.js"] });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ externalId: "job-1", title: "Senior Next.js Engineer" });
  });

  it("survives a broken feed without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const adapter = new RssAdapter("test-rss", "Test feed", ["https://example.com/feed.rss"]);
    await expect(adapter.discover({ maxJobs: 10, keywords: ["react"] })).resolves.toEqual([]);
  });
});

describe("ManualImportAdapter", () => {
  it("never discovers and always reports manual_only", async () => {
    const adapter = new ManualImportAdapter("contra", "Contra");
    expect(await adapter.discover({ maxJobs: 10, keywords: [] })).toEqual([]);
    expect(adapter.capabilities().integrationStatus).toBe("manual_only");
  });
});
