# PayIQ — Payment Gateway Middleware

**PayIQ** คือ Payment Gateway Middleware Platform สร้างบน Nuxt 4 (Nitro/H3) ทำหน้าที่เป็น **Abstraction Layer** ระหว่าง Merchant กับ Payment Provider (ปัจจุบันรองรับ SCB PromptPay QR) โดยจัดการครบวงจรตั้งแต่ สร้าง Payment Intent, รับ Callback จาก Provider, แจ้ง Webhook ไปยัง Merchant และ Reconcile สถานะอัตโนมัติ

---

## Logical Architecture Diagram

```mermaid
graph TB
    subgraph Merchant["🏪 Merchant / Client"]
        M_API["REST API Client"]
        M_WH["Webhook Listener"]
    end

    subgraph PayIQ_HTTP["🌐 PayIQ — HTTP Server (Nuxt 4 / Nitro)"]
        direction TB
        MW1["Middleware 00\nRequest Context\n(requestId / traceId)"]
        MW2["Middleware 10\nAPI Key Auth"]
        MW3["Middleware 20\nRate Limit (Redis Token Bucket)"]

        subgraph Routes_V1["API Routes /api/v1/*"]
            R1["POST /payment-intents\n(Create Payment)"]
            R2["GET /payment-intents/:id\n(Get Status)"]
            R3["POST /providers/scb/callback\n(SCB Callback)"]
            R4["POST /api-keys/**\n(Key Management)"]
            R5["POST /webhooks/:provider\n(Inbound Webhook)"]
        end

        subgraph Routes_Internal["Internal Routes /api/internal/*"]
            RI1["GET /metrics\n(Prometheus)"]
            RI2["GET /queues/health"]
            RI3["POST /queues/dlq/retry"]
            RI4["/webhook-deliveries/**"]
        end
    end

    subgraph Services["⚙️ Domain Services"]
        SVC_PAY["PaymentService\n(State Machine)"]
        SVC_ROUTE["RoutingService\n(Route Resolution)"]
        SVC_AUTH["AuthService\n(API Key CRUD)"]
        SVC_IDEM["IdempotencyService"]
        SVC_CB["CallbackService\n(Store & Process)"]
        SVC_WH["WebhookService\n(Outbound Delivery)"]
        SVC_RECON["ReconcileService"]
    end

    subgraph Providers["🔌 Provider Adapters"]
        PR_REG["Provider Registry"]
        subgraph SCB["SCB Adapter"]
            SCB_AUTH["OAuth Token Manager\n(with cache)"]
            SCB_CLIENT["HTTP Client"]
            SCB_MAP["Request/Response Mapper"]
            SCB_SIG["Signature Verifier"]
            SCB_WH["Callback Normalizer"]
        end
    end

    subgraph Workers["⚡ Background Workers (BullMQ — bun run workers)"]
        W1["Callback Processor\nconcurrency: 20"]
        W2["Webhook Deliverer\nconcurrency: 50"]
        W3["Inbound Webhook Handler\nconcurrency: 20"]
        W4["Payment Reconciler\nconcurrency: 10"]
        W5["Reconcile Scheduler\n(every 60s)"]
    end

    subgraph Queues["📨 Redis Queues (BullMQ)"]
        Q1["payiq-callback"]
        Q2["payiq-webhook"]
        Q3["payiq-webhook-inbound"]
        Q4["payiq-reconcile"]
        Q5["payiq-reconcile-scheduler"]
        DLQ["Dead Letter Queues (DLQ)"]
    end

    subgraph Infra["🗄️ Infrastructure"]
        DB[("PostgreSQL 16\n(Prisma ORM)")]
        REDIS[("Redis 7\n(ioredis)")]
    end

    subgraph ExtProvider["☁️ External — SCB API"]
        SCB_TOKEN["OAuth Token Endpoint"]
        SCB_QR["QR Create Endpoint\n/payment/qrcode/create"]
        SCB_INQ["Payment Inquiry\n/payment/billpayment/inquiry"]
        SCB_CB_SRC["SCB Callback Source"]
    end

    %% Merchant → HTTP
    M_API -->|"x-api-key + JSON"| MW1
    MW1 --> MW2 --> MW3
    MW3 --> Routes_V1
    MW3 --> Routes_Internal

    %% Routes → Services
    R1 --> SVC_PAY
    R2 --> SVC_PAY
    R3 --> SVC_CB
    R4 --> SVC_AUTH
    R5 --> SVC_CB

    %% Payment flow
    SVC_PAY --> SVC_ROUTE
    SVC_PAY --> SVC_IDEM
    SVC_ROUTE --> PR_REG
    PR_REG --> SCB

    %% SCB calls external
    SCB_AUTH -->|"OAuth"| SCB_TOKEN
    SCB_CLIENT -->|"QR Create"| SCB_QR
    SCB_CLIENT -->|"Inquiry"| SCB_INQ

    %% Callback from SCB
    SCB_CB_SRC -->|"POST callback"| R3
    SVC_CB -->|"Enqueue"| Q1

    %% Workers consuming queues
    Q1 --> W1
    Q2 --> W2
    Q3 --> W3
    Q4 --> W4
    Q5 --> W5

    %% Worker processing
    W1 -->|"Process & transition state"| SVC_PAY
    W1 -->|"Enqueue webhook"| Q2
    W2 -->|"HMAC-signed POST"| M_WH
    W3 --> SVC_CB
    W4 --> SVC_RECON
    W5 -->|"Scan & enqueue"| Q4

    %% On failure → DLQ
    W1 & W2 & W3 & W4 -.->|"Max retries exceeded"| DLQ
    RI3 -->|"Redrive"| DLQ

    %% Services → DB
    SVC_PAY <--> DB
    SVC_AUTH <--> DB
    SVC_CB <--> DB
    SVC_WH <--> DB
    SVC_RECON <--> DB
    SVC_IDEM <--> DB

    %% Services → Redis
    MW2 <--> REDIS
    MW3 <--> REDIS
    SCB_AUTH --> REDIS
    SVC_CB --> REDIS
```

