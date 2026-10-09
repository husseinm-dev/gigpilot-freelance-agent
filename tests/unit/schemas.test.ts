import { describe, it, expect } from "vitest";
import { evaluationSchema, proposalSchema } from "@/lib/ai/schemas";
import { automationSettingsSchema, DEFAULT_SETTINGS } from "@/lib/settings-schema";

describe("evaluation schema", () => {
  it("accepts a valid structured evaluation", () => {
    const result = evaluationSchema.safeParse({
      score: 88,
      recommendation: "pursue",
      reasons: ["Strong tech match"],
      risks: ["Tight timeline"],
      estimated_hours: 24,
      suggested_bid_usd: 1200,
      confidence: "high",
      technology_match: 92,
      scope_clarity: 80,
      client_credibility: "unknown",
    });
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range scores", () => {
    expect(
      evaluationSchema.safeParse({
        score: 150,
        recommendation: "pursue",
        reasons: [],
        risks: [],
        estimated_hours: 10,
        suggested_bid_usd: 500,
        confidence: "low",
        technology_match: 50,
        scope_clarity: 50,
        client_credibility: "unknown",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid recommendations", () => {
    expect(
      evaluationSchema.safeParse({
        score: 70,
        recommendation: "definitely",
        reasons: [],
        risks: [],
        estimated_hours: 10,
        suggested_bid_usd: 500,
        confidence: "low",
        technology_match: 50,
        scope_clarity: 50,
        client_credibility: "unknown",
      }).success,
    ).toBe(false);
  });
});

describe("proposal schema", () => {
  it("accepts a valid proposal draft", () => {
    const result = proposalSchema.safeParse({
      cover_letter: "I read through your project and here is my approach...",
      bid_amount_usd: 900,
      bid_type: "fixed",
      estimated_days: 14,
      clarifying_question: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative bids and absurd timelines", () => {
    expect(
      proposalSchema.safeParse({
        cover_letter: "text",
        bid_amount_usd: -5,
        bid_type: "fixed",
        estimated_days: 14,
        clarifying_question: null,
      }).success,
    ).toBe(false);
    expect(
      proposalSchema.safeParse({
        cover_letter: "text",
        bid_amount_usd: 500,
        bid_type: "fixed",
        estimated_days: 1000,
        clarifying_question: null,
      }).success,
    ).toBe(false);
  });
});

describe("automation settings", () => {
  it("has the specified defaults", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      runsPerDay: 2,
      maxJobsPerRun: 50,
      maxEvaluationsPerRun: 15,
      maxProposalsPerRun: 5,
      maxBidsPerRun: 3,
      maxBidsPerDay: 6,
      minBudgetUsd: 300,
      preferredBudgetMinUsd: 500,
      preferredBudgetMaxUsd: 2500,
      minQualificationScore: 85,
      submissionMode: "approval_required",
      monthlyOpenAiBudgetUsd: 5,
      monthlyMarketplaceBudgetUsd: 0,
      paused: false,
      webSearchEnabled: false,
    });
  });

  it("defaults submission mode to approval_required (never autonomous)", () => {
    expect(automationSettingsSchema.parse({}).submissionMode).toBe("approval_required");
  });

  it("rejects invalid values", () => {
    expect(automationSettingsSchema.safeParse({ maxBidsPerDay: -1 }).success).toBe(false);
    expect(automationSettingsSchema.safeParse({ minQualificationScore: 101 }).success).toBe(false);
  });
});
