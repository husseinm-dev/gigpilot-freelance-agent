import { db } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SourceToggle } from "@/components/source-toggle";
import { allAdapters } from "@/worker/sources/registry";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const sources = await db.query.jobSources.findMany();
  const sourceByKey = new Map(sources.map((s) => [s.key, s]));
  const adapters = allAdapters();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Capability reports are honest: an integration only claims what has actually been implemented and
          verified. Run <code className="bg-muted px-1 rounded">npm run agent:test-integrations</code> to verify
          connectivity. Run <code className="bg-muted px-1 rounded">npm run db:seed</code> if a source is missing.
        </p>
      </div>

      {adapters.map((adapter) => {
        const caps = adapter.capabilities();
        const row = sourceByKey.get(caps.key);
        return (
          <Card key={caps.key}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{caps.name}</CardTitle>
                <div className="flex items-center gap-3">
                  <StatusBadge status={row?.integrationStatus ?? caps.integrationStatus} />
                  {row ? <SourceToggle sourceKey={caps.key} enabled={row.enabled} /> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Discovery: {caps.discoverySupported ? "✅" : "—"}</span>
                <span>Official API: {caps.officialApi ? "✅" : "—"}</span>
                <span>Auth required: {caps.authRequired ? "🔑" : "—"}</span>
                <span>Auto-submission: {caps.submissionSupported ? "✅" : "—"}</span>
                <span>Human confirmation: {caps.humanConfirmationRequired ? "required" : "not required"}</span>
                <span>Application cost: {caps.applicationCostModel}</span>
                <span>Tested: {row?.tested ? "✅ verified" : "not yet verified"}</span>
              </div>
              {row?.lastError ? <p className="text-xs text-rose-600">Last error: {row.lastError}</p> : null}
              {row?.lastSyncAt ? (
                <p className="text-xs text-muted-foreground">Last sync: {row.lastSyncAt.toLocaleString()}</p>
              ) : null}
              <ul className="list-disc ml-4 text-xs text-muted-foreground">
                {caps.limitations.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