---

## Payment Intent State Machine

```mermaid
stateDiagram-v2
    [*] --> CREATED : POST /payment-intents

    CREATED --> ROUTING : Route resolution starts
    ROUTING --> PENDING_PROVIDER : Route found, calling provider
    ROUTING --> FAILED : No active route
    ROUTING --> CANCELLED : Cancelled before provider call

    PENDING_PROVIDER --> AWAITING_CUSTOMER : QR created successfully
    PENDING_PROVIDER --> FAILED : Provider error
    PENDING_PROVIDER --> CANCELLED : Cancelled

    AWAITING_CUSTOMER --> PROCESSING : Payment detected (callback)
    AWAITING_CUSTOMER --> SUCCEEDED : Instant success callback
    AWAITING_CUSTOMER --> FAILED : Provider callback FAILED
    AWAITING_CUSTOMER --> EXPIRED : Timeout / reconcile expired
    AWAITING_CUSTOMER --> CANCELLED : Cancelled

    PROCESSING --> SUCCEEDED : Confirmed success
    PROCESSING --> FAILED : Confirmation failed

    SUCCEEDED --> REVERSED : Reversal processed
    SUCCEEDED --> REFUNDED : Refund processed

    FAILED --> [*]
    EXPIRED --> [*]
    CANCELLED --> [*]
    REVERSED --> [*]
    REFUNDED --> [*]
```

> ทุก state transition บันทึกใน **PaymentEvent** (immutable audit trail) และดำเนินการภายใน Postgres Transaction พร้อม Optimistic Lock

---

## Payment Creation Flow (Sequence)

```mermaid
sequenceDiagram
    actor Merchant
    participant API as PayIQ API
    participant Auth as Auth Middleware
    participant PaySvc as Payment Service
    participant SCB as SCB Adapter
    participant DB as PostgreSQL
    participant Redis as Redis

    Merchant->>API: POST /api/v1/payment-intents<br/>(x-api-key, idempotency-key)
    API->>Auth: Validate API Key
    Auth->>DB: Lookup key prefix + verify hash
    Auth->>Redis: Check rate limit (token bucket)
    Redis-->>Auth: Allowed
    Auth-->>API: AuthContext (tenant, merchant, scopes)

    API->>PaySvc: createPaymentIntent(request, auth)
    PaySvc->>DB: Check duplicate merchantOrderId
    PaySvc->>DB: Reserve idempotency key (optimistic lock)
    PaySvc->>DB: INSERT PaymentIntent (CREATED)
    PaySvc->>DB: Transition → ROUTING
    PaySvc->>DB: Resolve PaymentRoute (tenant+method+currency)
    PaySvc->>DB: Transition → PENDING_PROVIDER

    PaySvc->>SCB: createPayment(intent)
    SCB->>Redis: Get cached OAuth token
    alt Token expired
        SCB->>SCB API: POST /oauth/token
        SCB->>Redis: Cache new token
    end
    SCB->>SCB API: POST /payment/qrcode/create
    SCB API-->>SCB: { qrRawData, qrImage, transactionId }
    SCB-->>PaySvc: { status: AWAITING_CUSTOMER, qrPayload }

    PaySvc->>DB: Transition → AWAITING_CUSTOMER
    PaySvc->>DB: Save ProviderAttempt (success)
    PaySvc->>DB: Complete idempotency record
    PaySvc-->>API: PaymentIntent response
    API-->>Merchant: 201 { publicId, qrPayload, expiresAt, ... }
```

