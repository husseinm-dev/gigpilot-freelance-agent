import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { requireEnv } from "@/lib/env";
import { costUsd, estimateCallCostUsd } from "@/lib/costs/pricing";
import { reserveBudget, reconcileUsage, releaseReservation } from "@/lib/costs/budget";

let client: OpenAI | null = null;

export function openaiClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: requireEnv("OPENAI_API_KEY") });
  }
  return client;
}

export interface StructuredCallResult<T> {
  data: T;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * Budget-enforced structured call through the OpenAI Responses API.
 * 1. Conservatively estimates cost and atomically reserves budget.
 * 2. Calls the Responses API with a zod-validated structured output format.
 * 3. Reconciles the reservation against actual reported token usage.
 * Throws BudgetExceededError before making any API call if funds are short.
 */
export async function structuredCall<T extends z.ZodType>(opts: {
  model: string;
  schema: T;
  schemaName: string;
  system: string;
  user: string;
  maxOutputTokens: number;
  purpose: string;
  runId?: string;
}): Promise<StructuredCallResult<z.infer<T>>> {
  const promptText = opts.system + opts.user;
  const estimated = estimateCallCostUsd(opts.model, promptText, opts.maxOutputTokens);

  const reservationId = await reserveBudget({
    category: "openai",
    estimatedCostUsd: estimated,
    model: opts.model,
    purpose: opts.purpose,
    runId: opts.runId,
  });

  try {
    const response = await openaiClient().responses.parse({
      model: opts.model,
      input: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      text: { format: zodTextFormat(opts.schema, opts.schemaName) },
      max_output_tokens: opts.maxOutputTokens,
    });

    const parsed = response.output_parsed;
    if (parsed == null) {
      throw new Error(`OpenAI returned no parsed output (status: ${response.status})`);
    }

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const actual = costUsd(opts.model, inputTokens, outputTokens);

    await reconcileUsage({
      reservationId,
      actualCostUsd: actual,
      inputTokens,
      outputTokens,
    });

    return {
      data: parsed as z.infer<T>,
      model: opts.model,
      inputTokens,
      outputTokens,
      costUsd: actual,
    };
  } catch (err) {
    // If the call itself failed we may still have been charged; OpenAI does
    // not bill failed requests, so release the reservation.
    if (err instanceof Error && !err.message.includes("no parsed output")) {
      await releaseReservation(reservationId).catch(() => {});
    }
    throw err;
  }
}
