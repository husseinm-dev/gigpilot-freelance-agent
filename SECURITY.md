# Security

## Authentication & sessions

- Single-admin login: `ADMIN_EMAIL` + bcrypt `ADMIN_PASSWORD_HASH` (cost 12),
  both environment variables — no password in the database.
- Sessions are HS256 JWTs (jose) in an `httpOnly`, `sameSite=lax`, `secure`
  (production) cookie, 7-day expiry, signed with `AUTH_SECRET` (≥16 chars;
  generate with `openssl rand -base64 32`).
- `src/proxy.ts` (Next.js route proxy) verifies the JWT on every non-public
  route; API routes return 401, pages redirect to /login.
- Every server action re-checks the session (`requireUser()`) — defense in depth
  beyond middleware.

## Secrets

- All secrets (`OPENAI_API_KEY`, `DATABASE_URL`, tokens) live only in:
  - local `.env` (gitignored), or
  - GitHub Actions **secrets**, or
  - the host's server-side environment.
- The database stores **credential metadata only** (`integration_credentials_metadata`:
  which env var, scopes, expiry) — never secret values.
- Nothing secret is ever sent to the browser: the dashboard uses server
  components/actions exclusively for sensitive data; `NEXT_PUBLIC_` vars are not used.
- The Telegram client refuses to send messages matching secret patterns
  (`sk-…`, AWS keys, PEM blocks) — defense in depth.
- Never commit `.env`. `.gitignore` covers it.

## Input validation

- Every API route and server action parses input with Zod before use.
- AI outputs are Zod-validated structured outputs — malformed model output is
  rejected, never trusted.
- External API responses are typed and defensively accessed.

## Rate limiting

- Login: fixed-window limiter (10 attempts / 15 min / IP) + generic error
  messages (no credential-field disclosure).
- Outbound: per-source politeness delays; per-run caps bound all external calls.

## Audit logging

`audit_logs` records logins (success/failure, IP), proposal approvals/rejections/edits,
manual submissions, settings and budget changes, source toggles, imports, and
outcome entries — with actor, entity, and timestamp.

## Least privilege

- Freelancer token: request only `basic` + `bid` scopes.
- Upwork token: read/search scopes only — submission is intentionally not automated.
- Telegram bot: can only message the chat that initiated contact.
- Database: use the Supabase connection string for a dedicated database; no
  service-role keys are used anywhere.

## Secure error handling

- Worker errors are logged with stack traces to `automation_events` and GitHub
  Actions logs (private), while Telegram alerts contain truncated,
  secret-filtered messages.
- Dashboard errors surface generic messages; details stay server-side.

## Financial safety

- No code path purchases anything (Connects, credits, upgrades).
- Budget enforcement is atomic at the SQL level — even concurrent workers
  cannot jointly overshoot.
- Submission idempotency keys make duplicate bids impossible at the
  database-constraint level, not just application logic.
- Contracts are never accepted automatically; offers only generate notifications.
