import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { getSettings } from "@/lib/settings";
import { StatusBadge } from "@/components/status-badge";
import { PauseForm } from "@/components/pause-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const [settings, runs, events] = await Promise.all([
    getSettings(),
    db.query.automationRuns.findMany({ orderBy: [desc(schema.automationRuns.startedAt)], limit: 30 }),
    db.query.automationEvents.findMany({ orderBy: [desc(schema.automationEvents.createdAt)], limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation</h1>
          <p className="text-sm text-muted-foreground">
            Scheduled: 9:00 AM & 6:00 PM America/New_York via GitHub Actions (DST-aware).
          </p>
        </div>
        <PauseForm paused={settings.paused} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Manual run</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Trigger a run from GitHub: <strong>Actions → GigPilot Automation → Run workflow</strong> (choose
            <code className="mx-1 bg-muted px-1 rounded">manual</code> or
            <code className="mx-1 bg-muted px-1 rounded">dry-run</code>).
          </p>
          <p className="text-muted-foreground">
            Locally: <code className="bg-muted px-1 rounded">npm run agent:manual</code> ·{" "}
            <code className="bg-muted px-1 rounded">npm run agent:dry-run</code> ·{" "}
            <code className="bg-muted px-1 rounded">npm run agent:test-integrations</code>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Run history</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Slot</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Jobs</TableHead>
                <TableHead className="text-right">Proposals</TableHead>
                <TableHead className="text-right">Bids</TableHead>
                <TableHead className="text-right">AI cost</TableHead>
                <TableHead>Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.slotKey ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.trigger}{r.dryRun ? " (dry)" : ""}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right">{r.jobsDiscovered}</TableCell>
                  <TableCell className="text-right">{r.proposalsGenerated}</TableCell>
                  <TableCell className="text-right">{r.bidsSubmitted}</TableCell>
                  <TableCell className="text-right">${Number(r.aiCostUsd).toFixed(3)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.startedAt.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {runs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">No runs yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Event log</CardTitle></CardHeader>
        <CardContent className="space-y-1 max-h-96 overflow-auto">
          {events.map((e) => (
            <div key={e.id} className="flex gap-3 text-xs font-mono">
              <span className="text-muted-foreground shrink-0">{e.createdAt.toLocaleString()}</span>
              <span className={e.level === "error" ? "text-rose-600" : e.level === "warn" ? "text-amber-600" : ""}>
                {e.worker ? `[${e.worker}] ` : ""}{e.message}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