---

## Callback & Webhook Delivery Flow (Sequence)

```mermaid
sequenceDiagram
    participant SCB as SCB Server
    participant API as PayIQ API
    participant Q1 as payiq-callback queue
    participant W1 as Callback Worker
    participant PaySvc as Payment Service
    participant Q2 as payiq-webhook queue
    participant W2 as Webhook Worker
    actor Merchant as Merchant Webhook

    SCB->>API: POST /api/v1/providers/scb/callback
    API->>API: normalizeScbCallback (extract refs, txnId, status)
    API->>DB: INSERT ProviderCallback (status=RECEIVED)
    API->>Q1: Enqueue callback job
    API-->>SCB: 200 OK (async from here)

    Q1->>W1: Process callback job
    W1->>W1: Check duplicate / already processed
    W1->>W1: Verify signature
    W1->>DB: Lookup PaymentIntent by refs
    W1->>PaySvc: Apply state transition (→ SUCCEEDED / FAILED / EXPIRED)
    PaySvc->>DB: UPDATE PaymentIntent + INSERT PaymentEvent
    W1->>DB: Find subscribed WebhookEndpoints
    W1->>DB: INSERT WebhookDelivery records
    W1->>Q2: Enqueue webhook delivery jobs

    Q2->>W2: Deliver webhook job
    W2->>W2: Build HMAC-signed payload<br/>(x-payiq-signature, x-payiq-timestamp)
    W2->>Merchant: POST to registered endpoint
    alt 2xx response
        Merchant-->>W2: 200 OK
        W2->>DB: Mark WebhookDelivery DELIVERED
    else Retryable failure
        Merchant-->>W2: 5xx / timeout
        W2->>Q2: Schedule retry (exponential backoff + jitter)
    else Non-retryable (4xx)
        Merchant-->>W2: 400/404/410
        W2->>DB: Mark WebhookDelivery DEAD
    end
```

---

## Reconciliation Flow

```mermaid
sequenceDiagram
    participant Scheduler as Reconcile Scheduler Worker
    participant Q4 as payiq-reconcile queue
    participant W4 as Reconcile Worker
    participant SCB as SCB Inquiry API
    participant DB as PostgreSQL
    participant Q2 as payiq-webhook queue

    loop Every 60 seconds
        Scheduler->>DB: Scan AWAITING_CUSTOMER payments<br/>(older than 60s, not expired, batch=100)
        DB-->>Scheduler: List of PaymentIntent IDs
        Scheduler->>Q4: Enqueue reconcile jobs (bulk)
    end

    Q4->>W4: reconcilePayment(intentId)
    W4->>DB: Load PaymentIntent + BillerProfile
    W4->>SCB: GET /payment/billpayment/inquiry
    SCB-->>W4: Provider status snapshot

    alt Provider: SUCCEEDED, Internal: AWAITING_CUSTOMER
        W4->>DB: Transition → SUCCEEDED
        W4->>Q2: Enqueue merchant webhook
    else Provider: EXPIRED
        W4->>DB: Transition → EXPIRED (if not already final)
        W4->>Q2: Enqueue merchant webhook
    else Provider: FAILED
        W4->>DB: INSERT ReconciliationRecord (MISMATCH)
        Note over W4: No auto-correction for FAILED
    else States match
        W4->>DB: UPDATE lastReconciledAt
    end

    W4->>DB: INSERT ReconciliationRecord (snapshot)
```

---

## Database Schema Overview

```mermaid
erDiagram
    Tenant ||--o{ MerchantAccount : "has"
    Tenant ||--o{ ApiKey : "owns"
    Tenant ||--o{ BillerProfile : "owns"
    Tenant ||--o{ PaymentRoute : "configures"

    MerchantAccount ||--o{ ApiKey : "scoped to"
    MerchantAccount ||--o{ PaymentIntent : "creates"
    MerchantAccount ||--o{ WebhookEndpoint : "registers"

    BillerProfile ||--o{ PaymentRoute : "used by"
    PaymentRoute ||--o{ PaymentIntent : "routes via"

    PaymentIntent ||--o{ PaymentEvent : "emits"
    PaymentIntent ||--o{ ProviderAttempt : "logs"
    PaymentIntent ||--o{ ProviderCallback : "receives"
    PaymentIntent ||--o{ ReconciliationRecord : "tracked by"
    PaymentIntent ||--o{ WebhookDelivery : "triggers"

    WebhookEndpoint ||--o{ WebhookDelivery : "receives"
    IdempotencyKey }o--|| PaymentIntent : "guards"
```

---

## Overview การทำงาน

