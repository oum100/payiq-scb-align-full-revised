-- schema hardening + provider-callback unification
DO $$ BEGIN
  CREATE TYPE "ApiKeyStatus" AS ENUM ('ACTIVE','SUSPENDED','REVOKED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "EnvironmentMode" AS ENUM ('TEST','LIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "IdempotencyStatus" AS ENUM ('RESERVED','COMPLETED','RELEASED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "merchant_accounts" ADD COLUMN IF NOT EXISTS "environment" "EnvironmentMode" NOT NULL DEFAULT 'TEST';
ALTER TABLE "payment_routes" ADD COLUMN IF NOT EXISTS "environment" "EnvironmentMode" NOT NULL DEFAULT 'TEST';
ALTER TABLE "biller_profiles" ADD COLUMN IF NOT EXISTS "environment" "EnvironmentMode" NOT NULL DEFAULT 'TEST';
ALTER TABLE "biller_profiles" ADD COLUMN IF NOT EXISTS "credentialsRef" TEXT;
ALTER TABLE "biller_profiles" ALTER COLUMN "credentialsEncrypted" DROP NOT NULL;
ALTER TABLE "biller_profiles" ADD COLUMN IF NOT EXISTS "credentialsVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "biller_profiles" ADD COLUMN IF NOT EXISTS "credentialsRotatedAt" TIMESTAMP(3);
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "environment" "EnvironmentMode" NOT NULL DEFAULT 'TEST';
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "expiredAt" TIMESTAMP(3);
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "failureReason" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT;
ALTER TABLE "payment_intents" ADD COLUMN IF NOT EXISTS "lastErrorMessage" TEXT;
ALTER TABLE "provider_attempts" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER;
ALTER TABLE "provider_callbacks" ADD COLUMN IF NOT EXISTS "processedBy" TEXT;
ALTER TABLE "provider_callbacks" ADD COLUMN IF NOT EXISTS "workerName" TEXT;
ALTER TABLE "webhook_endpoints" ALTER COLUMN "secretHash" DROP NOT NULL;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "secretRef" TEXT;
ALTER TABLE "webhook_endpoints" ADD COLUMN IF NOT EXISTS "secretEncrypted" TEXT;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "targetUrlSnapshot" TEXT;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "timeoutMsSnapshot" INTEGER;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "signatureVersion" TEXT;
ALTER TABLE "reconciliation_records" ADD COLUMN IF NOT EXISTS "processedBy" TEXT;
ALTER TABLE "reconciliation_records" ADD COLUMN IF NOT EXISTS "workerName" TEXT;
ALTER TABLE "idempotency_keys" ADD COLUMN IF NOT EXISTS "status" "IdempotencyStatus" NOT NULL DEFAULT 'RESERVED';

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "status_v2" "ApiKeyStatus";
UPDATE "api_keys" SET "status_v2" = CASE
  WHEN "revokedAt" IS NOT NULL THEN 'REVOKED'::"ApiKeyStatus"
  WHEN upper(coalesce("status"::text,'ACTIVE')) = 'SUSPENDED' THEN 'SUSPENDED'::"ApiKeyStatus"
  ELSE 'ACTIVE'::"ApiKeyStatus"
END
WHERE "status_v2" IS NULL;
ALTER TABLE "api_keys" ALTER COLUMN "status_v2" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "status_v2" SET DEFAULT 'ACTIVE';
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "status";
ALTER TABLE "api_keys" RENAME COLUMN "status_v2" TO "status";

ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "environment_v2" "EnvironmentMode";
UPDATE "api_keys" SET "environment_v2" = CASE WHEN lower(coalesce("environment"::text,'test')) = 'live' THEN 'LIVE'::"EnvironmentMode" ELSE 'TEST'::"EnvironmentMode" END WHERE "environment_v2" IS NULL;
ALTER TABLE "api_keys" ALTER COLUMN "environment_v2" SET NOT NULL;
ALTER TABLE "api_keys" ALTER COLUMN "environment_v2" SET DEFAULT 'TEST';
ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "environment";
ALTER TABLE "api_keys" RENAME COLUMN "environment_v2" TO "environment";

DROP TABLE IF EXISTS "WebhookEvent";
DROP TYPE IF EXISTS "WebhookStatus";

CREATE INDEX IF NOT EXISTS "merchant_accounts_tenantId_environment_status_idx" ON "merchant_accounts"("tenantId","environment","status");
CREATE INDEX IF NOT EXISTS "api_keys_tenantId_environment_status_idx" ON "api_keys"("tenantId","environment","status");
CREATE INDEX IF NOT EXISTS "api_keys_expiresAt_idx" ON "api_keys"("expiresAt");
CREATE INDEX IF NOT EXISTS "biller_profiles_tenantId_providerCode_environment_status_idx" ON "biller_profiles"("tenantId","providerCode","environment","status");
CREATE INDEX IF NOT EXISTS "payment_routes_tenantId_paymentMethodType_currency_environment_status_priority_idx" ON "payment_routes"("tenantId","paymentMethodType","currency","environment","status","priority");
CREATE INDEX IF NOT EXISTS "payment_routes_tenantId_providerCode_environment_status_idx" ON "payment_routes"("tenantId","providerCode","environment","status");
CREATE INDEX IF NOT EXISTS "payment_intents_tenantId_idempotencyKeyValue_idx" ON "payment_intents"("tenantId","idempotencyKeyValue");
CREATE INDEX IF NOT EXISTS "idempotency_keys_tenantId_status_createdAt_idx" ON "idempotency_keys"("tenantId","status","createdAt");
