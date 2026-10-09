# Costs

GigPilot is designed to operate for **under $1/month** in AI costs at default limits,
with a hard ceiling of **$5/month** (configurable).

## Budget categories

| Category | Default | Notes |
|---|---|---|
| OpenAI API | $5/month | Hard-enforced at the application level |
| Upwork Connects | $15/month suggested, $0 enforced until you set it | Spending always requires per-proposal approval |
| Other marketplace credits | $0/month | Free platforms are prioritized |
| Hosting | $0 | GitHub Actions free tier + Supabase free tier + local dashboard |

## How OpenAI enforcement works

Every AI call goes through `structuredCall()` which:

1. **Estimates conservatively** — input tokens at 1 token per 3 characters
   (English is ~4 chars/token, so this over-reserves) plus the full
   `max_output_tokens` at output pricing.
2. **Reserves atomically** — a single SQL `UPDATE monthly_budgets SET reserved = reserved + est
   WHERE spent + reserved + est <= limit - safety_buffer`. If no row updates,
   `BudgetExceededError` is thrown **before any API spend** and the pipeline
   stops AI work gracefully.
3. **Calls** the Responses API with a strict `max_output_tokens`.
4. **Reconciles** — actual token usage reported by OpenAI replaces the estimate
   (`reserved -= estimate; spent += actual`), recorded per-call in `api_usage`.
5. **Releases** the reservation if the call fails (OpenAI doesn't bill failed requests).

Because reservation happens before the call and the WHERE clause is atomic,
concurrent calls cannot jointly overshoot, and a crash mid-call leaves money
reserved (safe direction) until the row is reconciled.

## Safety buffer

Default $0.50 is subtracted from the limit, absorbing estimate error. At a $5
limit, AI work stops at ~$4.50 actual spend.

## Pricing table

`src/lib/costs/pricing.ts` — per-million-token prices, editable:

| Model | Input /1M | Output /1M |
|---|---|---|
| gpt-4o-mini (default) | $0.15 | $0.60 |
| gpt-4.1-mini | $0.40 | $1.60 |
| gpt-4.1-nano | $0.10 | $0.40 |
| gpt-5-mini | $0.25 | $2.00 |
| gpt-5-nano | $0.05 | $0.40 |

Verify against [openai.com/api/pricing](https://openai.com/api/pricing) before
switching models. **Unknown models fall back to expensive pricing** ($5/$20) so a
typo can only over-reserve, never under-reserve. The system never upgrades
models automatically.

## Expected costs at default limits

Per evaluation: ~2.5K input + ≤700 output tokens ≈ **$0.0008**.
Per proposal: ~2K input + ≤900 output tokens ≈ **$0.0008**.

Worst-case day (2 runs × 15 evals + 2 × 5 proposals): ≈ **$0.03/day ≈ $0.90/month** —
comfortably inside $5.

## What is never spent

- No paid OpenAI web-search tools (off by default; `webSearchEnabled` setting exists but no paid tool is wired).
- No paid scraping services.
- No automatic purchase of Connects, bid credits, or memberships — there is no
  code path that buys anything.

## Upwork Connects economics

Applying on Upwork costs Connects (~$0.15 each, typically 4–16+ per proposal —
roughly $0.60–$2.40+ per application, non-refundable if not hired). That is why:

- Free-to-apply sources are prioritized in discovery and scoring
  (`preferFreeApplicationSources`, on by default).
- Every Upwork approval card shows the estimated Connects cost before you commit.
- The Upwork Connects budget is tracked separately in `monthly_budgets`
  (category `marketplace_credits`, platform `upwork`).

## Tracking & visibility

- `api_usage` — every call: model, purpose, estimated vs actual cost, tokens, run.
- `monthly_budgets` — limit / reserved / spent per category per month.
- Dashboard → Budgets: live remaining budget; Dashboard & Analytics: per-run and
  monthly spend; Telegram summary includes run cost and month-to-date.
- Reconciliation against OpenAI's own usage dashboard: compare the `api_usage`
  monthly sum with platform.openai.com/usage — they should match within rounding.
