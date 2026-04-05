import { defineNuxtConfig } from "nuxt/config";

export default defineNuxtConfig({
  future: {
    compatibilityVersion: 4,
  },
  alias: {
    // สร้าง alias ใหม่ชี้ไปที่ server folder ที่ root โดยตรง
    "#server": "./server",
  },
  // บังคับให้ TS รู้จัก alias นี้ทั้งโปรเจกต์
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: {
          "~~/*": ["./*"],
          "@@/*": ["./*"],
        },
      },
    },
  },
  compatibilityDate: "2026-03-18",
  devtools: { enabled: true },

  modules: [],
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || "",
    redisUrl: process.env.REDIS_URL || "",
    appBaseUrl: process.env.APP_BASE_URL || "",

    scbApiBaseUrl: process.env.SCB_API_BASE_URL || "",
    scbClientId: process.env.SCB_CLIENT_ID || "",
    scbClientSecret: process.env.SCB_CLIENT_SECRET || "",
    scbCallbackSecret: process.env.SCB_CALLBACK_SECRET || "",

    webhookSecret: process.env.WEBHOOK_SECRET || "",
    webhookIpAllowlist: process.env.WEBHOOK_IP_ALLOWLIST || "",
    webhookRateLimit: Number(process.env.WEBHOOK_RATE_LIMIT || 100),
  },
  nitro: {
    externals: {
      inline: ["prom-client"],
    },
  },
});
