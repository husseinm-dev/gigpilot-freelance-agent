import { getSettings } from "@/lib/settings";
import { getBudgetSnapshot } from "@/lib/costs/budget";
import { StatCard } from "@/components/stat-card";
import { BudgetsForm } from "@/components/budgets-form";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const settings = await getSettings();
  const openai = await getBudgetSnapshot("openai");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
        <p className="text-sm text-muted-foreground">
          Hard application-level limits. When a budget is exhausted, AI calls stop — no model upgrades, no
          overshoot, no automatic credit purchases. Ever.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="OpenAI spent" value={`$${openai.spentUsd.toFixed(3)}`} sub={`${openai.month}`} />
        <StatCard label="Reserved" value={`$${openai.reservedUsd.toFixed(3)}`} sub="in-flight calls" />
        <StatCard label="Remaining" value={`$${openai.remainingUsd.toFixed(2)}`} sub={`buffer $${openai.safetyBufferUsd}`} />
        <StatCard label="Limit" value={`$${openai.limitUsd.toFixed(2)}`} sub="per calendar month" />
      </div>

      <BudgetsForm
        initial={{
          monthlyOpenAiBudgetUsd: settings.monthlyOpenAiBudgetUsd,
          monthlyMarketplaceBudgetUsd: settings.monthlyMarketplaceBudgetUsd,
          budgetSafetyBufferUsd: settings.budgetSafetyBufferUsd,
          upworkConnectsBudgetUsd: settings.platformCreditBudgetsUsd["upwork"] ?? 0,
        }}
      />
    </div>
  );
}
