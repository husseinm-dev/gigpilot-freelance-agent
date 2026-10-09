/**
 * Configurable OpenAI pricing table (USD per 1M tokens).
 * Verify against https://openai.com/api/pricing before changing models.
 * The budget manager falls back to the most expensive known entry when a
 * model is missing, so unknown models can never under-reserve.
 */
export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // verified 2025 pricing for the low-cost mini tier
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-4.1-nano": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gpt-5-mini": { inputPerMillion: 0.25, outputPerMillion: 2.0 },
  "gpt-5-nano": { inputPerMillion: 0.05, outputPerMillion: 0.4 },
};

const FALLBACK_PRICING: ModelPricing = { inputPerMillion: 5, outputPerMillion: 20 };

export function pricingFor(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? FALLBACK_PRICING;
}

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = pricingFor(model);
  return (inputTokens * p.inputPerMillion + outputTokens * p.outputPerMillion) / 1_000_000;
}

/**
 * Conservative pre-request token estimate: ~1 token per 3 characters
 * (English averages ~4 chars/token, so this over-estimates on purpose).
 */
export function estimateInputTokens(text: string): number {
  return Math.ceil(text.length / 3);
}

export function estimateCallCostUsd(model: string, promptText: string, maxOutputTokens: number): number {
  return costUsd(model, estimateInputTokens(promptText), maxOutputTokens);
}
