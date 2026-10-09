import { and, eq, sql as dsql } from "drizzle-orm";
import { db, schema, sql } from "@/db/client";
import { getSettings } from "@/lib/settings";

export type BudgetCategory = "openai" | "marketplace_credits" | "hosting" | "other";

export class BudgetExceededError extends Error {
  constructor(public category: BudgetCategory, public remainingUsd: number) {
    super(`Budget exhausted for ${category}. Remaining: $${remainingUsd.toFixed(4)}`);
    this.name = "BudgetExceededError";
  }
}

export function currentMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}

export interface BudgetSnapshot {
  month: string;
  category: BudgetCategory;
  limitUsd: number;
  reservedUsd: number;
  spentUsd: number;
  safetyBufferUsd: number;
  remainingUsd: number;
}

async function ensureBudgetRow(month: string, category: BudgetCategory, platform?: string) {
  const settings = await getSettings();
  const limit =
    category === "openai"
      ? settings.monthlyOpenAiBudgetUsd
      : category === "marketplace_credits"
        ? platform
          ? (settings.platformCreditBudgetsUsd[platform] ?? 0)
          : settings.monthlyMarketplaceBudgetUsd
        : 0;

  await db
    .insert(schema.monthlyBudgets)
    .values({
      month,
      category,
      platform: platform ?? null,
      limitUsd: String(limit),
      safetyBufferUsd: String(settings.budgetSafetyBufferUsd),
    })
    .onConflictDoNothing();
}

export async function getBudgetSnapshot(
  category: BudgetCategory,
  platform?: string,
  now = new Date(),
): Promise<BudgetSnapshot> {
  const month = currentMonth(now);
  await ensureBudgetRow(month, category, platform);
  const row = await db.query.monthlyBudgets.findFirst({
    where: and(
      eq(schema.monthlyBudgets.month, month),
      eq(schema.monthlyBudgets.category, category),
      platform
        ? eq(schema.monthlyBudgets.platform, platform)
        : dsql`${schema.monthlyBudgets.platform} IS NULL`,
    ),
  });
  if (!row) throw new Error("Budget row missing after ensure");
  const limitUsd = Number(row.limitUsd);
  const reservedUsd = Number(row.reservedUsd);
  const spentUsd = Number(row.spentUsd);
  const safetyBufferUsd = Number(row.safetyBufferUsd);
  return {
    month,
    category,
    limitUsd,
    reservedUsd,
    spentUsd,
    safetyBufferUsd,
    remainingUsd: Math.max(0, limitUsd - safetyBufferUsd - spentUsd - reservedUsd),
  };
}

/**
 * Atomically reserve budget before an API call. Uses a single UPDATE with a
 * WHERE guard so concurrent workers can never jointly overshoot the limit.
 * Returns a reservation id (api_usage row) to reconcile afterwards.
 */
export async function reserveBudget(opts: {
  category: BudgetCategory;
  estimatedCostUsd: number;
  model: string;
  purpose: string;
  runId?: string;
  platform?: string;
  now?: Date;
}): Promise<string> {
  const month = currentMonth(opts.now);
  await ensureBudgetRow(month, opts.category, opts.platform);

  const platformClause = opts.platform
    ? sql`AND platform = ${opts.platform}`
    : sql`AND platform IS NULL`;

  const updated = await sql`
    UPDATE monthly_budgets
    SET reserved_usd = reserved_usd + ${opts.estimatedCostUsd}, updated_at = now()
    WHERE month = ${month}
      AND category = ${opts.category}
      ${platformClause}
      AND (spent_usd + reserved_usd + ${opts.estimatedCostUsd}) <= (limit_usd - safety_buffer_usd)
    RETURNING id
  `;

  if (updated.length === 0) {
    const snap = await getBudgetSnapshot(opts.category, opts.platform, opts.now);
    throw new BudgetExceededError(opts.category, snap.remainingUsd);
  }

  const [usage] = await db
    .insert(schema.apiUsage)
    .values({
      runId: opts.runId,
      provider: opts.category === "openai" ? "openai" : opts.category,
      model: opts.model,
      purpose: opts.purpose,
      estimatedCostUsd: String(opts.estimatedCostUsd),
      month,
    })
    .returning({ id: schema.apiUsage.id });

  return usage.id;
}

/**
 * Reconcile a reservation with the actual usage reported by the API.
 * Moves money from reserved -> spent using the real cost.
 */
export async function reconcileUsage(opts: {
  reservationId: string;
  actualCostUsd: number;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  const usage = await db.query.apiUsage.findFirst({
    where: eq(schema.apiUsage.id, opts.reservationId),
  });
  if (!usage || usage.reconciled) return;

  const estimated = Number(usage.estimatedCostUsd);
  const platformClause = sql`AND platform IS NULL`;
  const category = usage.provider === "openai" ? "openai" : usage.provider;

  await sql`
    UPDATE monthly_budgets
    SET reserved_usd = GREATEST(0, reserved_usd - ${estimated}),
        spent_usd = spent_usd + ${opts.actualCostUsd},
        updated_at = now()
    WHERE month = ${usage.month} AND category = ${category} ${platformClause}
  `;

  await db
    .update(schema.apiUsage)
    .set({
      actualCostUsd: String(opts.actualCostUsd),
      inputTokens: opts.inputTokens,
      outputTokens: opts.outputTokens,
      reconciled: true,
    })
    .where(eq(schema.apiUsage.id, opts.reservationId));
}

/** Release a reservation when a call fails before incurring cost. */
export async function releaseReservation(reservationId: string): Promise<void> {
  const usage = await db.query.apiUsage.findFirst({
    where: eq(schema.apiUsage.id, reservationId),
  });
  if (!usage || usage.reconciled) return;
  const estimated = Number(usage.estimatedCostUsd);
  const category = usage.provider === "openai" ? "openai" : usage.provider;
  await sql`
    UPDATE monthly_budgets
    SET reserved_usd = GREATEST(0, reserved_usd - ${estimated}), updated_at = now()
    WHERE month = ${usage.month} AND category = ${category} AND platform IS NULL
  `;
  await db
    .update(schema.apiUsage)
    .set({ actualCostUsd: "0", reconciled: true })
    .where(eq(schema.apiUsage.id, reservationId));
}

export async function monthlySpend(category: BudgetCategory, now = new Date()): Promise<number> {
  const snap = await getBudgetSnapshot(category, undefined, now);
  return snap.spentUsd;
}
