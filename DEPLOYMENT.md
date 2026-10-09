# Deployment

## The worker (required, free)

Runs entirely on **GitHub Actions** — your computer stays off.

1. Push the repo to GitHub (private recommended).
2. Add the secrets listed in SETUP.md §5.
3. Done. The schedule in `.github/workflows/automation.yml` takes over.

**Free-tier math**: a run takes ~2–4 minutes. Two runs/day ≈ 240 min/month.
GitHub Free includes 2,000 minutes/month for private repos (public repos:
unlimited) — plenty of headroom. The worker is fully independent of the
dashboard: it reads settings from the database and notifies via Telegram.

## The database (required, free)

Supabase free tier (500 MB Postgres) is more than enough. Note: free projects
pause after ~7 days of inactivity — the twice-daily worker keeps it active.
Alternatives: Neon (free tier), any managed Postgres.

## The dashboard (optional hosting)

The dashboard can simply run locally (`npm run dev`) whenever you want to
review approvals — the automation does not depend on it.

**Do not deploy to Vercel's Hobby plan.** GigPilot acquires clients for a
business, which is commercial use; Vercel Hobby is restricted to
non-commercial projects. Commercially permitted options:

| Option | Cost | Notes |
|---|---|---|
| Local only | $0 | Perfectly fine — automation is independent |
| Vercel **Pro** | $20/mo | First-class Next.js, commercial use permitted |
| Railway | ~$5/mo | Simple Node deploys |
| Render | $7/mo (free tier sleeps) | Easy Docker/Node |
| Fly.io | ~$3–5/mo | Small VM, always-on |
| Coolify / Dokku on a $4–6 VPS (Hetzner, DigitalOcean) | ~$5/mo | Self-hosted, cheapest always-on |
| Cloudflare Workers (via OpenNext) | Free–$5/mo | More setup effort |

For any host: build with `npm run build`, start with `npm run start`, set the
env vars from `.env.example`, and put it behind HTTPS (the session cookie is
`secure` in production). Set `DASHBOARD_URL` in GitHub secrets so Telegram
messages link to it.

## Migrations

The GitHub Actions workflow runs `npm run db:migrate` before each hunt, so the
schema is always current. Locally, run it after pulling schema changes.

## Checklist

- [ ] Repo pushed, Actions enabled, secrets set
- [ ] `npm run db:migrate && npm run db:seed` executed once against production DB
- [ ] `npm run agent:test-integrations` green (DB, OpenAI, Telegram)
- [ ] Dry run reviewed (`workflow_dispatch` → dry-run)
- [ ] Admin auth configured (`AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`)
- [ ] Dashboard reachable (locally or hosted) for approvals
