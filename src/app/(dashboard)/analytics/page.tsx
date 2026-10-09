import { analyticsSummary, monthlyAiSpend } from "@/lib/queries";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const [summary, spend] = await Promise.all([analyticsSummary(), monthlyAiSpend()]);

  const pct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          All numbers reflect real recorded activity — nothing is estimated or invented.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <StatCard label="Jobs discovered" value={summary.jobs.total} />
        <StatCard label="Jobs qualified" value={summary.jobs.qualified} />
        <StatCard label="Proposals generated" value={summary.proposals} />
        <StatCard label="Bids submitted" value={summary.jobs.submitted + summary.jobs.won} />
        <StatCard label="Client responses" value={summary.responses} />
        <StatCard label="Response rate" value={pct(summary.responseRate)} sub="responses / submitted" />
        <StatCard label="Win rate" value={pct(summary.winRate)} sub="won / submitted" />
        <StatCard label="Jobs won" value={summary.jobs.won} />
        <StatCard
          label="Revenue (actual)"
          value={`$${summary.actualRevenue.toFixed(0)}`}
          sub={`est. $${summary.estimatedRevenue.toFixed(0)} — manually entered`}
        />
        <StatCard
          label="AI spend"
          value={`$${spend.spent.toFixed(2)} this month`}
          sub={`$${summary.aiSpendTotal.toFixed(2)} all-time`}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Performance by platform</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="text-right">Discovered</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byPlatform.map((p) => (
                  <TableRow key={p.platform}>
                    <TableCell>{p.platform}</TableCell>
                    <TableCell className="text-right">{p.discovered}</TableCell>
                    <TableCell className="text-right">{p.submitted}</TableCell>
                    <TableCell className="text-right">{p.won}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Performance by category</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Discovered</TableHead>
                  <TableHead className="text-right">Won</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.byCategory.map((c) => (
                  <TableRow key={c.category}>
                    <TableCell>{c.category}</TableCell>
                    <TableCell className="text-right">{c.discovered}</TableCell>
                    <TableCell className="text-right">{c.won}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
