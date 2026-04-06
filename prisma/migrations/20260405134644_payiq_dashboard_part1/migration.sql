-- DropIndex
DROP INDEX "biller_profiles_tenantId_providerCode_status_idx";

-- DropIndex
DROP INDEX "payment_routes_tenantId_paymentMethodType_currency_status_p_idx";

-- DropIndex
DROP INDEX "payment_routes_tenantId_providerCode_status_idx";

-- CreateIndex
CREATE INDEX "api_keys_tenantId_merchantAccountId_status_idx" ON "api_keys"("tenantId", "merchantAccountId", "status");

-- RenameIndex
ALTER INDEX "payment_routes_tenantId_paymentMethodType_currency_environment_" RENAME TO "payment_routes_tenantId_paymentMethodType_currency_environm_idx";
