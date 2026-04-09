import { defineNuxtConfig } from "nuxt/config";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  // future: { compatibilityVersion: 4 },
  alias: {
    "#server": fileURLToPath(new URL("./server", import.meta.url)),
  },
  typescript: {
    tsConfig: {
      compilerOptions: {
        paths: { "~~/*": ["./*"], "@@/*": ["./*"] },
      },
    },
  },
  compatibilityDate: "2026-03-18",
  devtools: { enabled: true },
  css: ["./app/assets/css/main.css"],

  modules: [
    "@nuxt/ui",
    [
      "nuxt-i18n-micro",
      {
        locales: [
          { code: "en", iso: "en-US", name: "English", dir: "ltr" },
          { code: "th", iso: "th-TH", name: "ไทย", dir: "ltr" },
        ],
        defaultLocale: "th",
        translationDir: "app/locales",
        meta: false,
        autoDetectLanguage: false,
        includeDefaultLocaleRoute: false,
        disablePageLocales: true,
      },
    ],
    [
      "@nuxtjs/google-fonts",
      {
        families: {
          Inter: "200..700",
          Anuphan: ["400", "500"],
        },
        display: "swap", // ใช้ค่า display เป็น swap สำหรับประสิทธิภาพที่ดีขึ้น
        preload: true, // เปิดใช้งาน preload เพือประสิทธิภาพที่ดีขึ้น
        prefetch: true, // เปิดใช้งาน prefetch เพื่อประสิทธิภาพที่ดีขึ้น
        preconnect: true, // เปิดใช้งาน preconnect เพื่อประสิทธิภาพที่ดีขึ้น
        download: true, // ดาวน์โหลดฟอนต์ไปยังโครงการของคุณ
        inject: true, // ฝังฟอนต์ใน CSS ของคุณ
      },
    ],
  ],

  ui: {
    colorMode: true,
  },

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
    externals: { inline: ["prom-client"] },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
