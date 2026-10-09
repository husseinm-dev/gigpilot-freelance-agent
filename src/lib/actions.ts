"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/db/client";
import { getSession } from "@/lib/auth/session";
import { saveSettings as persistSettings, setPaused } from "@/lib/settings";
import { automationSettingsSchema } from "@/lib/settings-schema";
import { normalizeJob, contentHash } from "@/lib/normalize";
import { z } from "zod";

async function requireUser(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session.email;
}

async function audit(actor: string, action: string, entityType?: string, entityId?: string, details?: Record<string, unknown>) {
  await db.insert(schema.auditLogs).values({ actor, action, entityType, entityId, details }).catch(() => {});
}

// ---------------------------------------------------------------------------
// Proposals / approvals
// ---------------------------------------------------------------------------

export async function approveProposal(proposalId: string) {
  const actor = await requireUser();
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!proposal || proposal.status !== "awaiting_approval") throw new Error("Proposal not awaiting approval");

  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, proposal.jobId) });
  const source = job
    ? await db.query.jobSources.findFirst({ where: eq(schema.jobSources.key, job.sourceKey) })
    : null;

  // Platforms with tested programmatic submission → approved (worker submits
  // next run). Everything else → ready for manual submission immediately.
  const canAutoSubmit = Boolean(source?.submissionSupported && source.tested);
  const nextStatus = canAutoSubmit ? "approved" : "ready_for_manual_submission";

  await db
    .update(schema.proposals)
    .set({ status: nextStatus, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.proposals.id, proposalId));
  if (job) {
    await db
      .update(schema.jobs)
      .set({ status: canAutoSubmit ? "awaiting_approval" : "ready_for_manual_submission", updatedAt: new Date() })
      .where(eq(schema.jobs.id, job.id));
  }
  await audit(actor, "proposal_approved", "proposal", proposalId, { nextStatus });
  revalidatePath("/approvals");
  revalidatePath("/proposals");
}

export async function rejectProposal(proposalId: string, reason: string) {
  const actor = await requireUser();
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!proposal) throw new Error("Proposal not found");
  await db
    .update(schema.proposals)
    .set({ status: "rejected", rejectedReason: reason || "Rejected by user", updatedAt: new Date() })
    .where(eq(schema.proposals.id, proposalId));
  await db
    .update(schema.jobs)
    .set({ status: "rejected_by_user", statusReason: reason || "Rejected by user", updatedAt: new Date() })
    .where(eq(schema.jobs.id, proposal.jobId));
  await audit(actor, "proposal_rejected", "proposal", proposalId, { reason });
  revalidatePath("/approvals");
  revalidatePath("/proposals");
}

export async function updateProposalText(proposalId: string, coverLetter: string, bidAmountUsd?: number) {
  const actor = await requireUser();
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!proposal) throw new Error("Proposal not found");
  if (["submitted"].includes(proposal.status)) throw new Error("Cannot edit a submitted proposal");

  const versions = await db.query.proposalVersions.findMany({
    where: eq(schema.proposalVersions.proposalId, proposalId),
  });
  await db.insert(schema.proposalVersions).values({
    proposalId,
    version: versions.length + 1,
    coverLetter,
    bidAmountUsd: bidAmountUsd != null ? String(bidAmountUsd) : proposal.bidAmountUsd,
    editedBy: "user",
  });
  await db
    .update(schema.proposals)
    .set({
      coverLetter,
      bidAmountUsd: bidAmountUsd != null ? String(bidAmountUsd) : proposal.bidAmountUsd,
      updatedAt: new Date(),
    })
    .where(eq(schema.proposals.id, proposalId));
  await audit(actor, "proposal_edited", "proposal", proposalId);
  revalidatePath(`/proposals/${proposalId}`);
}

