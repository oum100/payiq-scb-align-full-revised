import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const providers = [
    // BANK_API
    { code: 'SCB',      displayName: 'SCB Open API',        type: 'BANK_API',        sortOrder: 10,  healthMethod: 'ping',     pingUrl: 'https://api-sandbox.partners.scb/partners/sandbox/v1/util/echo', pingTimeoutMs: 5000, pingExpectStatus: 200 },
    { code: 'KBANK',    displayName: 'KBank Easy API',       type: 'BANK_API',        sortOrder: 20,  healthMethod: 'activity', activitySource: 'attempt',  activityWarnMinutes: 30, activityStaleMinutes: 60 },
    { code: 'BAY',      displayName: 'Krungsri (BAY)',       type: 'BANK_API',        sortOrder: 30,  healthMethod: 'activity', activitySource: 'attempt',  activityWarnMinutes: 30, activityStaleMinutes: 60 },
    // INTERNAL_QR
    { code: 'THAI_QR',  displayName: 'Thai QR / PromptPay', type: 'INTERNAL_QR',     sortOrder: 40,  healthMethod: 'activity', activitySource: 'callback', activityWarnMinutes: 60, activityStaleMinutes: 180 },
    // PAYMENT_GATEWAY
    { code: 'OMISE',    displayName: 'Omise',                type: 'PAYMENT_GATEWAY', sortOrder: 50,  healthMethod: 'ping',     pingUrl: 'https://api.omise.co/', pingTimeoutMs: 5000, pingExpectStatus: 200 },
    { code: 'GBPRIME',  displayName: 'GB PrimePay',          type: 'PAYMENT_GATEWAY', sortOrder: 60,  healthMethod: 'activity', activitySource: 'attempt',  activityWarnMinutes: 30, activityStaleMinutes: 60 },
    { code: '2C2P',     displayName: '2C2P',                 type: 'PAYMENT_GATEWAY', sortOrder: 70,  healthMethod: 'activity', activitySource: 'attempt',  activityWarnMinutes: 30, activityStaleMinutes: 60 },
    // SLIP_VERIFY
    { code: 'SLIP2GO',  displayName: 'Slip2GO',              type: 'SLIP_VERIFY',     sortOrder: 80,  healthMethod: 'ping',     pingUrl: 'https://api.slip2go.com/health', pingTimeoutMs: 5000, pingExpectStatus: 200 },
    { code: 'SLIPOK',   displayName: 'SlipOK',               type: 'SLIP_VERIFY',     sortOrder: 90,  healthMethod: 'activity', activitySource: 'attempt',  activityWarnMinutes: 60, activityStaleMinutes: 120 },
    // E_WALLET
    { code: 'TRUEMONEY', displayName: 'TrueMoney Wallet',   type: 'E_WALLET',        sortOrder: 100, healthMethod: 'activity', activitySource: 'attempt', activityWarnMinutes: 60, activityStaleMinutes: 120 },
    { code: 'RABBIT',   displayName: 'Rabbit LINE Pay',      type: 'E_WALLET',        sortOrder: 110, healthMethod: 'activity', activitySource: 'attempt', activityWarnMinutes: 60, activityStaleMinutes: 120 },
    // SANDBOX
    { code: 'SANDBOX',  displayName: 'Sandbox',              type: 'SANDBOX',         sortOrder: 999, healthMethod: 'disabled' },
  ]

  for (const p of providers) {
    await prisma.provider.upsert({
      where: { code: p.code },
      update: p,
      create: p as any,
    })
  }
  console.log(`Seeded ${providers.length} providers`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
