import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  date,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const jobStatusEnum = pgEnum("job_status", [
  "discovered",
  "filtered_out",
  "qualified",
  "disqualified",
  "proposal_generated",
  "awaiting_approval",
  "ready_for_manual_submission",
  "submitted",
  "rejected_by_user",
  "won",
  "lost",
  "expired",
]);

export const proposalStatusEnum = pgEnum("proposal_status", [
  "draft",
  "awaiting_approval",
  "approved",
  "rejected",
  "ready_for_manual_submission",
  "submitted",
  "withdrawn",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "in_progress",
  "submitted",
  "failed",
  "ready_for_manual_submission",
  "cancelled",
]);

export const submissionModeEnum = pgEnum("submission_mode", [
  "disabled",
  "approval_required",
  "autonomous",
]);

export const runStatusEnum = pgEnum("run_status", [
  "running",
  "completed",
  "failed",
  "skipped",
]);

export const runTriggerEnum = pgEnum("run_trigger", [
  "scheduled",
  "manual",
  "dry_run",
]);

export const responseTypeEnum = pgEnum("response_type", [
  "question",
  "interview_invitation",
  "project_discussion",
  "offer",
  "rejection",
  "other",
]);

export const notificationPriorityEnum = pgEnum("notification_priority", [
  "low",
  "normal",
  "high",
  "critical",
]);

export const budgetCategoryEnum = pgEnum("budget_category", [
  "openai",
  "marketplace_credits",
  "hosting",
  "other",
]);

export const integrationStatusEnum = pgEnum("integration_status", [
  "working",
  "requires_credentials",
  "requires_approval",
  "manual_only",
  "unsupported",
]);

// ---------------------------------------------------------------------------
// Users & profile
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  businessName: text("business_name").notNull().default("Your Business"),
  website: text("website").notNull().default("https://example.com"),
  logoUrl: text("logo_url"),
  contactEmail: text("contact_email"),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  biography: text("biography"),
  yearsOfExperience: integer("years_of_experience").notNull().default(8),
  hourlyRateUsd: numeric("hourly_rate_usd", { precision: 10, scale: 2 }),
  minimumProjectPriceUsd: numeric("minimum_project_price_usd", { precision: 10, scale: 2 }).notNull().default("300"),
  preferredIndustries: jsonb("preferred_industries").$type<string[]>().notNull().default([]),
  excludedIndustries: jsonb("excluded_industries").$type<string[]>().notNull().default([]),
  proposalSignature: text("proposal_signature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const portfolioProjects = pgTable("portfolio_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => businessProfiles.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url"),
  technologies: jsonb("technologies").$type<string[]>().notNull().default([]),
  industry: text("industry"),
  verified: boolean("verified").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => businessProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // aliases used for keyword matching during deterministic filtering
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  proficiency: integer("proficiency").notNull().default(5), // 1-5
  yearsUsed: integer("years_used"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("skills_profile_name_idx").on(t.profileId, t.name)]);

export const platformAccounts = pgTable("platform_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id").notNull().references(() => businessProfiles.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // upwork | freelancer | ...
  accountType: text("account_type").notNull().default("individual"), // individual | business
  publicIdentity: text("public_identity"), // display name used on that platform
  profileUrl: text("profile_url"),
  usesBusinessBranding: boolean("uses_business_branding").notNull().default(false),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("platform_accounts_platform_idx").on(t.profileId, t.platform)]);

// ---------------------------------------------------------------------------
// Sources & jobs
// ---------------------------------------------------------------------------

export const jobSources = pgTable("job_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull(), // adapter key e.g. "freelancer", "upwork", "remoteok"
  name: text("name").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  integrationStatus: integrationStatusEnum("integration_status").notNull().default("requires_credentials"),
  discoverySupported: boolean("discovery_supported").notNull().default(false),
  authRequired: boolean("auth_required").notNull().default(false),
  officialApi: boolean("official_api").notNull().default(false),
  submissionSupported: boolean("submission_supported").notNull().default(false),
  humanConfirmationRequired: boolean("human_confirmation_required").notNull().default(true),
  tested: boolean("tested").notNull().default(false),
  applicationCostModel: text("application_cost_model").notNull().default("free"), // free | credits | connects
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("job_sources_key_idx").on(t.key)]);

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceId: uuid("source_id").notNull().references(() => jobSources.id),
  sourceKey: text("source_key").notNull(),
  externalId: text("external_id").notNull(),
  url: text("url"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // normalized hash of title+description used for cross-source dedupe
  contentHash: text("content_hash").notNull(),
  budgetMinUsd: numeric("budget_min_usd", { precision: 12, scale: 2 }),
  budgetMaxUsd: numeric("budget_max_usd", { precision: 12, scale: 2 }),
  budgetType: text("budget_type"), // fixed | hourly | unknown
  currency: text("currency").default("USD"),
  skillsRequired: jsonb("skills_required").$type<string[]>().notNull().default([]),
  category: text("category"),
  clientCountry: text("client_country"),
  clientVerified: boolean("client_verified"),
  clientRating: numeric("client_rating", { precision: 3, scale: 2 }),
  clientHireRate: numeric("client_hire_rate", { precision: 5, scale: 2 }),
  clientJobsPosted: integer("client_jobs_posted"),
  bidCount: integer("bid_count"),
  applicationCostUsd: numeric("application_cost_usd", { precision: 8, scale: 2 }).default("0"),
  connectsRequired: integer("connects_required"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  status: jobStatusEnum("status").notNull().default("discovered"),
  statusReason: text("status_reason"),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("jobs_source_external_idx").on(t.sourceKey, t.externalId),
  index("jobs_status_idx").on(t.status),
  index("jobs_content_hash_idx").on(t.contentHash),
  index("jobs_discovered_at_idx").on(t.discoveredAt),
  index("jobs_posted_at_idx").on(t.postedAt),
]);

