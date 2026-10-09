CREATE TYPE "public"."budget_category" AS ENUM('openai', 'marketplace_credits', 'hosting', 'other');--> statement-breakpoint
CREATE TYPE "public"."integration_status" AS ENUM('working', 'requires_credentials', 'requires_approval', 'manual_only', 'unsupported');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('discovered', 'filtered_out', 'qualified', 'disqualified', 'proposal_generated', 'awaiting_approval', 'ready_for_manual_submission', 'submitted', 'rejected_by_user', 'won', 'lost', 'expired');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('low', 'normal', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'awaiting_approval', 'approved', 'rejected', 'ready_for_manual_submission', 'submitted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."response_type" AS ENUM('question', 'interview_invitation', 'project_discussion', 'offer', 'rejection', 'other');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."run_trigger" AS ENUM('scheduled', 'manual', 'dry_run');--> statement-breakpoint
CREATE TYPE "public"."submission_mode" AS ENUM('disabled', 'approval_required', 'autonomous');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'in_progress', 'submitted', 'failed', 'ready_for_manual_submission', 'cancelled');--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"provider" text DEFAULT 'openai' NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"estimated_cost_usd" numeric(10, 6) NOT NULL,
	"actual_cost_usd" numeric(10, 6),
	"input_tokens" integer,
	"output_tokens" integer,
	"reconciled" boolean DEFAULT false NOT NULL,
	"month" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid,
	"level" text DEFAULT 'info' NOT NULL,
	"worker" text,
	"message" text NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_key" text,
	"trigger" "run_trigger" NOT NULL,
	"status" "run_status" DEFAULT 'running' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"jobs_discovered" integer DEFAULT 0 NOT NULL,
	"jobs_qualified" integer DEFAULT 0 NOT NULL,
	"proposals_generated" integer DEFAULT 0 NOT NULL,
	"bids_submitted" integer DEFAULT 0 NOT NULL,
	"awaiting_approval" integer DEFAULT 0 NOT NULL,
	"ai_cost_usd" numeric(10, 6) DEFAULT '0' NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"business_name" text DEFAULT 'Your Business' NOT NULL,
	"website" text DEFAULT 'https://example.com' NOT NULL,
	"logo_url" text,
	"contact_email" text,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"biography" text,
	"years_of_experience" integer DEFAULT 8 NOT NULL,
	"hourly_rate_usd" numeric(10, 2),
	"minimum_project_price_usd" numeric(10, 2) DEFAULT '300' NOT NULL,
	"preferred_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"excluded_industries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposal_signature" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"proposal_id" uuid,
	"type" "response_type" NOT NULL,
	"content" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"credential_type" text NOT NULL,
	"env_var_name" text NOT NULL,
	"configured" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"model" text NOT NULL,
	"score" integer NOT NULL,
	"recommendation" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_hours" numeric(7, 1),
	"suggested_bid_usd" numeric(12, 2),
	"confidence" text NOT NULL,
	"raw_response" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"won" boolean NOT NULL,
	"estimated_revenue_usd" numeric(12, 2),
	"actual_revenue_usd" numeric(12, 2),
	"won_at" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"deterministic_score" integer NOT NULL,
	"tech_match_score" integer NOT NULL,
	"budget_score" integer NOT NULL,
	"recency_score" integer NOT NULL,
	"client_score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"rejection_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"integration_status" "integration_status" DEFAULT 'requires_credentials' NOT NULL,
	"discovery_supported" boolean DEFAULT false NOT NULL,
	"auth_required" boolean DEFAULT false NOT NULL,
	"official_api" boolean DEFAULT false NOT NULL,
	"submission_supported" boolean DEFAULT false NOT NULL,
	"human_confirmation_required" boolean DEFAULT true NOT NULL,
	"tested" boolean DEFAULT false NOT NULL,
	"application_cost_model" text DEFAULT 'free' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"source_key" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content_hash" text NOT NULL,
	"budget_min_usd" numeric(12, 2),
	"budget_max_usd" numeric(12, 2),
	"budget_type" text,
	"currency" text DEFAULT 'USD',
	"skills_required" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text,
	"client_country" text,
	"client_verified" boolean,
	"client_rating" numeric(3, 2),
	"client_hire_rate" numeric(5, 2),
	"client_jobs_posted" integer,
	"bid_count" integer,
	"application_cost_usd" numeric(8, 2) DEFAULT '0',
	"connects_required" integer,
	"posted_at" timestamp with time zone,
	"status" "job_status" DEFAULT 'discovered' NOT NULL,
	"status_reason" text,
	"raw" jsonb,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"month" text NOT NULL,
	"category" "budget_category" NOT NULL,
	"limit_usd" numeric(10, 2) NOT NULL,
	"reserved_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"spent_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"safety_buffer_usd" numeric(10, 2) DEFAULT '0.50' NOT NULL,
	"platform" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"channel" text DEFAULT 'telegram' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"sent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"related_job_id" uuid,
	"related_run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"account_type" text DEFAULT 'individual' NOT NULL,
	"public_identity" text,
	"profile_url" text,
	"uses_business_branding" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text,
	"technologies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"industry" text,
	"verified" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"cover_letter" text NOT NULL,
	"bid_amount_usd" numeric(12, 2),
	"edited_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"evaluation_id" uuid,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"cover_letter" text NOT NULL,
	"bid_amount_usd" numeric(12, 2),
	"bid_type" text DEFAULT 'fixed',
	"estimated_days" integer,
	"clarifying_question" text,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"rejected_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"description" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proficiency" integer DEFAULT 5 NOT NULL,
	"years_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"mode" "submission_mode" NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"error_details" text,
	"connects_spent" integer,
	"credit_cost_usd" numeric(8, 2),
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "submission_confirmations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"external_confirmation_id" text,
	"external_confirmation_url" text,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_events" ADD CONSTRAINT "automation_events_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_responses" ADD CONSTRAINT "client_responses_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_responses" ADD CONSTRAINT "client_responses_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_evaluations" ADD CONSTRAINT "job_evaluations_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_outcomes" ADD CONSTRAINT "job_outcomes_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_id_job_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."job_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_job_id_jobs_id_fk" FOREIGN KEY ("related_job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_run_id_automation_runs_id_fk" FOREIGN KEY ("related_run_id") REFERENCES "public"."automation_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_projects" ADD CONSTRAINT "portfolio_projects_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_evaluation_id_job_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."job_evaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_profile_id_business_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."business_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_confirmations" ADD CONSTRAINT "submission_confirmations_attempt_id_submission_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."submission_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_usage_month_idx" ON "api_usage" USING btree ("month");--> statement-breakpoint
CREATE INDEX "api_usage_run_idx" ON "api_usage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "automation_events_run_idx" ON "automation_events" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_slot_idx" ON "automation_runs" USING btree ("slot_key");--> statement-breakpoint
CREATE INDEX "automation_runs_started_idx" ON "automation_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "client_responses_job_idx" ON "client_responses" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "client_responses_external_idx" ON "client_responses" USING btree ("source","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_creds_idx" ON "integration_credentials_metadata" USING btree ("platform","credential_type");--> statement-breakpoint
CREATE INDEX "job_evaluations_job_idx" ON "job_evaluations" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_outcomes_job_idx" ON "job_outcomes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_scores_job_idx" ON "job_scores" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_sources_key_idx" ON "job_sources" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_source_external_idx" ON "jobs" USING btree ("source_key","external_id");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_content_hash_idx" ON "jobs" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "jobs_discovered_at_idx" ON "jobs" USING btree ("discovered_at");--> statement-breakpoint
CREATE INDEX "jobs_posted_at_idx" ON "jobs" USING btree ("posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_budgets_idx" ON "monthly_budgets" USING btree ("month","category","platform");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_accounts_platform_idx" ON "platform_accounts" USING btree ("profile_id","platform");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_idx" ON "proposal_versions" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_job_idx" ON "proposals" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "skills_profile_name_idx" ON "skills" USING btree ("profile_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_attempts_idempotency_idx" ON "submission_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "submission_attempts_status_idx" ON "submission_attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_confirmations_attempt_idx" ON "submission_confirmations" USING btree ("attempt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");