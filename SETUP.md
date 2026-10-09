# Setup Guide

Complete, ordered setup from zero to a running system.

## 1. Create a Supabase project

1. Sign up at [supabase.com](https://supabase.com) (free tier is fine).
2. Create a new project; choose a strong database password.
3. Go to **Project Settings → Database → Connection string** and copy the
   **Transaction pooler** URI (port `6543`). It looks like:
   `postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`

## 2. Configure the database

```bash
cp .env.example .env
# set DATABASE_URL to the pooler URI
npm install
npm run db:migrate   # creates all tables
npm run db:seed      # seeds sources, default settings, default business profile + skills
```

The seed is idempotent — safe to re-run after upgrades.

## 3. Configure OpenAI

1. Create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. Set `OPENAI_API_KEY` in `.env`.
3. Recommended: in the OpenAI dashboard, also set a **platform-level** monthly
   budget of $5 as a second line of defense.

## 4. Set the AI budget

The default is **$5/month** with a $0.50 safety buffer. Change it in the dashboard
at **Settings → Budgets** (or leave the default). When the budget is exhausted,
AI calls stop until the next calendar month. GigPilot never upgrades models to
spend more.

## 5. Configure GitHub Actions

1. Push this repository to GitHub (private recommended).
2. In **Settings → Secrets and variables → Actions**, add repository secrets:
   - `DATABASE_URL` (required)
   - `OPENAI_API_KEY` (required)
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (recommended)
   - `FREELANCER_OAUTH_TOKEN` (optional)
   - `UPWORK_ACCESS_TOKEN` (optional, requires approved Upwork API key)
   - `DASHBOARD_URL` (optional, used in Telegram links)
3. The workflow `.github/workflows/automation.yml` is already scheduled for
   9 AM / 6 PM New York time, DST-aware. Nothing else to do.

## 6. Configure Telegram

1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Message your new bot anything (bots can't message you first).
3. Get your chat id: open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy
   `message.chat.id` into `TELEGRAM_CHAT_ID`.
4. Verify: `npm run agent:test-integrations` — you should receive a test message.

## 7. Create marketplace accounts

- **Upwork**: individual freelancer account (free). Complete identity verification.
  GigPilot does **not** require Agency Plus or an agency account.
- **Freelancer.com**: free account; link it to the developer dashboard (next step).
- **Contra / PeoplePerHour / Guru / Truelancer / Workana**: create accounts as
  desired — these are manual-import platforms (no suitable public APIs).

Reference your business in your profiles where each platform's rules permit
business branding; keep your personal verified identity where required.

## 8. Authorize supported integrations

### Freelancer.com (discovery + optional programmatic bidding)
1. Go to [accounts.freelancer.com/settings/develop](https://accounts.freelancer.com/settings/develop).
2. Create an app, then generate an OAuth token with the `basic` + `bid` scopes.
3. Set `FREELANCER_OAUTH_TOKEN` in `.env` and GitHub secrets.
4. Verify with `npm run agent:test-integrations`.
5. Enable the source in **Dashboard → Integrations**.

### Upwork (discovery only; submission always requires your confirmation)
1. Apply for an API key at [upwork.com/developer](https://www.upwork.com/developer/).
   Marketplace job search requires Upwork's partner-level approval — granted case by case.
2. Complete OAuth2 and set `UPWORK_ACCESS_TOKEN`.
3. Until approved, use the official **Upwork MCP server** (`https://mcp.upwork.com/mcp`)
   interactively from your AI client for search/drafting, and GigPilot's manual
   import + approval queue for tracking. See INTEGRATIONS.md.

### RSS / job boards
RemoteOK, Remotive, and We Work Remotely work without credentials. Add custom
feeds via the `rss` source's config (only feeds whose terms permit automated use).

## 9. Test a dry run

```bash
npm run agent:dry-run
```

This executes the full pipeline — discovery, dedup, filtering, AI evaluation,
proposal generation — but **never submits anything** and skips Telegram sends.
Review results in the dashboard (`npm run dev` → http://localhost:3000).

Set up dashboard auth first:

```bash
# generate a session secret
openssl rand -base64 32          # → AUTH_SECRET
npx tsx scripts/hash-password.ts "choose-a-password"   # → ADMIN_PASSWORD_HASH
# set ADMIN_EMAIL too
```

## 10. Enable production automation

1. Confirm the dry run looked good (jobs discovered, sensible filtering, proposals you'd send).
2. Make sure **Settings → Submission mode** is `APPROVAL_REQUIRED` (the default).
3. Push to GitHub — the schedule takes over. Each run ends with a Telegram summary.
4. Review proposals in **/approvals**; approve, edit, or reject. For manual-submission
   platforms, click through, submit, and record the confirmation.

## 11. Pause the system

Three independent ways:
- Dashboard: **Pause automation** button (dashboard or /automation page).
- GitHub: disable the workflow (**Actions → GigPilot Automation → ⋯ → Disable workflow**).
- Settings: set submission mode to `DISABLED` (runs still discover/evaluate but never submit).

## 12. Review logs and failures

- **Dashboard → Automation**: run history, per-run metrics, event log.
- **GitHub → Actions**: full worker stdout for every run; failures trigger a
  Telegram alert with a link.
- `automation_events` table: structured log of every worker action.
- `audit_logs` table: every human action (logins, approvals, settings changes).