export const jobScores = pgTable("job_scores", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  // deterministic pre-filter score, 0-100
  deterministicScore: integer("deterministic_score").notNull(),
  techMatchScore: integer("tech_match_score").notNull(),
  budgetScore: integer("budget_score").notNull(),
  recencyScore: integer("recency_score").notNull(),
  clientScore: integer("client_score").notNull(),
  passed: boolean("passed").notNull(),
  rejectionReasons: jsonb("rejection_reasons").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("job_scores_job_idx").on(t.jobId)]);

export const jobEvaluations = pgTable("job_evaluations", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  score: integer("score").notNull(), // 0-100
  recommendation: text("recommendation").notNull(), // pursue | skip | maybe
  reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
  risks: jsonb("risks").$type<string[]>().notNull().default([]),
  estimatedHours: numeric("estimated_hours", { precision: 7, scale: 1 }),
  suggestedBidUsd: numeric("suggested_bid_usd", { precision: 12, scale: 2 }),
  confidence: text("confidence").notNull(), // low | medium | high
  rawResponse: jsonb("raw_response").$type<Record<string, unknown>>(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("job_evaluations_job_idx").on(t.jobId)]);

// ---------------------------------------------------------------------------
// Proposals & submissions
// ---------------------------------------------------------------------------

export const proposals = pgTable("proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  evaluationId: uuid("evaluation_id").references(() => jobEvaluations.id),
  status: proposalStatusEnum("status").notNull().default("draft"),
  coverLetter: text("cover_letter").notNull(),
  bidAmountUsd: numeric("bid_amount_usd", { precision: 12, scale: 2 }),
  bidType: text("bid_type").default("fixed"), // fixed | hourly
  estimatedDays: integer("estimated_days"),
  clarifyingQuestion: text("clarifying_question"),
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costUsd: numeric("cost_usd", { precision: 10, scale: 6 }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => users.id),
  rejectedReason: text("rejected_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("proposals_job_idx").on(t.jobId), // one active proposal per job
  index("proposals_status_idx").on(t.status),
]);

export const proposalVersions = pgTable("proposal_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  coverLetter: text("cover_letter").notNull(),
  bidAmountUsd: numeric("bid_amount_usd", { precision: 12, scale: 2 }),
  editedBy: text("edited_by").notNull().default("system"), // system | user
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("proposal_versions_idx").on(t.proposalId, t.version)]);

export const submissionAttempts = pgTable("submission_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  proposalId: uuid("proposal_id").notNull().references(() => proposals.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").notNull().references(() => jobs.id),
  platform: text("platform").notNull(),
  mode: submissionModeEnum("mode").notNull(),
  // idempotency key prevents double submission: platform + external job id
  idempotencyKey: text("idempotency_key").notNull(),
  status: submissionStatusEnum("status").notNull().default("pending"),
  attemptNumber: integer("attempt_number").notNull().default(1),
  errorDetails: text("error_details"),
  connectsSpent: integer("connects_spent"),
  creditCostUsd: numeric("credit_cost_usd", { precision: 8, scale: 2 }),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("submission_attempts_idempotency_idx").on(t.idempotencyKey),
  index("submission_attempts_status_idx").on(t.status),
]);

export const submissionConfirmations = pgTable("submission_confirmations", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id").notNull().references(() => submissionAttempts.id, { onDelete: "cascade" }),
  externalConfirmationId: text("external_confirmation_id"),
  externalConfirmationUrl: text("external_confirmation_url"),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  raw: jsonb("raw").$type<Record<string, unknown>>(),
}, (t) => [uniqueIndex("submission_confirmations_attempt_idx").on(t.attemptId)]);

