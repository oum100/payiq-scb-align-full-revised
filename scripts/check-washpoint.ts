import { prisma } from '../server/lib/prisma'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { code: 'washpoint' } })
  console.log('tenant:', tenant?.id, tenant?.code)
  if (tenant) {
    const routes = await prisma.paymentRoute.findMany({ where: { tenantId: tenant.id } })
    console.log('routes:', JSON.stringify(routes, null, 2))
    const merchants = await prisma.merchantAccount.findMany({ where: { tenantId: tenant.id } })
    console.log('merchants:', JSON.stringify(merchants.map((m: any) => ({ id: m.id, code: m.code, env: m.environment })), null, 2))
    const keys = await prisma.apiKey.findMany({ where: { tenantId: tenant.id }, select: { keyPrefix: true, status: true, merchantAccountId: true } })
    console.log('api keys:', JSON.stringify(keys, null, 2))
  }
}

main().catch(console.error).finally(() => (prisma as any).$disconnect())
