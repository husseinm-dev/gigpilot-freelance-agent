import { describe, it, expect } from "vitest";
import { costUsd, estimateInputTokens, estimateCallCostUsd, pricingFor, MODEL_PRICING } from "@/lib/costs/pricing";

describe("pricing", () => {
  it("computes gpt-4o-mini cost correctly", () => {
    // 1M input + 1M output at published pricing
    expect(costUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 5);
  });

  it("computes small call costs", () => {
    const cost = costUsd("gpt-4o-mini", 2000, 500);
    expect(cost).toBeCloseTo((2000 * 0.15 + 500 * 0.6) / 1_000_000, 8);
    expect(cost).toBeLessThan(0.001);
  });

  it("falls back to expensive pricing for unknown models so budget never under-reserves", () => {
    const unknown = pricingFor("some-future-model");
    const known = Object.values(MODEL_PRICING);
    expect(unknown.inputPerMillion).toBeGreaterThanOrEqual(Math.max(...known.map((p) => p.inputPerMillion)));
  });

  it("over-estimates input tokens conservatively", () => {
    const text = "a".repeat(3000);
    // ~750 actual tokens for 3000 chars English; we estimate 1000
    expect(estimateInputTokens(text)).toBe(1000);
  });

  it("estimates full call cost including max output", () => {
    const estimate = estimateCallCostUsd("gpt-4o-mini", "x".repeat(3000), 700);
    const floor = costUsd("gpt-4o-mini", 1000, 700);
    expect(estimate).toBeCloseTo(floor, 8);
  });
});
