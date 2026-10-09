import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProposalActions } from "@/components/proposal-actions";

export const dynamic = "force-dynamic";

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, id) });
  if (!proposal) notFound();

  const [job, versions] = await Promise.all([
    db.query.jobs.findFirst({ where: eq(schema.jobs.id, proposal.jobId) }),
    db.query.proposalVersions.findMany({
      where: eq(schema.proposalVersions.proposalId, id),
      orderBy: [desc(schema.proposalVersions.version)],
    }),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{job?.title ?? "Proposal"}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {job?.sourceKey} · bid ${Number(proposal.bidAmountUsd ?? 0).toFixed(0)} ({proposal.bidType})
            {proposal.estimatedDays ? ` · ${proposal.estimatedDays} days` : ""}
            {proposal.model ? ` · ${proposal.model}` : ""}
            {proposal.costUsd ? ` · $${Number(proposal.costUsd).toFixed(4)} AI cost` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={proposal.status} />
          {job ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/jobs/${job.id}`}>Job details</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <ProposalActions
        proposal={{
          id: proposal.id,
          status: proposal.status,
          coverLetter: proposal.coverLetter,
          bidAmountUsd: proposal.bidAmountUsd ? Number(proposal.bidAmountUsd) : undefined,
        }}
        jobUrl={job?.url ?? undefined}
        connectsRequired={job?.connectsRequired ?? undefined}
      />

      {proposal.clarifyingQuestion ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Suggested clarifying question</CardTitle></CardHeader>
          <CardContent><p className="text-sm">{proposal.clarifyingQuestion}</p></CardContent>
        </Card>
      ) : null}

      {versions.length > 1 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Version history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {versions.map((v) => (
              <div key={v.id} className="border rounded-md p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">
                  v{v.version} · {v.editedBy} · {v.createdAt.toLocaleString()}
                </p>
                <p className="whitespace-pre-wrap line-clamp-4">{v.coverLetter}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
