"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { togglePause } from "@/lib/actions";

export function PauseForm({ paused }: { paused: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant={paused ? "default" : "outline"}
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => togglePause(!paused))}
    >
      {pending ? "…" : paused ? "▶ Resume automation" : "⏸ Pause automation"}
    </Button>
  );
}
