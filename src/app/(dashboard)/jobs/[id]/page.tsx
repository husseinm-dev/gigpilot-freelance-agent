import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddResponseForm } from "@/components/add-response-form";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, id) });
  if (!job) notFound();

  const [scores, evaluations, proposal, responses] = await Promise.all([
    db.query.jobScores.findMany({ where: eq(schema.jobScores.jobId, id), orderBy: [desc(schema.jobScores.createdAt)], limit: 1 }),
    db.query.jobEvaluations.findMany({ where: eq(schema.jobEvaluations.jobId, id), orderBy: [desc(schema.jobEvaluations.createdAt)], limit: 1 }),
    db.query.proposals.findFirst({ where: eq(schema.proposals.jobId, id) }),
    db.query.clientResponses.findMany({ where: eq(schema.clientResponses.jobId, id), orderBy: [desc(schema.clientResponses.receivedAt)] }),
  ]);
  const score = scores[0];
  const evaluation = evaluations[0];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{job.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {job.sourceKey} · {job.budgetMinUsd || job.budgetMaxUsd
              ? `$${Number(job.budgetMinUsd ?? 0).toFixed(0)}–$${Number(job.budgetMaxUsd ?? job.budgetMinUsd ?? 0).toFixed(0)} (${job.budgetType})`
              : "budget unknown"}
            {job.connectsRequired ? ` · ~${job.connectsRequired} Connects (~$${Number(job.applicationCostUsd).toFixed(2)})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {job.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={job.url} target="_blank" rel="noopener noreferrer">View listing ↗</a>
            </Button>
          ) : null}
        </div>
      </div>

      {job.statusReason ? <p className="text-sm text-muted-foreground">Status reason: {job.statusReason}</p> : null}

      <div className="grid md:grid-cols-2 gap-4">
        {score ? (
          <Card>
            <CardHeader><CardTitle className="text-base">Deterministic score</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>Overall: <strong>{score.deterministicScore}/100</strong> {score.passed ? "✅ passed" : "❌ failed"}</p>
              <p className="text-muted-foreground">
                Tech {score.techMatchScore} · Budget {score.budgetScore} · Recency {score.recencyScore} · Client {score.clientScore}
              </p>
              {score.rejectionReasons.length > 0 ? (
                <ul className="list-disc ml-4 text-rose-600">
                  {score.rejectionReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {evaluation ? (
          <Card>
            <CardHeader><CardTitle className="text-base">AI evaluation</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p>
                Score: <strong>{evaluation.score}/100</strong> · {evaluation.recommendation} ·{" "}
                {evaluation.confidence} confidence
              </p>
              <p className="text-muted-foreground">
                Est. {evaluation.estimatedHours}h · suggested bid ${Number(evaluation.suggestedBidUsd).toFixed(0)} ·
                cost ${Number(evaluation.costUsd).toFixed(4)}
              </p>
              <div>
                <p className="font-medium mt-2">Reasons</p>
                <ul className="list-disc ml-4">{evaluation.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
              {evaluation.risks.length > 0 ? (
                <div>
                  <p className="font-medium mt-2">Risks</p>
                  <ul className="list-disc ml-4 text-amber-700">{evaluation.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{job.description}</p>
          {job.skillsRequired.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-3">Skills: {job.skillsRequired.join(", ")}</p>
          ) : null}
        </CardContent>
      </Card>

      {proposal ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Proposal</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href={`/proposals/${proposal.id}`}>Open proposal →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <StatusBadge status={proposal.status} />
            <p className="text-sm whitespace-pre-wrap mt-3 line-clamp-6">{proposal.coverLetter}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle className="text-base">Client responses</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {responses.map((r) => (
            <div key={r.id} className="border rounded-md p-3 text-sm">
              <div className="flex justify-between">
                <StatusBadge status={r.type} className="bg-blue-100 text-blue-800" />
                <span className="text-xs text-muted-foreground">{r.receivedAt.toLocaleString()}</span>
              </div>
              {r.content ? <p className="mt-2 whitespace-pre-wrap">{r.content}</p> : null}
            </div>
          ))}
          <AddResponseForm jobId={job.id} />
        </CardContent>
      </Card>
    </div>
  );
}
