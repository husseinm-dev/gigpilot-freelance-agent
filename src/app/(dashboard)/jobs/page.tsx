import Link from "next/link";
import { and, desc, eq, gte, lte, SQL } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { JobFilters } from "@/components/job-filters";
import { ImportJobForm } from "@/components/import-job-form";

export const dynamic = "force-dynamic";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const conditions: SQL[] = [];

  if (params.platform) conditions.push(eq(schema.jobs.sourceKey, params.platform));
  if (params.status) conditions.push(eq(schema.jobs.status, params.status as typeof schema.jobs.$inferSelect.status));
  if (params.minBudget) conditions.push(gte(schema.jobs.budgetMaxUsd, params.minBudget));
  if (params.maxBudget) conditions.push(lte(schema.jobs.budgetMaxUsd, params.maxBudget));
  if (params.since) conditions.push(gte(schema.jobs.discoveredAt, new Date(params.since)));

  const jobs = await db.query.jobs.findMany({
    where: conditions.length ? and(...conditions) : undefined,
    orderBy: [desc(schema.jobs.discoveredAt)],
    limit: 100,
  });

  const sources = await db.query.jobSources.findMany();

  const filtered = params.tech
    ? jobs.filter((j) =>
        `${j.title} ${j.skillsRequired.join(" ")}`.toLowerCase().includes(params.tech!.toLowerCase()),
      )
    : jobs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} listings</p>
        </div>
        <ImportJobForm sources={sources.map((s) => ({ key: s.key, name: s.name }))} />
      </div>

      <JobFilters platforms={sources.map((s) => s.key)} />

      <div className="space-y-2">
        {filtered.map((job) => (
          <Card key={job.id} className="hover:bg-muted/40 transition-colors">
            <CardContent className="py-3 px-4">
              <Link href={`/jobs/${job.id}`} className="block">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{job.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {job.sourceKey} · {job.budgetMinUsd || job.budgetMaxUsd
                        ? `$${Number(job.budgetMinUsd ?? 0).toFixed(0)}–$${Number(job.budgetMaxUsd ?? job.budgetMinUsd ?? 0).toFixed(0)}`
                        : "budget unknown"}{" "}
                      · discovered {job.discoveredAt.toLocaleDateString()}
                      {job.connectsRequired ? ` · ~${job.connectsRequired} Connects` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{job.description}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              </Link>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No jobs match. Enable sources in Integrations, run the agent, or import a job manually.
          </p>
        ) : null}
      </div>
    </div>
  );
}
