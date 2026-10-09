"use client";

import { useTransition } from "react";
import { Switch } from "@/components/ui/switch";
import { toggleSource } from "@/lib/actions";

export function SourceToggle({ sourceKey, enabled }: { sourceKey: string; enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
      <Switch
        checked={enabled}
        disabled={pending}
        onCheckedChange={(checked) => startTransition(() => toggleSource(sourceKey, checked))}
      />
    </div>
  );
}
