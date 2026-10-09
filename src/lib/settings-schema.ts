import { z } from "zod";

/**
 * All automation settings, editable from the dashboard, stored in the
 * `settings` table as a single JSON document under key "automation".
 * These are LIMITS, not quotas — the system never pads output to hit them.
 */
export const automationSettingsSchema = z.object({
  paused: z.boolean().default(false),
  runsPerDay: z.number().int().min(1).max(4).default(2),
  maxJobsPerRun: z.number().int().min(1).max(200).default(50),
  maxEvaluationsPerRun: z.number().int().min(1).max(50).default(15),
  maxProposalsPerRun: z.number().int().min(0).max(20).default(5),
  maxBidsPerRun: z.number().int().min(0).max(10).default(3),
  maxBidsPerDay: z.number().int().min(0).max(20).default(6),
  minBudgetUsd: z.number().min(0).default(300),
  preferredBudgetMinUsd: z.number().min(0).default(500),
  preferredBudgetMaxUsd: z.number().min(0).default(2500),
  minQualificationScore: z.number().int().min(0).max(100).default(85),
  minDeterministicScore: z.number().int().min(0).max(100).default(50),
  maxJobAgeHours: z.number().int().min(1).default(72),
  submissionMode: z.enum(["disabled", "approval_required", "autonomous"]).default("approval_required"),
  evaluationModel: z.string().default("gpt-4o-mini"),
  proposalModel: z.string().default("gpt-4o-mini"),
  proposalMinWords: z.number().int().default(100),
  proposalMaxWords: z.number().int().default(180),
  monthlyOpenAiBudgetUsd: z.number().min(0).default(5),
  monthlyMarketplaceBudgetUsd: z.number().min(0).default(0),
  // Per-platform marketplace credit budgets (e.g. Upwork Connects).
  // Default $0 everywhere; Upwork spending is approval-gated regardless.
  platformCreditBudgetsUsd: z.record(z.string(), z.number().min(0)).default({}),
  // Platforms where applying is free get a scoring boost so the agent
  // prioritizes zero-cost acquisition.
  preferFreeApplicationSources: z.boolean().default(true),
  budgetSafetyBufferUsd: z.number().min(0).default(0.5),
  webSearchEnabled: z.boolean().default(false),
});

export type AutomationSettings = z.infer<typeof automationSettingsSchema>;

export const DEFAULT_SETTINGS: AutomationSettings = automationSettingsSchema.parse({});

export const SETTINGS_KEY = "automation";
