import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const attempts = await db.query.submissionAttempts.findMany({
    orderBy: [desc(schema.submissionAttempts.startedAt)],
    limit: 100,
  });

  const [jobs, confirmations] = await Promise.all([
    attempts.length
      ? db.query.jobs.findMany({ where: inArray(schema.jobs.id, attempts.map((a) => a.jobId)) })
      : Promise.resolve([]),
    attempts.length
      ? db.query.submissionConfirmations.findMany({
          where: inArray(schema.submissionConfirmations.attemptId, attempts.map((a) => a.id)),
        })
      : Promise.resolve([]),
  ]);
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const confirmByAttempt = new Map(confirmations.map((c) => [c.attemptId, c]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Submissions</h1>
        <p className="text-sm text-muted-foreground">
          Every bid attempt with its external confirmation. Only platform-confirmed bids are marked SUBMITTED.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Confirmation</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attempts.map((a) => {
            const job = jobById.get(a.jobId);
            const confirmation = confirmByAttempt.get(a.id);
            return (
              <TableRow key={a.id}>
                <TableCell className="max-w-64">
                  <Link href={`/jobs/${a.jobId}`} className="hover:underline truncate block">
                    {job?.title ?? a.jobId}
                  </Link>
                  {a.errorDetails ? <p className="text-xs text-rose-600 truncate">{a.errorDetails}</p> : null}
                </TableCell>
                <TableCell>{a.platform}</TableCell>
                <TableCell className="text-xs">{a.mode}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="text-xs">
                  {confirmation?.externalConfirmationUrl ? (
                    <a href={confirmation.externalConfirmationUrl} target="_blank" rel="noopener noreferrer" className="underline">
                      {confirmation.externalConfirmationId ?? "link"} ↗
                    </a>
                  ) : (
                    confirmation?.externalConfirmationId ?? "—"
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.startedAt.toLocaleString()}</TableCell>
              </TableRow>
            );
          })}
          {attempts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                No submission attempts yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
