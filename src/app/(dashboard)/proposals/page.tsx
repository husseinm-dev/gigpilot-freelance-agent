import Link from "next/link";
import { desc } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  const proposals = await db.query.proposals.findMany({
    orderBy: [desc(schema.proposals.createdAt)],
    limit: 100,
  });
  const jobIds = proposals.map((p) => p.jobId);
  const jobs = jobIds.length
    ? await db.query.jobs.findMany()
    : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Proposals</h1>
        <p className="text-sm text-muted-foreground">{proposals.length} generated</p>
      </div>

      <div className="space-y-2">
        {proposals.map((p) => {
          const job = jobById.get(p.jobId);
          return (
            <Card key={p.id} className="hover:bg-muted/40 transition-colors">
              <CardContent className="py-3 px-4">
                <Link href={`/proposals/${p.id}`} className="block">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{job?.title ?? "Unknown job"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {job?.sourceKey} · bid ${Number(p.bidAmountUsd ?? 0).toFixed(0)} ({p.bidType}) ·{" "}
                        {p.estimatedDays ? `${p.estimatedDays} days · ` : ""}
                        {p.createdAt.toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{p.coverLetter}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                </Link>
              </CardContent>
            </Card>
          );
        })}
        {proposals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No proposals yet. They appear after qualification runs.</p>
        ) : null}
      </div>
    </div>
  );
}
