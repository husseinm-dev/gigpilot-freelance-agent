"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "@/lib/actions";

interface BudgetFormData {
  monthlyOpenAiBudgetUsd: number;
  monthlyMarketplaceBudgetUsd: number;
  budgetSafetyBufferUsd: number;
  upworkConnectsBudgetUsd: number;
}

export function BudgetsForm({ initial }: { initial: BudgetFormData }) {
  const [form, setForm] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly limits (USD)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>OpenAI API</Label>
            <Input
              type="number" step="0.5"
              value={form.monthlyOpenAiBudgetUsd}
              onChange={(e) => { setForm({ ...form, monthlyOpenAiBudgetUsd: Number(e.target.value) }); setSaved(false); }}
            />
            <p className="text-xs text-muted-foreground">Default $5/month</p>
          </div>
          <div className="space-y-1.5">
            <Label>Upwork Connects budget</Label>
            <Input
              type="number" step="1"
              value={form.upworkConnectsBudgetUsd}
              onChange={(e) => { setForm({ ...form, upworkConnectsBudgetUsd: Number(e.target.value) }); setSaved(false); }}
            />
            <p className="text-xs text-muted-foreground">
              ~$0.15/Connect. Spending always requires your per-proposal approval; Connects are never purchased automatically.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Other marketplace credits</Label>
            <Input
              type="number" step="1"
              value={form.monthlyMarketplaceBudgetUsd}
              onChange={(e) => { setForm({ ...form, monthlyMarketplaceBudgetUsd: Number(e.target.value) }); setSaved(false); }}
            />
            <p className="text-xs text-muted-foreground">Default $0 — free platforms are prioritized</p>
          </div>
          <div className="space-y-1.5">
            <Label>Safety buffer</Label>
            <Input
              type="number" step="0.1"
              value={form.budgetSafetyBufferUsd}
              onChange={(e) => { setForm({ ...form, budgetSafetyBufferUsd: Number(e.target.value) }); setSaved(false); }}
            />
            <p className="text-xs text-muted-foreground">Reserved headroom to prevent overshoot</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateSettings({
                monthlyOpenAiBudgetUsd: form.monthlyOpenAiBudgetUsd,
                monthlyMarketplaceBudgetUsd: form.monthlyMarketplaceBudgetUsd,
                budgetSafetyBufferUsd: form.budgetSafetyBufferUsd,
                platformCreditBudgetsUsd: { upwork: form.upworkConnectsBudgetUsd },
              });
              setSaved(true);
            })
          }
        >
          {pending ? "Saving…" : "Save budgets"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
      </div>
    </div>
  );
}
