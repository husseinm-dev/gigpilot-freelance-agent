import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Automation limits and behavior. These are caps, not quotas — the agent never pads output to hit them.
        </p>
        <div className="flex gap-3 mt-3 text-sm">
          <Link className="underline" href="/settings/business">Business profile →</Link>
          <Link className="underline" href="/settings/budgets">Budgets →</Link>
        </div>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