export const clientResponses = pgTable("client_responses", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  proposalId: uuid("proposal_id").references(() => proposals.id),
  type: responseTypeEnum("type").notNull(),
  content: text("content"),
  source: text("source").notNull().default("manual"), // manual | api | email
  externalId: text("external_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("client_responses_job_idx").on(t.jobId),
  uniqueIndex("client_responses_external_idx").on(t.source, t.externalId),
]);

// ---------------------------------------------------------------------------
// Automation runs & events
// ---------------------------------------------------------------------------

export const automationRuns = pgTable("automation_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  // e.g. "2025-10-08-morning" — unique key making delayed/duplicate runs idempotent
  slotKey: text("slot_key"),
  trigger: runTriggerEnum("trigger").notNull(),
  status: runStatusEnum("status").notNull().default("running"),
  dryRun: boolean("dry_run").notNull().default(false),
  jobsDiscovered: integer("jobs_discovered").notNull().default(0),
  jobsQualified: integer("jobs_qualified").notNull().default(0),
  proposalsGenerated: integer("proposals_generated").notNull().default(0),
  bidsSubmitted: integer("bids_submitted").notNull().default(0),
  awaitingApproval: integer("awaiting_approval").notNull().default(0),
  aiCostUsd: numeric("ai_cost_usd", { precision: 10, scale: 6 }).notNull().default("0"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("automation_runs_slot_idx").on(t.slotKey),
  index("automation_runs_started_idx").on(t.startedAt),
]);

export const automationEvents = pgTable("automation_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => automationRuns.id, { onDelete: "cascade" }),
  level: text("level").notNull().default("info"), // debug | info | warn | error
  worker: text("worker"),
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("automation_events_run_idx").on(t.runId)]);

// ---------------------------------------------------------------------------
// Cost management
// ---------------------------------------------------------------------------

export const apiUsage = pgTable("api_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id").references(() => automationRuns.id),
  provider: text("provider").notNull().default("openai"),
  model: text("model").notNull(),
  purpose: text("purpose").notNull(), // qualification | proposal | other
  // reserved estimate before the call; reconciled after
  estimatedCostUsd: numeric("estimated_cost_usd", { precision: 10, scale: 6 }).notNull(),
  actualCostUsd: numeric("actual_cost_usd", { precision: 10, scale: 6 }),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  reconciled: boolean("reconciled").notNull().default(false),
  month: text("month").notNull(), // "2025-10"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("api_usage_month_idx").on(t.month),
  index("api_usage_run_idx").on(t.runId),
]);

export const monthlyBudgets = pgTable("monthly_budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  month: text("month").notNull(), // "2025-10"
  category: budgetCategoryEnum("category").notNull(),
  limitUsd: numeric("limit_usd", { precision: 10, scale: 2 }).notNull(),
  // amounts reserved before calls complete (atomic pre-reservation)
  reservedUsd: numeric("reserved_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  spentUsd: numeric("spent_usd", { precision: 12, scale: 6 }).notNull().default("0"),
  safetyBufferUsd: numeric("safety_buffer_usd", { precision: 10, scale: 2 }).notNull().default("0.50"),
  platform: text("platform"), // for marketplace_credits: upwork | freelancer | ...
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("monthly_budgets_idx").on(t.month, t.category, t.platform)]);

// ---------------------------------------------------------------------------
// Notifications, credentials metadata, audit, settings
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  priority: notificationPriorityEnum("priority").notNull().default("normal"),
  channel: text("channel").notNull().default("telegram"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sent: boolean("sent").notNull().default(false),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  error: text("error"),
  relatedJobId: uuid("related_job_id").references(() => jobs.id),
  relatedRunId: uuid("related_run_id").references(() => automationRuns.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_created_idx").on(t.createdAt)]);

// Only metadata — never the secret itself. Secrets live in env vars.
export const integrationCredentialsMetadata = pgTable("integration_credentials_metadata", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull(),
  credentialType: text("credential_type").notNull(), // oauth_token | api_key | bot_token
  envVarName: text("env_var_name").notNull(), // which env var holds the secret
  configured: boolean("configured").notNull().default(false),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("integration_creds_idx").on(t.platform, t.credentialType)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(), // user email or "system" / "worker"
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_logs_created_idx").on(t.createdAt)]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Revenue tracking (manually entered actuals live on won jobs)
export const jobOutcomes = pgTable("job_outcomes", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
  won: boolean("won").notNull(),
  estimatedRevenueUsd: numeric("estimated_revenue_usd", { precision: 12, scale: 2 }),
  actualRevenueUsd: numeric("actual_revenue_usd", { precision: 12, scale: 2 }),
  wonAt: date("won_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("job_outcomes_job_idx").on(t.jobId)]);
