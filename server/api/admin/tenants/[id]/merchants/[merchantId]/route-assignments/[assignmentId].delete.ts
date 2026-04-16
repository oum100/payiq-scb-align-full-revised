import { prisma } from '~~/server/lib/prisma'

export default defineEventHandler(async (event) => {
  const merchantAccountId = getRouterParam(event, 'merchantId')!
  const assignmentId = getRouterParam(event, 'assignmentId')!

  const assignment = await prisma.merchantRouteAssignment.findFirst({
    where: { id: assignmentId, merchantAccountId },
  })
  if (!assignment) {
    throw createError({ statusCode: 404, message: 'Assignment not found' })
  }

  await prisma.merchantRouteAssignment.delete({ where: { id: assignmentId } })
  return { success: true }
})
