"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { recordOutcome } from "@/lib/actions";

export function OutcomeForm({ jobId }: { jobId: string }) {
  const [estimated, setEstimated] = useState("");
  const [actual, setActual] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium">Record outcome:</span>
      <Input className="h-8 w-36" type="number" placeholder="Est. revenue $" value={estimated} onChange={(e) => setEstimated(e.target.value)} />
      <Input className="h-8 w-36" type="number" placeholder="Actual revenue $" value={actual} onChange={(e) => setActual(e.target.value)} />
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() =>
            recordOutcome({
              jobId,
              won: true,
              estimatedRevenueUsd: estimated || undefined,
              actualRevenueUsd: actual || undefined,
            }),
          )
        }
      >
        🎉 Won
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => recordOutcome({ jobId, won: false }))}
      >
        Lost
      </Button>
    </div>
  );
}
