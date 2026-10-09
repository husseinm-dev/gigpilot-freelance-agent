"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function JobFilters({ platforms }: { platforms: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/jobs?${next.toString()}`);
  }

  const statuses = [
    "discovered", "filtered_out", "qualified", "disqualified", "proposal_generated",
    "awaiting_approval", "ready_for_manual_submission", "submitted", "won", "lost",
  ];

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <select
        className="h-9 rounded-md border bg-transparent px-2 text-sm"
        value={params.get("platform") ?? ""}
        onChange={(e) => setParam("platform", e.target.value)}
      >
        <option value="">All platforms</option>
        {platforms.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select
        className="h-9 rounded-md border bg-transparent px-2 text-sm"
        value={params.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        <option value="">All statuses</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
        ))}
      </select>
      <Input
        className="h-9 w-32"
        placeholder="Min budget"
        type="number"
        defaultValue={params.get("minBudget") ?? ""}
        onBlur={(e) => setParam("minBudget", e.target.value)}
      />
      <Input
        className="h-9 w-32"
        placeholder="Max budget"
        type="number"
        defaultValue={params.get("maxBudget") ?? ""}
        onBlur={(e) => setParam("maxBudget", e.target.value)}
      />
      <Input
        className="h-9 w-40"
        placeholder="Technology…"
        defaultValue={params.get("tech") ?? ""}
        onBlur={(e) => setParam("tech", e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setParam("tech", (e.target as HTMLInputElement).value);
        }}
      />
      <Input
        className="h-9 w-40"
        type="date"
        defaultValue={params.get("since") ?? ""}
        onChange={(e) => setParam("since", e.target.value)}
      />
    </div>
  );
}
