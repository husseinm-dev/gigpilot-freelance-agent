import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTelegram, formatRunSummary } from "@/lib/telegram";

describe("formatRunSummary", () => {
  it("formats the run summary with all metrics", () => {
    const text = formatRunSummary({
      label: "morning run",
      jobsDiscovered: 42,
      qualified: 8,
      proposalsGenerated: 4,
      bidsSubmitted: 2,
      awaitingApproval: 2,
      readyForManual: 1,
      runCostUsd: 0.04,
      monthlyCostUsd: 0.83,
      dashboardUrl: "https://dash.example.com",
    });
    expect(text).toContain("GIGPILOT — MORNING RUN");
    expect(text).toContain("Jobs discovered: 42");
    expect(text).toContain("Qualified opportunities: 8");
    expect(text).toContain("AI cost: $0.0400");
    expect(text).toContain("Monthly AI spending: $0.83");
    expect(text).toContain("https://dash.example.com/approvals");
  });

  it("marks dry runs", () => {
    const text = formatRunSummary({
      label: "dry run",
      jobsDiscovered: 0,
      qualified: 0,
      proposalsGenerated: 0,
      bidsSubmitted: 0,
      awaitingApproval: 0,
      readyForManual: 0,
      runCostUsd: 0,
      monthlyCostUsd: 0,
      dryRun: true,
    });
    expect(text).toContain("(DRY RUN)");
  });
});

describe("sendTelegram", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:abc");
    vi.stubEnv("TELEGRAM_CHAT_ID", "456");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("refuses to send messages containing API-key-like secrets", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await sendTelegram("here is a key sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/secret/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends normal messages", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const result = await sendTelegram("Run complete: 3 proposals");
    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("api.telegram.org");
    expect(JSON.parse(String(init?.body)).chat_id).toBe("456");
  });

  it("fails gracefully when unconfigured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const result = await sendTelegram("test");
    expect(result.ok).toBe(false);
  });
});
