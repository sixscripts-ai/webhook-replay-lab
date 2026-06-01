# Webhook Replay Lab

A full-stack developer tool for capturing webhook events, inspecting payloads,
replaying failed deliveries, and tracking retry history.

**Live demo:** https://webhookreplay-lab.vercel.app/

## What it does

- Captures any incoming webhook (POST `/api/webhooks/<provider>`) verbatim —
  headers, body, and resolved event type are stored.
- Indexes events in a Postgres-backed inbox with provider/status/date filters.
- Replays stored events to a configured target URL without mutating the
  original payload, recording response status, body, duration, and error.
- Lets you create, edit, enable, and disable replay targets directly from
  the Targets page (with URL validation).
- Picks a target per replay from the event detail page (defaults to the
  event's stored target, then any active target matching the provider).
- Records an audit log entry for every significant action (event received,
  target created/updated/enabled/disabled, replay started/succeeded/failed,
  eval run started/passed/failed).
- Surfaces an EvalBench Lite that pins event + target pairs to an expected
  status. Click **Run** to perform a real replay and record pass/fail.
- Ships a safe internal receiver at `/api/demo-receiver/<provider>` so
  replays work end-to-end without external services. It supports
  `forceFailure: true`, `forceStatus: <code>`, and `delayMs: <ms>` to
  simulate failure modes.

## Stack

- Next.js 14 (App Router)
- TypeScript + Tailwind CSS
- Postgres (Neon) + Prisma 5 with the `@prisma/adapter-neon` driver adapter
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
| `MIGRATION_TOKEN` | Required to call `/api/admin/migrate` and `/api/admin/seed` |
| `NEXT_PUBLIC_APP_URL` | Public URL for server-side link construction (optional) |

A SQLite URL will not work — the schema uses Postgres-only `Json` columns
and enums.

### Database setup

```bash
npx prisma generate
npx prisma migrate dev   # local
npx prisma db seed       # local
```

### Seed command

`npx prisma db seed` (or `npm run db:seed`) loads:

- 3 replay targets (stripe-demo, github-demo, shopify-demo)
- 6 webhook events (2 failed, 2 successful, 1 received, 1 replayed)
- 2 historical replay attempts (1 success, 1 failure)
- 9 audit log entries
- 2 eval test cases + 2 eval runs

## Test webhook command

```bash
curl -X POST https://webhookreplay-lab.vercel.app/api/webhooks/stripe-demo \
  -H "Content-Type: application/json" \
  -H "x-event-type: payment.failed" \
  -d '{"id":"evt_demo_001","type":"payment.failed","amount":4200,"customer":"cus_demo"}'
```

Returns `202 Accepted` with the new event id. Refresh `/events` to see it.

## Replay behavior

- Replay clones the stored payload — the original is **never** mutated.
- Replay forwards to the event's stored `targetId`, falling back to the
  first active target for the same provider.
- Stored headers are forwarded (hop-by-hop headers stripped) and augmented
  with `x-replay`, `x-replay-event-id`, original-provider metadata, and any
  caller-supplied `headerOverrides`.
- A `ReplayAttempt` row is recorded for every attempt — success or failure —
  with response status, response body (capped at 8KB), duration, and error.
- The parent event's `status` flips to `replayed` on success or `failed` on
  failure (with `errorMessage` populated).
- An audit log entry is written for every replay.

Trigger a replay programmatically:

```bash
curl -X POST https://webhookreplay-lab.vercel.app/api/events/<event_id>/replay \
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

## EvalBench Lite

`EvalTestCase` rows pin an event + target with an `expectedStatus` and an
optional `expectedBodyIncludes` substring. Clicking **Run** on the
[Evals page](https://webhookreplay-lab.vercel.app/evals) executes a real
replay against the linked target and records an `EvalRun`:

- **pass** — response status matches `expectedStatus` AND, if
  `expectedBodyIncludes` is set, the response body contains that substring.
- **fail** — otherwise. The notes column explains which check failed.

Run history (last 10) is available behind the **history** toggle. Audit
logs are written for `eval.run.started`, `eval.run.passed`, and
`eval.run.failed`.

You can also trigger a run programmatically:

```bash
curl -X POST https://webhookreplay-lab.vercel.app/api/evals/eval_demo_1/run
```

## Demo receiver

```bash
curl -X POST https://webhookreplay-lab.vercel.app/api/demo-receiver/stripe \
  -H "Content-Type: application/json" \
  -d '{"hello":"world"}'
# 200 { ok: true, ... }

# Force a 500
curl -X POST https://webhookreplay-lab.vercel.app/api/demo-receiver/stripe \
  -H "Content-Type: application/json" \
  -d '{"forceFailure":true}'

# Force a specific status
curl -X POST https://webhookreplay-lab.vercel.app/api/demo-receiver/stripe \
  -H "Content-Type: application/json" \
  -d '{"forceStatus":429}'

# Add latency
curl -X POST https://webhookreplay-lab.vercel.app/api/demo-receiver/stripe \
  -H "Content-Type: application/json" \
  -d '{"delayMs":750}'
```

Seeded targets default to this receiver so replay works out of the box.

## Verification commands

```bash
npm install
npm run lint
npm run build
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

Manual checks against the deployed app:

```bash
# Health
curl https://webhookreplay-lab.vercel.app/api/health

# Capture an event
curl -X POST https://webhookreplay-lab.vercel.app/api/webhooks/stripe-demo \
  -H "Content-Type: application/json" \
  -H "x-event-type: payment.failed" \
  -d '{"id":"manual_test","type":"payment.failed"}'
```

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Dashboard — totals, failure rate, recent events, Try-It snippet |
| `/events` | Inbox — searchable, filterable event list |
| `/events/[id]` | Detail — metadata, headers, payload, replay panel, replay history, audit |
| `/targets` | Replay target list with create/edit/enable/disable |
| `/audit` | Audit log |
| `/evals` | EvalBench Lite — run test cases, view history |
| `POST /api/webhooks/[provider]` | Ingest a webhook |
| `POST /api/events/[id]/replay` | Replay a stored event (body: `{ targetId?, headerOverrides? }`) |
| `GET /api/targets` · `POST /api/targets` | List / create targets |
| `GET/PATCH /api/targets/[id]` | Read / update a target |
| `POST /api/evals/[id]/run` | Run an eval test case |
| `POST /api/demo-receiver/[provider]` | Safe internal receiver for replays |
| `GET /api/health` | App + DB health |
| `POST /api/admin/migrate?token=…` | One-shot schema migration (Vercel-only) |
| `POST /api/admin/seed?token=…` | One-shot demo seed (Vercel-only) |

## Known limitations

- No authentication. Anyone with the URL can create targets and replay
  events. Admin endpoints (`/api/admin/*`) require `MIGRATION_TOKEN`.
- Targets cannot be deleted from the UI; disable them instead.
- EvalBench Lite uses the case's stored `expectedBodyIncludes` as a simple
  substring match. There is no schema-aware matcher yet.
- Replays time out after 15 seconds.

## Deployment notes (Vercel + Neon)

- Schema migrations run via `POST /api/admin/migrate?token=<MIGRATION_TOKEN>`.
  Prisma's `migrate deploy` doesn't work through Neon's PgBouncer pooler, so
  the endpoint applies SQL directly via the Neon serverless `Pool`.
- Seeding production also runs from Vercel:
  `POST /api/admin/seed?token=<MIGRATION_TOKEN>`.
- The Prisma client uses the Neon driver adapter (`@prisma/adapter-neon`)
  with WebSocket transport (`ws`) so it works on Vercel's serverless runtime.
- Build runs `prisma generate` only (no migrations).
- Deployment Protection must be configured to allow public access for the
  hosted demo.
