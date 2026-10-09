import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApprovalCard } from "@/components/approval-card";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const pending = await db.query.proposals.findMany({
    where: inArray(schema.proposals.status, ["awaiting_approval", "ready_for_manual_submission"]),
    orderBy: [desc(schema.proposals.createdAt)],
  });

  const jobs = pending.length
    ? await db.query.jobs.findMany({
        where: inArray(schema.jobs.id, pending.map((p) => p.jobId)),
      })
    : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const evaluations = pending.length
    ? await db.query.jobEvaluations.findMany({
        where: inArray(schema.jobEvaluations.jobId, pending.map((p) => p.jobId)),
      })
    : [];
  const evalByJob = new Map(evaluations.map((e) => [e.jobId, e]));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} proposal{pending.length === 1 ? "" : "s"} waiting for review. Nothing is ever
          submitted or spent without your approval.
        </p>
      </div>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            All clear — no proposals waiting. New ones appear here after each automation run.
            <div className="mt-3">
              <Button asChild variant="outline" size="sm"><Link href="/jobs">Browse jobs</Link></Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        pending.map((p) => {
          const job = jobById.get(p.jobId);
          const evaluation = evalByJob.get(p.jobId);
          return (
            <ApprovalCard
              key={p.id}
              proposal={{
                id: p.id,
                status: p.status,
                coverLetter: p.coverLetter,
                bidAmountUsd: p.bidAmountUsd ? Number(p.bidAmountUsd) : undefined,
                estimatedDays: p.estimatedDays ?? undefined,
              }}
              job={
                job
                  ? {
                      id: job.id,
                      title: job.title,
                      sourceKey: job.sourceKey,
                      url: job.url ?? undefined,
                      budgetMin: job.budgetMinUsd ? Number(job.budgetMinUsd) : undefined,
                      budgetMax: job.budgetMaxUsd ? Number(job.budgetMaxUsd) : undefined,
                      connectsRequired: job.connectsRequired ?? undefined,
                    }
                  : undefined
              }
              aiScore={evaluation?.score}
            />
          );
        })
      )}
    </div>
  );
}