### สิ่งที่ PayIQ ทำ
PayIQ เป็น **middleware** ที่ซ่อนความซับซ้อนของ Payment Provider ไว้ภายใน Merchant เรียก API เดียว ได้รับ QR Code กลับมาพร้อมใช้งาน ส่วนทุกอย่างหลังจากนั้น (Callback, State, Webhook, Reconcile) ระบบจัดการเองทั้งหมด

### Components หลัก

| Component | หน้าที่ |
|---|---|
| **HTTP Server** (Nuxt 4 / Nitro) | รับ API requests จาก Merchant ผ่าน REST API |
| **Middleware Pipeline** | ตรวจสอบ Request Context → Auth → Rate Limit ตามลำดับ |
| **Domain Services** | Business logic ทั้งหมด แยกเป็น Services ตาม Domain |
| **Provider Adapters** | ห่อหุ้ม SCB API ไว้ใน interface กลาง (พร้อม Mock mode) |
| **BullMQ Workers** | ประมวลผล async jobs: Callback, Webhook, Reconcile |
| **PostgreSQL** | เก็บข้อมูลทั้งหมดผ่าน Prisma ORM (15 models) |
| **Redis** | Rate limit, Token bucket, OAuth token cache, Queue broker |

### Security ที่ใช้

- **API Key** format: `pk_test_<prefix>.<secret>` — prefix lookup + SHA-256 timing-safe compare
- **Rate Limiting** — Lua script atomic token bucket ต่อ API Key และ IP
- **Payment Spam Detection** — ตรวจ duplicate reference + amount velocity
- **Webhook Signature** — HMAC-SHA256 ทั้ง inbound (จาก SCB) และ outbound (ไป Merchant)
- **IP Allowlist** — กรอง IP สำหรับ inbound webhook endpoint

### Multi-tenant Design

- ทุก resource ผูก `tenantId` ชัดเจน
- `BillerProfile` เก็บ SCB credentials แยกต่อ Tenant (รองรับหลาย Tenant ใช้ SCB credential คนละชุด)
- `ApiKey` scope ได้ถึงระดับ `MerchantAccount`

---

## Quick Start

```bash
# 1. ตั้งค่า environment
cp .env.example .env

# 2. เปิด PostgreSQL + Redis
bun run db:up

# 3. ติดตั้ง dependencies
bun install

# 4. สร้าง Prisma client + migrate DB
bun run prisma:generate
bun run prisma:migrate

# 5. Seed ข้อมูลตั้งต้น
bun run seed

# 6. เปิด HTTP Server
bun run dev
```

เปิดอีก terminal สำหรับ Background Workers:

```bash
bun run workers
```

---

## API Reference

### สร้าง Payment Intent

```bash
curl -X POST http://localhost:3000/api/v1/payment-intents \
  -H "Content-Type: application/json" \
  -H "x-api-key: <your-api-key>" \
  -H "idempotency-key: demo-key-001" \
  -d '{
    "tenantCode": "demo",
    "merchantCode": "default",
    "merchantOrderId": "ORD-1001",
    "merchantReference": "INV-8899",
    "amount": "20.00",
    "currency": "THB",
    "paymentMethodType": "PROMPTPAY_QR",
    "customerName": "John Doe"
  }'
```

### ดู Payment Intent

```bash
curl http://localhost:3000/api/v1/payment-intents/<publicId> \
  -H "x-api-key: <your-api-key>"
```

### จำลอง SCB Callback (dev/test)

```bash
curl -X POST http://localhost:3000/api/v1/providers/scb/callback \
  -H "Content-Type: application/json" \
  -H "x-signature: dummy" \
  -d '{
    "partnerPaymentId": "<publicId>",
    "transactionId": "scb-demo-txn-001",
    "status": "SUCCESS"
  }'
```

---

## Environment Variables หลัก

| Variable | ความหมาย |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `APP_BASE_URL` | Public URL ของ server (ใช้สร้าง callback URL) |
| `SCB_API_KEY` | SCB application key |
| `SCB_API_SECRET` | SCB application secret |
| `SCB_BILLER_ID` | SCB biller ID |
| `SCB_ENV` | `sandbox` หรือ `production` |
| `PAYIQ_PROVIDER_MODE` | `mock` = ไม่เรียก SCB จริง (สำหรับ dev) |
| `WEBHOOK_SECRET` | HMAC secret สำหรับ verify inbound webhook |

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Nuxt 4, Nitro, H3 |
| Runtime | Bun |
| Database | PostgreSQL 16 + Prisma ORM |
| Cache / Queue | Redis 7 + ioredis + BullMQ |
| Validation | Zod |
| Metrics | prom-client (Prometheus) |
| Dev Infra | Docker Compose |
| Testing | Bun test runner |
| Language | TypeScript (strict mode) |
