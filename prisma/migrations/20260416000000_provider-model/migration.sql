-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('BANK_API', 'INTERNAL_QR', 'PAYMENT_GATEWAY', 'SLIP_VERIFY', 'E_WALLET', 'SANDBOX');

-- CreateTable (must exist before FK references)
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "healthMethod" TEXT NOT NULL DEFAULT 'disabled',
    "pingUrl" TEXT,
    "pingTimeoutMs" INTEGER,
    "pingExpectStatus" INTEGER,
    "activitySource" TEXT,
    "activityWarnMinutes" INTEGER,
    "activityStaleMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "providers_code_key" ON "providers"("code");

-- Seed initial providers so FK constraints can be satisfied immediately
INSERT INTO "providers" ("id", "code", "displayName", "type", "isActive", "sortOrder", "healthMethod", "pingUrl", "pingTimeoutMs", "pingExpectStatus", "activitySource", "activityWarnMinutes", "activityStaleMinutes", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'SCB',       'SCB Open API',        'BANK_API',        true, 10,  'ping',     'https://api-sandbox.partners.scb/partners/sandbox/v1/util/echo', 5000, 200, NULL, NULL, NULL, NOW()),
  (gen_random_uuid()::text, 'KBANK',     'KBank Easy API',      'BANK_API',        true, 20,  'activity', NULL, NULL, NULL, 'attempt', 30, 60, NOW()),
  (gen_random_uuid()::text, 'BAY',       'Krungsri (BAY)',       'BANK_API',        true, 30,  'activity', NULL, NULL, NULL, 'attempt', 30, 60, NOW()),
  (gen_random_uuid()::text, 'THAI_QR',   'Thai QR / PromptPay', 'INTERNAL_QR',     true, 40,  'activity', NULL, NULL, NULL, 'callback', 60, 180, NOW()),
  (gen_random_uuid()::text, 'OMISE',     'Omise',               'PAYMENT_GATEWAY', true, 50,  'ping',     'https://api.omise.co/', 5000, 200, NULL, NULL, NULL, NOW()),
  (gen_random_uuid()::text, 'GBPRIME',   'GB PrimePay',         'PAYMENT_GATEWAY', true, 60,  'activity', NULL, NULL, NULL, 'attempt', 30, 60, NOW()),
  (gen_random_uuid()::text, '2C2P',      '2C2P',                'PAYMENT_GATEWAY', true, 70,  'activity', NULL, NULL, NULL, 'attempt', 30, 60, NOW()),
  (gen_random_uuid()::text, 'EASYSLIP',  'EasySlip',            'SLIP_VERIFY',     true, 80,  'ping',     'https://api.easyslip.com/api/v1/health', 5000, 200, NULL, NULL, NULL, NOW()),
  (gen_random_uuid()::text, 'SLIPOK',    'SlipOK',              'SLIP_VERIFY',     true, 90,  'activity', NULL, NULL, NULL, 'attempt', 60, 120, NOW()),
  (gen_random_uuid()::text, 'SLIP2GO',   'Slip2Go',             'SLIP_VERIFY',     true, 95,  'activity', NULL, NULL, NULL, 'attempt', 60, 120, NOW()),
  (gen_random_uuid()::text, 'TRUEMONEY', 'TrueMoney Wallet',    'E_WALLET',        true, 100, 'activity', NULL, NULL, NULL, 'attempt', 60, 120, NOW()),
  (gen_random_uuid()::text, 'RABBIT',    'Rabbit LINE Pay',     'E_WALLET',        true, 110, 'activity', NULL, NULL, NULL, 'attempt', 60, 120, NOW()),
  (gen_random_uuid()::text, 'E_WALLET',  'E-Wallet (generic)',  'E_WALLET',        true, 115, 'disabled', NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
  (gen_random_uuid()::text, 'PROMPTPAY', 'PromptPay (legacy)',  'INTERNAL_QR',     true, 120, 'disabled', NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
  (gen_random_uuid()::text, 'INTERNAL',  'Internal',            'INTERNAL_QR',     true, 130, 'disabled', NULL, NULL, NULL, NULL, NULL, NULL, NOW()),
  (gen_random_uuid()::text, 'SANDBOX',   'Sandbox',             'SANDBOX',         true, 999, 'disabled', NULL, NULL, NULL, NULL, NULL, NULL, NOW())
ON CONFLICT ("code") DO NOTHING;

-- AlterTable: cast enum -> text using USING clause (preserves existing data)
ALTER TABLE "biller_profiles"
  ALTER COLUMN "providerCode" TYPE TEXT USING "providerCode"::text;

ALTER TABLE "payment_routes"
  ALTER COLUMN "providerCode" TYPE TEXT USING "providerCode"::text;

ALTER TABLE "payment_intents"
  ALTER COLUMN "providerCode" TYPE TEXT USING "providerCode"::text;

ALTER TABLE "provider_attempts"
  ALTER COLUMN "providerCode" TYPE TEXT USING "providerCode"::text;

ALTER TABLE "provider_callbacks"
  ALTER COLUMN "providerCode" TYPE TEXT USING "providerCode"::text;

-- DropEnum (safe now that columns are TEXT)
DROP TYPE "ProviderCode";

-- Recreate indexes (drop old ones first if they exist)
DROP INDEX IF EXISTS "biller_profiles_tenantId_providerCode_environment_status_idx";
CREATE INDEX "biller_profiles_tenantId_providerCode_environment_status_idx"
  ON "biller_profiles"("tenantId", "providerCode", "environment", "status");

DROP INDEX IF EXISTS "payment_routes_tenantId_providerCode_environment_status_idx";
CREATE INDEX "payment_routes_tenantId_providerCode_environment_status_idx"
  ON "payment_routes"("tenantId", "providerCode", "environment", "status");

DROP INDEX IF EXISTS "provider_attempts_providerCode_type_status_createdAt_idx";
CREATE INDEX "provider_attempts_providerCode_type_status_createdAt_idx"
  ON "provider_attempts"("providerCode", "type", "status", "createdAt");

DROP INDEX IF EXISTS "provider_callbacks_providerCode_processStatus_receivedAt_idx";
CREATE INDEX "provider_callbacks_providerCode_processStatus_receivedAt_idx"
  ON "provider_callbacks"("providerCode", "processStatus", "receivedAt");

DROP INDEX IF EXISTS "provider_callbacks_providerCode_dedupeKey_key";
CREATE UNIQUE INDEX "provider_callbacks_providerCode_dedupeKey_key"
  ON "provider_callbacks"("providerCode", "dedupeKey");

-- AddForeignKey
ALTER TABLE "biller_profiles" ADD CONSTRAINT "biller_profiles_providerCode_fkey"
  FOREIGN KEY ("providerCode") REFERENCES "providers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_attempts" ADD CONSTRAINT "provider_attempts_providerCode_fkey"
  FOREIGN KEY ("providerCode") REFERENCES "providers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "provider_callbacks" ADD CONSTRAINT "provider_callbacks_providerCode_fkey"
  FOREIGN KEY ("providerCode") REFERENCES "providers"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
