-- Admin authentication tables for PayIQ Dashboard

CREATE TABLE "admin_users" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "email"       TEXT NOT NULL,
  "name"        TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

CREATE TABLE "admin_magic_links" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "adminId"   TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_magic_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_magic_links_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "admin_magic_links_tokenHash_key" ON "admin_magic_links"("tokenHash");
CREATE INDEX "admin_magic_links_adminId_idx" ON "admin_magic_links"("adminId");
CREATE INDEX "admin_magic_links_expiresAt_idx" ON "admin_magic_links"("expiresAt");

CREATE TABLE "admin_sessions" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
  "adminId"     TEXT NOT NULL,
  "sessionHash" TEXT NOT NULL,
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "admin_sessions_adminId_fkey"
    FOREIGN KEY ("adminId") REFERENCES "admin_users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "admin_sessions_sessionHash_key" ON "admin_sessions"("sessionHash");
CREATE INDEX "admin_sessions_adminId_idx" ON "admin_sessions"("adminId");
CREATE INDEX "admin_sessions_expiresAt_idx" ON "admin_sessions"("expiresAt");
