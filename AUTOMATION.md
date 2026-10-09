# Automation

## Schedule

Target: **9:00 AM** and **6:00 PM** America/New_York, every day.

GitHub Actions cron is UTC-only and New York shifts between UTC-5 (EST) and
UTC-4 (EDT). The workflow therefore fires at **four** UTC times:

| Cron (UTC) | Matches |
|---|---|
| `0 13 * * *` | 9 AM EDT (summer) |
| `0 14 * * *` | 9 AM EST (winter) |
| `0 22 * * *` | 6 PM EDT |
| `0 23 * * *` | 6 PM EST |

On every trigger the worker computes the current New York local time:

- Outside a run window (9:00–12:59 or 18:00–21:59 local) → exits without work.
  This absorbs the "wrong offset" trigger each day.
- Inside a window → derives the slot key (`YYYY-MM-DD-morning|evening`).

## Idempotency & overlap prevention

Three independent layers:

1. **Unique slot key** — `automation_runs.slot_key` has a unique index. The run
   row is inserted with `ON CONFLICT DO NOTHING`; if a row already exists for
   this slot (e.g. both UTC crons landed in the window, or a delayed re-run),
   the worker exits immediately.
2. **Postgres advisory lock** — `pg_try_advisory_lock` is held for the whole
   run, so two overlapping processes can never run the pipeline concurrently.
3. **GitHub Actions concurrency group** — `concurrency: gigpilot-automation`
   queues workflow runs instead of overlapping them.

Delayed runs: GitHub cron can start late. The window is deliberately wide
(4 hours); a late trigger still maps to the correct slot and the unique key
guarantees it does nothing if the slot already ran.

## Manual execution

- **GitHub**: Actions → *GigPilot Automation* → Run workflow → `manual` or `dry-run`.
- **Locally**: `npm run agent:manual` / `npm run agent:dry-run`.

Manual runs get timestamped slot keys so they never collide with scheduled slots.

## Dry-run mode

`npm run agent:dry-run` (or `GIGPILOT_DRY_RUN=1`):
- Full discovery, dedup, filtering, AI evaluation, proposal generation
  (AI calls still consume budget — keep evaluations low if testing often).
- **Never** submits bids.
- Prints the Telegram summary to stdout instead of sending it.

## Retry & failure handling

- Each source failure is caught, logged to `automation_events` and
  `job_sources.last_error`; other sources continue.
- Each AI failure is caught per job; the run continues.
- Failed submission attempts are recorded with error details; a later run may
  retry (attempt number increments) — but only if the attempt status is `failed`,
  never after `submitted`/`in_progress`.
- A fatal error marks the run `failed`, sends a Telegram alert, and exits
  non-zero so GitHub Actions also alerts (plus the workflow's failure step).

## Emergency pause

- **Dashboard**: Pause button → sets `settings.paused`. The worker checks it
  first thing and exits. Resume the same way.
- **GitHub**: disable the workflow entirely.
- **Budget**: setting the OpenAI budget to $0 stops all AI work while still
  allowing discovery.

## Run history

Every run is recorded in `automation_runs` (slot, trigger, status, per-stage
counts, AI cost, error). The dashboard's /automation page shows the last 30
runs and a live event log.
