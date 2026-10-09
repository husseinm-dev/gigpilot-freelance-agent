import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { OutcomeForm } from "@/components/outcome-form";

export const dynamic = "force-dynamic";

export default async function ResponsesPage() {
  const responses = await db.query.clientResponses.findMany({
    orderBy: [desc(schema.clientResponses.receivedAt)],
    limit: 100,
  });
  const jobs = responses.length
    ? await db.query.jobs.findMany({
        where: inArray(schema.jobs.id, responses.map((r) => r.jobId)),
      })
    : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client responses</h1>
        <p className="text-sm text-muted-foreground">
          Responses from authorized APIs plus ones you record manually on any job page.
        </p>
      </div>

      <div className="space-y-3">
        {responses.map((r) => {
          const job = jobById.get(r.jobId);
          return (
            <Card key={r.id}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/jobs/${r.jobId}`} className="font-medium hover:underline">
                      {job?.title ?? "Unknown job"}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {job?.sourceKey} · via {r.source} · {r.receivedAt.toLocaleString()}
                    </p>
                    {r.content ? <p className="text-sm mt-2 whitespace-pre-wrap">{r.content}</p> : null}
                  </div>
                  <StatusBadge status={r.type} className="bg-blue-100 text-blue-800 shrink-0" />
                </div>
                {r.type === "offer" && job ? (
                  <div className="mt-3 border-t pt-3">
                    <OutcomeForm jobId={job.id} />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
        {responses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No client responses recorded yet. Record them from a job page, or they arrive via authorized APIs.
          </p>
        ) : null}
      </div>
    </div>
  );
}