/** Record that you submitted a proposal manually on the platform. */
export async function markManuallySubmitted(proposalId: string, confirmationUrl?: string) {
  const actor = await requireUser();
  const proposal = await db.query.proposals.findFirst({ where: eq(schema.proposals.id, proposalId) });
  if (!proposal) throw new Error("Proposal not found");
  const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, proposal.jobId) });
  if (!job) throw new Error("Job not found");

  const idempotencyKey = `${job.sourceKey}:${job.externalId}`;
  const [attempt] = await db
    .insert(schema.submissionAttempts)
    .values({
      proposalId,
      jobId: job.id,
      platform: job.sourceKey,
      mode: "approval_required",
      idempotencyKey,
      status: "submitted",
      completedAt: new Date(),
    })
    .onConflictDoNothing({ target: [schema.submissionAttempts.idempotencyKey] })
    .returning({ id: schema.submissionAttempts.id });

  if (attempt) {
    await db.insert(schema.submissionConfirmations).values({
      attemptId: attempt.id,
      externalConfirmationUrl: confirmationUrl,
      raw: { manual: true, recordedBy: actor },
    });
  }

  await db.update(schema.proposals).set({ status: "submitted", updatedAt: new Date() }).where(eq(schema.proposals.id, proposalId));
  await db.update(schema.jobs).set({ status: "submitted", updatedAt: new Date() }).where(eq(schema.jobs.id, job.id));
  await audit(actor, "manual_submission_recorded", "proposal", proposalId, { confirmationUrl });
  revalidatePath("/submissions");
  revalidatePath("/approvals");
}

// ---------------------------------------------------------------------------
// Automation controls
// ---------------------------------------------------------------------------

export async function togglePause(paused: boolean) {
  const actor = await requireUser();
  await setPaused(paused);
  await audit(actor, paused ? "automation_paused" : "automation_resumed");
  revalidatePath("/automation");
  revalidatePath("/dashboard");
}

export async function updateSettings(input: unknown) {
  const actor = await requireUser();
  const partial = automationSettingsSchema.partial().parse(input);
  await persistSettings(partial);
  await audit(actor, "settings_updated", "settings", "automation", partial as Record<string, unknown>);
  revalidatePath("/settings");
  revalidatePath("/settings/budgets");
}

export async function toggleSource(sourceKey: string, enabled: boolean) {
  const actor = await requireUser();
  await db
    .update(schema.jobSources)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(schema.jobSources.key, sourceKey));
  await audit(actor, enabled ? "source_enabled" : "source_disabled", "job_source", sourceKey);
  revalidatePath("/integrations");
}

// ---------------------------------------------------------------------------
// Business profile
// ---------------------------------------------------------------------------

