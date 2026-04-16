-- Remove INTERNAL_QR from ProviderType enum
-- First remap any INTERNAL_QR rows to SANDBOX so the cast won't fail
UPDATE "providers" SET "type" = 'SANDBOX'::"ProviderType" WHERE "type" = 'INTERNAL_QR'::"ProviderType";
-- Create new enum without INTERNAL_QR
CREATE TYPE "ProviderType_new" AS ENUM ('BANK_API', 'PAYMENT_GATEWAY', 'SLIP_VERIFY', 'E_WALLET', 'SANDBOX');
ALTER TABLE "providers" ALTER COLUMN "type" TYPE "ProviderType_new" USING ("type"::text::"ProviderType_new");
DROP TYPE "ProviderType";
ALTER TYPE "ProviderType_new" RENAME TO "ProviderType";

-- Add providerId to payment_routes (nullable first for data migration)
ALTER TABLE "payment_routes" ADD COLUMN "provider_id" TEXT;

-- Migrate existing providerCode → providerId via lookup
UPDATE "payment_routes" pr
SET "provider_id" = (SELECT id FROM "providers" p WHERE p.code = pr."providerCode")
WHERE pr."providerCode" IS NOT NULL;

-- For any routes where provider not found (e.g. THAI_QR), set to SANDBOX
UPDATE "payment_routes"
SET "provider_id" = (SELECT id FROM "providers" WHERE code = 'SANDBOX')
WHERE "provider_id" IS NULL;

-- Make providerId NOT NULL
ALTER TABLE "payment_routes" ALTER COLUMN "provider_id" SET NOT NULL;

-- Add FK constraint
ALTER TABLE "payment_routes" ADD CONSTRAINT "payment_routes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop old providerCode from payment_routes
ALTER TABLE "payment_routes" DROP COLUMN "providerCode";

-- Drop old providerCode FK and column from biller_profiles
ALTER TABLE "biller_profiles" DROP CONSTRAINT IF EXISTS "biller_profiles_providerCode_fkey";
ALTER TABLE "biller_profiles" DROP COLUMN "providerCode";

-- Deactivate THAI_QR provider (no longer an INTERNAL_QR type; mark inactive)
UPDATE "providers" SET "isActive" = false WHERE code = 'THAI_QR';

-- Also deactivate other INTERNAL_QR providers that were seeded
UPDATE "providers" SET "isActive" = false WHERE code IN ('PROMPTPAY', 'INTERNAL');

-- Update indexes
DROP INDEX IF EXISTS "payment_routes_tenantId_providerCode_environment_status_idx";
CREATE INDEX "payment_routes_tenantId_providerId_environment_status_idx" ON "payment_routes"("tenantId", "provider_id", "environment", "status");
DROP INDEX IF EXISTS "biller_profiles_tenantId_providerCode_environment_status_idx";
CREATE INDEX "biller_profiles_tenantId_environment_status_idx" ON "biller_profiles"("tenantId", "environment", "status");
