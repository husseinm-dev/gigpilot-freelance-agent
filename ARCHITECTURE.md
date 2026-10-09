# Architecture

GigPilot is two independent applications sharing one database and one codebase:

```
┌─────────────────────────┐          ┌──────────────────────────────┐
│  Next.js dashboard       │          │  Automation worker (tsx)     │
│  (runs anywhere/locally) │          │  (GitHub Actions, 2×/day)    │
│                          │          │                              │
│  - review & approvals    │          │  JobDiscoveryWorker          │
│  - settings & budgets    │          │  JobQualificationWorker      │
│  - analytics             │          │  ProposalGenerationWorker    │
│  - manual imports        │          │  BidSubmissionWorker         │
│                          │          │  ResponseMonitoringWorker    │
└───────────┬─────────────┘          └──────────────┬───────────────┘
            │                                        │
            └──────────────┬─────────────────────────┘
                           ▼
              PostgreSQL (Supabase) — single source of truth
```

**The worker never imports anything from `src/app`.** It runs with `tsx` directly
and functions whether or not the dashboard is deployed.

## Directory layout

```
src/
  app/                 Next.js App Router (dashboard + auth API)
  components/          UI (shadcn/ui base + feature components)
  db/
    schema.ts          All tables (Drizzle)
    client.ts          postgres-js + Drizzle client (shared)
  lib/
    env.ts             Zod-validated environment access
    settings-schema.ts Automation settings (Zod, dashboard-editable)
    settings.ts        Settings persistence
    normalize.ts       Job normalization + content hashing + dedup
    profile-context.ts Profile types/defaults (no DB dependency)
    profile.ts         Verified business profile loader
    logger.ts          Run logger → automation_events
    telegram.ts        Telegram client + run summary formatter
    actions.ts         Dashboard server actions (approve/reject/...)
    queries.ts         Dashboard aggregate queries
    ai/
      openai.ts        Budget-enforced structured calls (Responses API)
      schemas.ts       Zod schemas for evaluations & proposals
    costs/
      pricing.ts       Configurable model pricing + conservative estimates
      budget.ts        Atomic reserve → call → reconcile budget flow
    auth/session.ts    JWT session cookies (jose)
  worker/
    index.ts           CLI entry (scheduled | manual | dry-run)
    hunt.ts            Orchestrator: lock → slot → pipeline → summary
    schedule.ts        DST-aware New York slot computation
    test-integrations.ts
    sources/           Source adapters (see INTEGRATIONS.md)
    workers/           The five pipeline workers
  proxy.ts             Route protection (Next 16 proxy, formerly middleware)
.github/workflows/automation.yml
drizzle/               Generated SQL migrations
tests/unit/            Vitest suite
e2e/                   Playwright smoke tests
scripts/               seed, hash-password
```

## Pipeline flow (one run)

1. **Guards** — pause switch, slot window, advisory lock, unique slot key.
2. **Discovery** — each enabled adapter fetches recent jobs (free-to-apply
   sources first), results are normalized, batch-deduped, cross-run deduped by
   `(source_key, external_id)` unique index and `content_hash` lookup, then inserted.
3. **Qualification**
   - *Deterministic*: scam patterns, unpaid-work signals, excluded skills/industries,
     budget floor, staleness, vagueness → scored 0–100, hard-rejected or passed. Free.
   - *AI*: top N (≤ `maxEvaluationsPerRun`) go to OpenAI with structured output.
     Score ≥ `minQualificationScore` **and** recommendation `pursue` → qualified.
4. **Proposals** — up to `maxProposalsPerRun` qualified jobs get a personalized
   proposal generated from the verified profile only. One proposal per job (unique index).
5. **Submission** — see modes below. Idempotency key `(platform:external_job_id)`
   is unique; a bid can never be sent twice.
6. **Monitoring** — unnotified client responses trigger Telegram alerts.
7. **Summary** — run stats persisted + Telegram summary sent.

## Job status lifecycle

```
discovered → filtered_out            (deterministic reject)
           → disqualified            (AI reject)
           → qualified → proposal_generated → awaiting_approval
                 → ready_for_manual_submission → submitted → won | lost
                 → rejected_by_user
```

## Submission modes

| Mode | Behavior |
|---|---|
| `disabled` | Nothing is ever submitted |
| `approval_required` (default) | You approve each proposal in /approvals. Approved proposals on tested, API-capable platforms are submitted next run; everything else becomes READY_FOR_MANUAL_SUBMISSION |
| `autonomous` | Only platforms whose adapter reports `submissionSupported && !humanConfirmationRequired` **and** whose source row is `tested=true` may submit unattended. Upwork can never qualify |

A submission is only marked SUBMITTED after the platform returns a confirmation,
which is stored in `submission_confirmations` with the external ID/URL.

## Cost enforcement (see COSTS.md)

Reserve (atomic SQL `UPDATE ... WHERE spent+reserved+estimate <= limit-buffer`) →
API call → reconcile actual token usage → release on failure. Budget exhaustion
raises `BudgetExceededError`, which stops further AI work gracefully mid-run.

## Key invariants

- Secrets live only in environment variables / GitHub secrets — never in the DB.
- The DB stores only credential *metadata* (`integration_credentials_metadata`).
- Capability reports (`SourceAdapter.capabilities()`) describe implemented,
  verified behavior only.
- Proposals can only claim facts from the verified business profile.
- All human actions are audit-logged.
