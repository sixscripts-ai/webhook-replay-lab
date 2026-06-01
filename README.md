# Webhook Replay Lab

A full-stack developer tool for capturing webhook events, inspecting payloads,
replaying failed deliveries, and tracking retry history. Built like an
internal reliability tool — not a chatbot.

## Why it exists

Real webhook integrations break. Providers retry inconsistently, target
services time out, and signatures shift. This app gives you a captured,
queryable, replayable history of every event your system received — so you
can diagnose failures, replay successful deliveries, and prove integration
behavior with evaluations.

## What it proves

- API route design (Next.js App Router route handlers)
- Postgres schema modeling for events, attempts, targets, and audit logs
- Server-side validation with Zod
- Retry/replay logic that never mutates the original payload
- Audit logging for every significant action
- Operational dashboard UI in a dark technical style
- Evaluation workflows via EvalBench Lite (Milestone 2)

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Postgres + Prisma
- Zod for validation
- Server components by default; client components only for interactivity

## Local setup

```bash
npm install
cp .env.example .env       # then edit DATABASE_URL
npx prisma migrate dev     # creates the schema
npx prisma db seed         # loads demo data
npm run dev                # http://localhost:3000
```

### Environment variables

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `NEXT_PUBLIC_APP_URL` | Public URL for server-side link construction |

A SQLite-style URL like `file:./prisma/dev.db` will not work — the schema
uses Postgres-only `Json` columns and enums. Use a local Postgres instance
(Docker, Postgres.app, etc.) and update `DATABASE_URL` accordingly.

### Database setup

```bash
# generate the prisma client (auto-runs on install)
npx prisma generate

# apply migrations
npx prisma migrate dev

# seed demo data
npx prisma db seed
```

### Seed command

`npx prisma db seed` (or `npm run db:seed`) loads:
- 3 replay targets across stripe-demo, github-demo, shopify-demo
- 6 webhook events with varied statuses
- 2 historical replay attempts
- Sample audit log entries
- 2 eval test cases (used in Milestone 2)

## Test webhook command

```bash
curl -X POST http://localhost:3000/api/webhooks/stripe-demo \
  -H "Content-Type: application/json" \
  -H "x-event-type: payment.failed" \
  -d '{"id":"evt_demo_001","type":"payment.failed","amount":4200,"customer":"cus_demo"}'
```

Returns `202 Accepted` with the new event id. The event will appear in the
inbox at `/events`.

## Replay behavior

- Replay clones the stored payload — the original is **never** mutated.
- Replay forwards to the event's stored `targetId`, falling back to the
  first active target for the same provider.
- Stored headers are forwarded (with hop-by-hop headers stripped) and
  augmented with `x-replay`, `x-replay-event-id`, and original-provider
  metadata.
- A `ReplayAttempt` row is recorded for every attempt — success or failure.
- The parent event's `status` flips to `replayed` on success or `failed` on
  failure (with `errorMessage` populated).
- Every replay writes an audit log entry.

Trigger a replay programmatically:

```bash
curl -X POST http://localhost:3000/api/events/<event_id>/replay \
  -H "Content-Type: application/json" \
  -d '{}'
```

Optional body:

```json
{
  "targetId": "tgt_demo_stripe",
  "headerOverrides": { "x-trace-id": "manual-replay" }
}
```

## EvalBench Lite behavior

EvalBench Lite (Milestone 2) defines replay test cases — each with an
expected status code and optional `expectedBodyIncludes`. Running a test
case replays the linked event against the configured target and records:

- pass/fail status
- expected vs actual response status
- evidence from the response body
- notes on the failure reason

Schema is already provisioned in `prisma/schema.prisma` (`EvalTestCase`,
`EvalRun`). The runner endpoint and UI ship in Milestone 2.

## Verification commands

```bash
npm install
npm run dev
npm run lint
npm run build
npx prisma migrate dev
npx prisma db seed
```

Health check: `GET /api/health` returns `{ ok: true, database: "ok" }` when
the database is reachable.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Dashboard — totals, failure rate, recent events |
| `/events` | Inbox — searchable, filterable list |
| `/events/[id]` | Detail — metadata, headers, payload, replay, audit |
| `/targets` | Replay target list |
| `/audit` | Audit log |
| `/evals` | EvalBench Lite (Milestone 2) |
| `POST /api/webhooks/[provider]` | Ingest a webhook |
| `POST /api/events/[id]/replay` | Replay a stored event |
| `GET /api/health` | App + DB health |

## Milestone status

- **Milestone 1 (this commit)** — Project scaffold, database schema,
  seed data, dashboard, events inbox, event detail, webhook capture,
  replay, audit logging, health check, dark technical UI.
- **Milestone 2** — EvalBench Lite (`/api/evals/[id]/run`, `/evals` UI,
  `EvalRunTable`), target create/edit form, additional polish.
