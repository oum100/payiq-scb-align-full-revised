import { prisma } from "~~/server/lib/prisma";
import { reconcileQueue } from "~~/server/lib/bullmq";

const FIRST_RECONCILE_DELAY_MS = 60 * 1000;
const RECONCILE_INTERVAL_MS = 60 * 1000;
const MAX_BATCH_SIZE = 100;

export async function enqueueReconcileCandidates() {
  const now = new Date();
  const requestedBefore = new Date(now.getTime() - FIRST_RECONCILE_DELAY_MS);
  const reconciledBefore = new Date(now.getTime() - RECONCILE_INTERVAL_MS);

  const candidates = await prisma.paymentIntent.findMany({
    where: {
      status: "AWAITING_CUSTOMER",
      requestedAt: {
        lte: requestedBefore,
      },
      expiresAt: {
        gt: now,
      },
      OR: [
        { lastReconciledAt: null },
        { lastReconciledAt: { lte: reconciledBefore } },
      ],
    },
    orderBy: {
      requestedAt: "asc",
    },
    take: MAX_BATCH_SIZE,
    select: {
      id: true,
      publicId: true,
      merchantReference: true,
      requestedAt: true,
      lastReconciledAt: true,
      expiresAt: true,
    },
  });

  let enqueued = 0;

  for (const row of candidates) {
    await reconcileQueue.add(
      "payment.reconcile.single",
      { paymentIntentId: row.id },
      {
        jobId: `reconcile__${row.id}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    enqueued += 1;
  }

  return {
    candidates: candidates.length,
    enqueued,
    items: candidates,
  };
}