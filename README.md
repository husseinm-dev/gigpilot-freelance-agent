# GigPilot

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle_ORM-4169E1?logo=postgresql&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-structured_outputs-412991?logo=openai&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-scheduled-2088FF?logo=githubactions&logoColor=white)
![Telegram](https://img.shields.io/badge/Telegram-notifications-26A5E4?logo=telegram&logoColor=white)

**Autonomous client acquisition for freelance developers and agencies.**

GigPilot finds freelance web-development opportunities twice a day, qualifies them
deterministically and with OpenAI, writes personalized proposals, queues them for your
approval (or submits on platforms that explicitly permit it), tracks responses, and
notifies you on Telegram — all for pennies a month, without your computer being on.

You deliver the projects. GigPilot only wins them.

## What it does

1. Runs at **9:00 AM and 6:00 PM America/New_York** on GitHub Actions (DST-aware, idempotent).
2. Discovers jobs from authorized sources (Freelancer.com API, RemoteOK, Remotive, We Work Remotely RSS, custom RSS, manual imports; Upwork via its official API when you have approved credentials).
3. Normalizes and deduplicates listings (per-source IDs + cross-source content hashing).
4. Filters deterministically — scams, unpaid work, low budgets, skill mismatches, stale listings — **before** spending a cent on AI.
5. Evaluates the most promising jobs with a low-cost OpenAI model (structured outputs, Zod-validated).
6. Generates concise, honest, personalized proposals from your **verified** business profile.
7. Queues proposals for approval by default. Autonomous submission exists only for platforms that explicitly permit unattended programmatic bidding **and** have passed a live integration test.
8. Enforces a hard **$5/month OpenAI budget** with atomic pre-reservation — it can't overshoot.
9. Tracks submissions, confirmations, client responses, wins, and real revenue.
10. Sends a Telegram summary after every run and high-priority alerts for client activity.

## What it will never do

- Buy Upwork Connects or marketplace credits automatically
- Bypass CAPTCHAs, scraping prohibitions, or platform confirmation flows
- Invent employees, portfolio items, testimonials, or experience
- Accept contracts or make financial commitments
- Exceed your configured budgets

## Quick start

```bash
cp .env.example .env        # fill in values — see SETUP.md
npm install
npm run db:migrate          # create tables
npm run db:seed             # sources, settings, default business profile
npm run agent:test-integrations
npm run agent:dry-run       # full pipeline, zero submissions
npm run dev                 # dashboard at http://localhost:3000
```

## Commands

| Command | Purpose |
|---|---|
| `npm run agent:hunt` | Scheduled run (slot-aware; used by GitHub Actions) |
| `npm run agent:manual` | Manual run, right now |
| `npm run agent:dry-run` | Full pipeline, **never** submits anything |
| `npm run agent:test-integrations` | Verify DB, OpenAI, Telegram, and every source adapter |
| `npm run db:generate / db:migrate / db:seed` | Database lifecycle |
| `npm test` | Vitest unit suite |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run dev / build / start` | Next.js dashboard |

## Documentation

- [SETUP.md](./SETUP.md) — step-by-step setup from zero
- [ARCHITECTURE.md](./ARCHITECTURE.md) — system design
- [INTEGRATIONS.md](./INTEGRATIONS.md) — honest per-platform status
- [AUTOMATION.md](./AUTOMATION.md) — scheduling, idempotency, pause switch
- [COSTS.md](./COSTS.md) — budget enforcement internals
- [DEPLOYMENT.md](./DEPLOYMENT.md) — hosting options (no Vercel Hobby — it bans commercial use)
- [SECURITY.md](./SECURITY.md) — auth, secrets, audit logging

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · PostgreSQL (Supabase) ·
Drizzle ORM · OpenAI Responses API · Zod · GitHub Actions · Telegram Bot API · Vitest · Playwright