const profileInput = z.object({
  businessName: z.string().min(1),
  website: z.string().url(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  biography: z.string().max(4000).optional(),
  yearsOfExperience: z.coerce.number().int().min(0).max(60),
  hourlyRateUsd: z.coerce.number().min(0).optional(),
  minimumProjectPriceUsd: z.coerce.number().min(0),
  services: z.string().optional(),
  preferredIndustries: z.string().optional(),
  excludedIndustries: z.string().optional(),
  proposalSignature: z.string().max(500).optional(),
});

export async function saveBusinessProfile(input: unknown) {
  const actor = await requireUser();
  const data = profileInput.parse(input);
  const list = (s?: string) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

  const existing = await db.query.businessProfiles.findFirst();
  const values = {
    businessName: data.businessName,
    website: data.website,
    contactEmail: data.contactEmail || null,
    biography: data.biography || null,
    yearsOfExperience: data.yearsOfExperience,
    hourlyRateUsd: data.hourlyRateUsd != null ? String(data.hourlyRateUsd) : null,
    minimumProjectPriceUsd: String(data.minimumProjectPriceUsd),
    services: list(data.services),
    preferredIndustries: list(data.preferredIndustries),
    excludedIndustries: list(data.excludedIndustries),
    proposalSignature: data.proposalSignature || null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(schema.businessProfiles).set(values).where(eq(schema.businessProfiles.id, existing.id));
  } else {
    await db.insert(schema.businessProfiles).values(values);
  }
  await audit(actor, "business_profile_updated", "business_profile");
  revalidatePath("/settings/business");
}

// ---------------------------------------------------------------------------
// Manual job import & client responses
// ---------------------------------------------------------------------------

const importInput = z.object({
  sourceKey: z.string().min(1),
  url: z.string().url().optional().or(z.literal("")),
  title: z.string().min(3),
  description: z.string().min(20),
  budgetMinUsd: z.coerce.number().optional(),
  budgetMaxUsd: z.coerce.number().optional(),
});

export async function importJobManually(input: unknown) {
  const actor = await requireUser();
  const data = importInput.parse(input);

  const source = await db.query.jobSources.findFirst({
    where: eq(schema.jobSources.key, data.sourceKey),
  });
  if (!source) throw new Error(`Unknown source: ${data.sourceKey}`);

  const job = normalizeJob({
    sourceKey: data.sourceKey,
    externalId: data.url || `manual-${Date.now()}`,
    url: data.url || undefined,
    title: data.title,
    description: data.description,
    budgetMinUsd: data.budgetMinUsd,
    budgetMaxUsd: data.budgetMaxUsd,
    skillsRequired: [],
  });

  await db
    .insert(schema.jobs)
    .values({
      sourceId: source.id,
      sourceKey: job.sourceKey,
      externalId: job.externalId,
      url: job.url,
      title: job.title,
      description: job.description,
      contentHash: contentHash(job.title, job.description),
      budgetMinUsd: job.budgetMinUsd != null ? String(job.budgetMinUsd) : null,
      budgetMaxUsd: job.budgetMaxUsd != null ? String(job.budgetMaxUsd) : null,
      budgetType: job.budgetType,
      skillsRequired: [],
      applicationCostUsd: "0",
    })
    .onConflictDoNothing({ target: [schema.jobs.sourceKey, schema.jobs.externalId] });

  await audit(actor, "job_imported_manually", "job", job.externalId);
  revalidatePath("/jobs");
}

const responseInput = z.object({
  jobId: z.string().uuid(),
  type: z.enum(["question", "interview_invitation", "project_discussion", "offer", "rejection", "other"]),
  content: z.string().max(5000).optional(),
});

export async function addClientResponse(input: unknown) {
  const actor = await requireUser();
  const data = responseInput.parse(input);
  await db.insert(schema.clientResponses).values({
    jobId: data.jobId,
    type: data.type,
    content: data.content,
    source: "manual",
    externalId: `manual-${Date.now()}`,
  });
  await audit(actor, "client_response_recorded", "job", data.jobId, { type: data.type });
  revalidatePath("/responses");
}

const outcomeInput = z.object({
  jobId: z.string().uuid(),
  won: z.boolean(),
  estimatedRevenueUsd: z.coerce.number().min(0).optional(),
  actualRevenueUsd: z.coerce.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export async function recordOutcome(input: unknown) {
  const actor = await requireUser();
  const data = outcomeInput.parse(input);

  await db
    .insert(schema.jobOutcomes)
    .values({
      jobId: data.jobId,
      won: data.won,
      estimatedRevenueUsd: data.estimatedRevenueUsd != null ? String(data.estimatedRevenueUsd) : null,
      actualRevenueUsd: data.actualRevenueUsd != null ? String(data.actualRevenueUsd) : null,
      wonAt: data.won ? new Date().toISOString().slice(0, 10) : null,
      notes: data.notes,
    })
    .onConflictDoUpdate({
      target: schema.jobOutcomes.jobId,
      set: {
        won: data.won,
        estimatedRevenueUsd: data.estimatedRevenueUsd != null ? String(data.estimatedRevenueUsd) : null,
        actualRevenueUsd: data.actualRevenueUsd != null ? String(data.actualRevenueUsd) : null,
        notes: data.notes,
        updatedAt: new Date(),
      },
    });

  await db
    .update(schema.jobs)
    .set({ status: data.won ? "won" : "lost", updatedAt: new Date() })
    .where(eq(schema.jobs.id, data.jobId));

  await audit(actor, "outcome_recorded", "job", data.jobId, { won: data.won });
  revalidatePath("/analytics");
  revalidatePath("/responses");
}
