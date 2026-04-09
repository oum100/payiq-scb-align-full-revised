# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

```bash
# Development
bun run dev              # Start HTTP server (Nuxt/Nitro)
bun run workers          # Start BullMQ background workers (separate process)
bun run db:up            # Start PostgreSQL + Redis via Docker Compose
bun run db:down          # Stop containers

# Database
bun run prisma:generate  # Regenerate Prisma client after schema changes
bun run prisma:migrate   # Run migrations (dev, creates migration files)
bun run prisma:deploy    # Apply migrations (production)
bun run seed             # Seed initial data
bun run seed:admin       # Seed first admin user (uses ADMIN_EMAIL / ADMIN_NAME env vars)

# Testing
bun run test             # All unit tests
bun run test:unit        # Unit tests with 10s timeout
bun run test:e2e         # E2E tests (requires PAYIQ_RUN_E2E=1, set automatically)
bun test tests/payments/payment-service.test.ts  # Single test file

# Code quality
bun run lint             # ESLint
bun run typecheck        # Nuxt typecheck
bun run check            # lint + typecheck

# Utilities
bun run reconcile:pending    # One-off reconciliation of pending payments
bun run reconcile:scheduler  # Run reconcile scheduler directly
```

---

## Architecture

PayIQ is a **Payment Gateway Middleware** — it sits between merchants and payment providers (currently SCB PromptPay QR). Built on **Nuxt 4 / Nitro** running on **Bun**.

### Two processes must run together

1. **HTTP Server** (`bun run dev`) — handles all API requests
2. **Workers** (`bun run workers`) — processes async BullMQ jobs from Redis queues

### Request Pipeline

Every API request flows through three ordered Nitro middlewares:

| File | Order | Purpose |
|------|-------|---------|
| `server/middleware/00-request-context.ts` | 0 | Injects `requestId` / `traceId` |
| `server/middleware/10.api-key-auth.ts` | 1 | Validates `x-api-key` header, resolves tenant/merchant/scopes |
| `server/middleware/20.rate-limit.ts` | 2 | Redis token-bucket rate limiting per API key and IP |
| `server/middleware/30.admin-auth.ts` | 3 | Session guard for all `/admin/*` routes |

### API Routes

```
server/api/v1/              — Merchant-facing REST API (auth required)
  payment-intents/          — Create/get payment intents
  providers/scb/callback    — SCB payment callbacks
  api-keys/                 — API key management
  webhooks/:provider        — Inbound webhooks

server/api/internal/        — Internal/ops endpoints (no auth)
  metrics.get.ts            — Prometheus metrics
  queues/                   — Queue health, DLQ retry
  webhook-deliveries/       — Delivery monitoring
  callbacks/                — Callback monitoring

server/api/admin/           — Admin dashboard API (session auth)
  auth/                     — Magic link auth (request → verify → session)
  dashboard/stats.get.ts
  payments/, merchants/, users/
```

### Domain Services (`server/services/`)

| Service | Responsibility |
|---------|---------------|
| `payments/` | PaymentIntent state machine, all state transitions |
| `auth/` | API key creation, verification, hashing |
| `routing/` | Resolves active PaymentRoute for a tenant/method/currency |
| `callbacks/` | Store and process inbound provider callbacks |
| `webhooks/` | Outbound webhook delivery to merchants |
| `reconcile/` | Compare internal state vs SCB inquiry API |
| `idempotency/` | Idempotency key reservation and deduplication |
| `providers/` | SCB adapter (OAuth token manager, QR creation, inquiry, signature) |
| `admin/` | Admin auth (magic link sessions), email sending |

### Payment Intent State Machine

States: `CREATED → ROUTING → PENDING_PROVIDER → AWAITING_CUSTOMER → PROCESSING → SUCCEEDED`  
Terminal: `FAILED`, `EXPIRED`, `CANCELLED`, `REVERSED`, `REFUNDED`

Every transition creates an immutable `PaymentEvent` record and runs inside a Postgres transaction with optimistic locking.

### Background Workers (`server/tasks/workers.ts`)

Five BullMQ workers, each consuming a named Redis queue:

| Queue | Worker | Concurrency |
|-------|--------|-------------|
| `payiq-callback` | Callback processor → triggers state transitions + enqueues webhooks | 20 |
| `payiq-webhook` | Webhook deliverer → HMAC-signed POST to merchant endpoints | 50 |
| `payiq-webhook-inbound` | Inbound webhook handler | 20 |
| `payiq-reconcile` | Reconcile individual payment vs SCB | 10 |
| `payiq-reconcile-scheduler` | Scans AWAITING_CUSTOMER every 60s, enqueues reconcile jobs | — |

Failed jobs exceed max retries → moved to Dead Letter Queue (DLQ). DLQ can be redriven via `POST /api/internal/queues/dlq/retry`.

### Frontend / Admin Dashboard (`app/`)

Nuxt frontend with `@nuxt/ui` (Tailwind v4). Admin dashboard at `/admin/*` uses magic-link email authentication. i18n via `nuxt-i18n-micro` with `th` (default) and `en` locales in `app/locales/`.

Layout: `app/loyouts/admin.vue` (note: directory is spelled `loyouts`, not `layouts`)  
Client-side route guard: `app/middleware/admin-auth.ts`  
Admin composable: `app/composables/useAdmin.ts`

### Key Infrastructure (`server/lib/`)

- `prisma.ts` — singleton Prisma client
- `redis.ts` — singleton ioredis client
- `bullmq.ts` — shared BullMQ helpers
- `logger.ts` — structured logger
- `errors.ts` — domain error types
- `apiKeyCrypto.ts` — API key format: `pk_test_<prefix>.<secret>` with SHA-256 timing-safe compare
- `rate-limit/` — Lua-script atomic token bucket

### Multi-tenancy

Every resource is scoped to `tenantId`. `BillerProfile` stores SCB credentials per tenant. `ApiKey` can be scoped to a `MerchantAccount` within a tenant.

---

## Testing

- Test files live in `tests/` mirroring the service structure
- `tests/setup.ts` is preloaded for all tests — sets `NODE_ENV=test` and test env vars
- Unit tests mock external dependencies (Prisma, Redis, BullMQ)
- E2E tests (`*.e2e.test.ts`) require live Postgres + Redis; guarded by `PAYIQ_RUN_E2E=1`
- Each test file that uses `mock.module(...)` must call `afterAll(() => mock.restore())` — do not add global mock restores in `setup.ts`

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `APP_BASE_URL` | Public server URL (used for callback URL construction) |
| `SCB_API_BASE_URL` | SCB API base URL |
| `SCB_CLIENT_ID` / `SCB_CLIENT_SECRET` | SCB OAuth credentials |
| `SCB_CALLBACK_SECRET` | HMAC secret for verifying SCB callbacks |
| `PAYIQ_PROVIDER_MODE` | Set to `mock` to skip real SCB calls (dev/test) |
| `WEBHOOK_SECRET` | HMAC secret for inbound webhook verification |
| `WEBHOOK_IP_ALLOWLIST` | Comma-separated IPs allowed to hit inbound webhook endpoint |
| `RESEND_API_KEY` / `RESEND_FROM` | Email sending for admin magic links (if unset, link prints to console) |
| `ADMIN_EMAIL` / `ADMIN_NAME` | Used by `seed-admin.ts` script |
