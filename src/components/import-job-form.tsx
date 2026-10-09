"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { importJobManually } from "@/lib/actions";

export function ImportJobForm({ sources }: { sources: { key: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    sourceKey: "manual",
    url: "",
    title: "",
    description: "",
    budgetMinUsd: "",
    budgetMaxUsd: "",
  });

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Import job
      </Button>
    );
  }

  return (
    <Card className="fixed inset-x-4 top-10 z-50 mx-auto max-w-xl shadow-xl max-h-[85vh] overflow-auto">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Import a job manually</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>✕</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Platform</Label>
          <select
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            value={form.sourceKey}
            onChange={(e) => setForm({ ...form, sourceKey: e.target.value })}
          >
            {sources.map((s) => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Listing URL</Label>
          <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" />
        </div>
        <div className="space-y-1.5">
          <Label>Title *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Description *</Label>
          <Textarea
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Paste the full job description…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Budget min ($)</Label>
            <Input type="number" value={form.budgetMinUsd} onChange={(e) => setForm({ ...form, budgetMinUsd: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Budget max ($)</Label>
            <Input type="number" value={form.budgetMaxUsd} onChange={(e) => setForm({ ...form, budgetMaxUsd: e.target.value })} />
          </div>
        </div>
        <Button
          className="w-full"
          disabled={pending || !form.title || form.description.length < 20}
          onClick={() =>
            startTransition(async () => {
              await importJobManually({
                ...form,
                budgetMinUsd: form.budgetMinUsd || undefined,
                budgetMaxUsd: form.budgetMaxUsd || undefined,
              });
              setOpen(false);
              setForm({ sourceKey: "manual", url: "", title: "", description: "", budgetMinUsd: "", budgetMaxUsd: "" });
            })
          }
        >
          {pending ? "Importing…" : "Import job"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Imported jobs go through the same qualification → proposal → approval pipeline on the next run.
        </p>
      </CardContent>
    </Card>
  );
}
