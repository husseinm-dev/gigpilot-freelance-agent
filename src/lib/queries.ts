import { and, count, desc, eq, gte, sql as dsql, sum } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { currentMonth } from "@/lib/costs/budget";

export async function todayStats() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const runs = await db.query.automationRuns.findMany({
    where: gte(schema.automationRuns.startedAt, startOfDay),
    orderBy: [desc(schema.automationRuns.startedAt)],
  });

  const totals = runs.reduce(
    (acc, r) => ({
      discovered: acc.discovered + r.jobsDiscovered,
      qualified: acc.qualified + r.jobsQualified,
      proposals: acc.proposals + r.proposalsGenerated,
      submitted: acc.submitted + r.bidsSubmitted,
      cost: acc.cost + Number(r.aiCostUsd),
    }),
    { discovered: 0, qualified: 0, proposals: 0, submitted: 0, cost: 0 },
  );

  const [awaitingApproval] = await db
    .select({ n: count() })
    .from(schema.proposals)
    .where(eq(schema.proposals.status, "awaiting_approval"));

  const [responsesToday] = await db
    .select({ n: count() })
    .from(schema.clientResponses)
    .where(gte(schema.clientResponses.receivedAt, startOfDay));

  return { runs, totals, awaitingApproval: awaitingApproval.n, responsesToday: responsesToday.n };
}

export async function monthlyAiSpend(): Promise<{ spent: number; limit: number }> {
  const month = currentMonth();
  const row = await db.query.monthlyBudgets.findFirst({
    where: and(
      eq(schema.monthlyBudgets.month, month),
      eq(schema.monthlyBudgets.category, "openai"),
    ),
  });
  return { spent: row ? Number(row.spentUsd) : 0, limit: row ? Number(row.limitUsd) : 5 };
}

export async function analyticsSummary() {
  const [jobCounts] = await db
    .select({
      total: count(),
      submitted: dsql<number>`count(*) filter (where status = 'submitted')::int`,
      qualified: dsql<number>`count(*) filter (where status in ('qualified','proposal_generated','awaiting_approval','ready_for_manual_submission','submitted','won','lost'))::int`,
      won: dsql<number>`count(*) filter (where status = 'won')::int`,
    })
    .from(schema.jobs);

  const [proposalCount] = await db.select({ n: count() }).from(schema.proposals);
  const [responseCount] = await db.select({ n: count() }).from(schema.clientResponses);

  const [revenue] = await db
    .select({
      estimated: sum(schema.jobOutcomes.estimatedRevenueUsd),
      actual: sum(schema.jobOutcomes.actualRevenueUsd),
    })
    .from(schema.jobOutcomes)
    .where(eq(schema.jobOutcomes.won, true));

  const [aiSpendAll] = await db
    .select({ total: sum(schema.apiUsage.actualCostUsd) })
    .from(schema.apiUsage);

  const byPlatform = await db
    .select({
      platform: schema.jobs.sourceKey,
      discovered: count(),
      submitted: dsql<number>`count(*) filter (where status = 'submitted')::int`,
      won: dsql<number>`count(*) filter (where status = 'won')::int`,
    })
    .from(schema.jobs)
    .groupBy(schema.jobs.sourceKey);

  const byCategory = await db
    .select({
      category: dsql<string>`coalesce(category, 'uncategorized')`,
      discovered: count(),
      won: dsql<number>`count(*) filter (where status = 'won')::int`,
    })
    .from(schema.jobs)
    .groupBy(dsql`coalesce(category, 'uncategorized')`);

  const submitted = jobCounts.submitted + jobCounts.won;
  return {
    jobs: jobCounts,
    proposals: proposalCount.n,
    responses: responseCount.n,
    responseRate: submitted > 0 ? responseCount.n / submitted : null,
    winRate: submitted > 0 ? jobCounts.won / submitted : null,
    estimatedRevenue: Number(revenue.estimated ?? 0),
    actualRevenue: Number(revenue.actual ?? 0),
    aiSpendTotal: Number(aiSpendAll.total ?? 0),
    byPlatform,
    byCategory,
  };
}
