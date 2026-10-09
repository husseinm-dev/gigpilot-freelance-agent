import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { todayStats, monthlyAiSpend } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PauseForm } from "@/components/pause-form";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, spend, settings, sources, recentEvents] = await Promise.all([
    todayStats(),
    monthlyAiSpend(),
    getSettings(),
    db.query.jobSources.findMany(),
    db.query.automationEvents.findMany({
      orderBy: [desc(schema.automationEvents.createdAt)],
      limit: 12,
    }),
  ]);

  const enabledSources = sources.filter((s) => s.enabled);
  const healthyCount = enabledSources.filter((s) => !s.lastError).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Today&apos;s automation activity</p>
        </div>
        <div className="flex items-center gap-3">
          {settings.paused ? <StatusBadge status="failed" className="bg-amber-100 text-amber-800" /> : null}
          <PauseForm paused={settings.paused} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Jobs discovered" value={stats.totals.discovered} />
        <StatCard label="Qualified" value={stats.totals.qualified} />
        <StatCard label="Proposals" value={stats.totals.proposals} />
        <StatCard label="Bids submitted" value={stats.totals.submitted} />
        <StatCard label="Awaiting approval" value={stats.awaitingApproval} sub="needs your review" />
        <StatCard
          label="Monthly AI spend"
          value={`$${spend.spent.toFixed(2)}`}
          sub={`of $${spend.limit.toFixed(2)} budget`}
        />
      </div>

      {stats.awaitingApproval > 0 ? (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardContent className="pt-4 flex items-center justify-between">
            <p className="text-sm">
              <strong>{stats.awaitingApproval}</strong> proposal{stats.awaitingApproval === 1 ? "" : "s"} waiting for
              your approval.
            </p>
            <Button asChild size="sm">
              <Link href="/approvals">Review now</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs today yet. Next scheduled runs: 9:00 AM and 6:00 PM ET.</p>
            ) : (
              stats.runs.map((run) => (
                <div key={run.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                  <span className="font-mono text-xs">{run.slotKey ?? run.trigger}</span>
                  <span className="text-muted-foreground">
                    {run.jobsDiscovered} jobs · {run.proposalsGenerated} proposals · ${Number(run.aiCostUsd).toFixed(3)}
                  </span>
                  <StatusBadge status={run.status} />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integration health</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">
              {healthyCount}/{enabledSources.length} enabled sources healthy
            </p>
            <div className="space-y-1.5">
              {enabledSources.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  {s.lastError ? (
                    <span className="text-xs text-rose-600 truncate max-w-48" title={s.lastError}>
                      {s.lastError}
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-600">
                      {s.lastSyncAt ? `synced ${s.lastSyncAt.toLocaleString()}` : "ok"}
                    </span>
                  )}
                </div>
              ))}
              {enabledSources.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No sources enabled. <Link className="underline" href="/integrations">Enable sources →</Link>
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent automation log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentEvents.map((e) => (
            <div key={e.id} className="flex gap-3 text-xs font-mono">
              <span className="text-muted-foreground shrink-0">{e.createdAt.toLocaleString()}</span>
              <span className={e.level === "error" ? "text-rose-600" : e.level === "warn" ? "text-amber-600" : ""}>
                {e.worker ? `[${e.worker}] ` : ""}{e.message}
              </span>
            </div>
          ))}
          {recentEvents.length === 0 ? <p className="text-sm text-muted-foreground">No events yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
