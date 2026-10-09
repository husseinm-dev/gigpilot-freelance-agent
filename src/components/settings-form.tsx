"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateSettings } from "@/lib/actions";
import type { AutomationSettings } from "@/lib/settings-schema";

const NUMBER_FIELDS: { key: keyof AutomationSettings; label: string; step?: string }[] = [
  { key: "maxJobsPerRun", label: "Max collected jobs per run" },
  { key: "maxEvaluationsPerRun", label: "Max AI evaluations per run" },
  { key: "maxProposalsPerRun", label: "Max generated proposals per run" },
  { key: "maxBidsPerRun", label: "Max submitted bids per run" },
  { key: "maxBidsPerDay", label: "Max submitted bids per day" },
  { key: "minBudgetUsd", label: "Minimum project budget ($)" },
  { key: "preferredBudgetMinUsd", label: "Preferred budget min ($)" },
  { key: "preferredBudgetMaxUsd", label: "Preferred budget max ($)" },
  { key: "minQualificationScore", label: "Minimum AI qualification score (0-100)" },
  { key: "minDeterministicScore", label: "Minimum deterministic score (0-100)" },
  { key: "maxJobAgeHours", label: "Max job age (hours)" },
  { key: "proposalMinWords", label: "Proposal min words" },
  { key: "proposalMaxWords", label: "Proposal max words" },
];

export function SettingsForm({ initial }: { initial: AutomationSettings }) {
  const [form, setForm] = useState<AutomationSettings>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function set<K extends keyof AutomationSettings>(key: K, value: AutomationSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Run limits</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {NUMBER_FIELDS.map(({ key, label }) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                value={String(form[key])}
                onChange={(e) => set(key, Number(e.target.value) as never)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Submission & AI</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Submission mode</Label>
            <select
              className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
              value={form.submissionMode}
              onChange={(e) => set("submissionMode", e.target.value as AutomationSettings["submissionMode"])}
            >
              <option value="disabled">DISABLED — never submit</option>
              <option value="approval_required">APPROVAL_REQUIRED — queue for my review (recommended)</option>
              <option value="autonomous">AUTONOMOUS — only on tested platforms that permit it</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Autonomous mode only ever applies to platforms whose adapter supports unattended bidding AND have a
              recorded successful integration test. Upwork always requires your confirmation.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Evaluation model</Label>
              <Input value={form.evaluationModel} onChange={(e) => set("evaluationModel", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Proposal model</Label>
              <Input value={form.proposalModel} onChange={(e) => set("proposalModel", e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.preferFreeApplicationSources}
              onChange={(e) => set("preferFreeApplicationSources", e.target.checked)}
            />
            Prioritize free-to-apply platforms (recommended — keeps acquisition cost near $0)
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateSettings(form);
              setSaved(true);
            })
          }
        >
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {saved ? <span className="text-sm text-emerald-600">Saved ✓</span> : null}
      </div>
    </div>
  );
}
