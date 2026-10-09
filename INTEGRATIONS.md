# Integrations

Status levels, applied honestly:

- **WORKING** — implemented against a public/official API; works without approval processes. Mark `tested` in the DB only after you verify it live.
- **REQUIRES_CREDENTIALS** — fully implemented; needs a token/key you must obtain.
- **REQUIRES_APPROVAL** — implemented, but the platform gates access behind an approval process and/or requires human confirmation to submit.
- **MANUAL_ONLY** — no suitable public API; jobs enter via dashboard import. The full qualification → proposal → approval pipeline still applies.
- **UNSUPPORTED** — not implemented.

No placeholder is presented as a working integration.

| Platform | Discovery | Submission | Status | Application cost |
|---|---|---|---|---|
| Upwork | Official GraphQL API (needs approved key) | **Never automated** — your confirmation is mandatory | REQUIRES_CREDENTIALS → REQUIRES_APPROVAL | Connects (~$0.15 ea) |
| Freelancer.com | Official REST API | Official bids API (approval-gated by default) | REQUIRES_CREDENTIALS | Free (monthly bid allowance) |
| RemoteOK | Public JSON API | Manual (employer site) | WORKING | Free |
| Remotive | Public JSON API | Manual (employer site) | WORKING | Free |
| We Work Remotely | Public RSS | Manual | WORKING | Free |
| Custom RSS feeds | Any permitted feed | Manual | WORKING | Free |
| Contra | — | Manual | MANUAL_ONLY | Free |
| PeoplePerHour | — | Manual | MANUAL_ONLY | Credits |
| Guru | — | Manual | MANUAL_ONLY | Bids |
| Truelancer | — | Manual | MANUAL_ONLY | Proposals |
| Workana | — | Manual | MANUAL_ONLY | Free tier |
| Email job alerts | — | Manual | MANUAL_ONLY | Free |

## Upwork (individual freelancer account)

**Research findings (October 2025):**

- Scraping Upwork violates its ToS. Not implemented, by design.
- The **official API** (GraphQL, `api.upwork.com/graphql`) requires an approved
  API key plus OAuth2. The `marketplaceJobPostingsSearch` query additionally
  requires partner-level API approval that Upwork grants case by case.
- The **official MCP server** (`https://mcp.upwork.com/mcp`) is designed for
  interactive AI clients (Claude, ChatGPT connectors, etc.): you OAuth in your
  client, and it exposes job search and proposal drafting. **Proposal submission
  always ends with you confirming in Upwork's UI.** It is not a headless API,
  and the OpenAI API cannot invoke it automatically on a server. A standalone
  worker therefore cannot — and must not — submit Upwork proposals unattended.

**What GigPilot implements:**

1. Discovery through the official GraphQL API when `UPWORK_ACCESS_TOKEN` is set
   (untested until you have an approved key — reported honestly as such).
2. Without a token: import Upwork jobs via the dashboard (paste URL + description),
   optionally finding them with the official MCP server in your AI client.
3. Qualification + proposal generation run normally.
4. Proposals are queued in **/approvals** with the estimated Connects cost shown.
   You submit through Upwork's own flow and record the confirmation. This is the
   required workflow — GigPilot never bypasses Upwork's confirmation step.
5. Connects: tracked against your Upwork Connects budget (default $15/mo, configurable);
   **never purchased automatically**.
6. Individual account only — no agency permissions assumed. Proposals are written
   in first person as the developer, referencing your business where Upwork's
   branding rules permit.

## Freelancer.com

The official developer API ([developers.freelancer.com](https://developers.freelancer.com))
supports both project search and **bid placement** for the authenticated user:

- `GET /projects/0.1/projects/active` — search (implemented).
- `POST /projects/0.1/bids` — place a bid (implemented).

Setup: create an app at accounts.freelancer.com/settings/develop, generate an
OAuth token with `basic` + `bid` scopes, set `FREELANCER_OAUTH_TOKEN`.

Submission policy: even though the API permits programmatic bids, GigPilot
defaults to **approval mode**. Autonomous submission requires all of:
1. `submissionMode = autonomous` in settings,
2. the `freelancer` source row marked `tested = true` (set it only after you've
   verified a real bid end-to-end),
3. valid credentials.

Bidding uses the account's free monthly bid allowance. GigPilot never buys bid credits.

## RemoteOK / Remotive / We Work Remotely

Public APIs/feeds that permit automated consumption (attribution/link-back
required by RemoteOK and Remotive — job URLs always link to the source).
These are job boards: applying happens on the employer's site, so proposals
become READY_FOR_MANUAL_SUBMISSION with the listing link.

## Manual import (Contra, PeoplePerHour, Guru, Truelancer, Workana, email alerts)

These platforms have no public APIs suitable for automated discovery by third
parties. Use **Jobs → Import job**: paste the URL, title, and description.
Email alerts: forward/paste the listing the same way. Everything downstream
(dedup, scoring, AI evaluation, proposal, approval) works identically.

## Adding a new source

Implement `SourceAdapter` (`src/worker/sources/types.ts`), report capabilities
honestly, register it in `registry.ts`, add a seed entry (`npm run db:seed`),
and write a mocked-fetch unit test. Never claim `submissionSupported` unless the
platform's terms explicitly permit unattended programmatic bidding.
