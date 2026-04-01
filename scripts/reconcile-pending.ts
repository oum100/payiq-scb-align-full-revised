import { prisma } from "../server/lib/prisma";
import { reconcileQueue } from "../server/lib/bullmq";

async function main() {
  const now = new Date();
  const requestedBefore = new Date(now.getTime() - 60 * 1000);
  const reconciledBefore = new Date(now.getTime() - 60 * 1000);

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
    take: 100,
    select: {
      id: true,
      publicId: true,
      merchantReference: true,
      requestedAt: true,
      lastReconciledAt: true,
      expiresAt: true,
    },
  });

  console.log("[reconcile-pending] candidates:", candidates.length);

  for (const row of candidates) {
    await reconcileQueue.add(
      "payment.reconcile.single",
      { paymentIntentId: row.id },
      {
        jobId: `reconcile-${row.id}`,
        removeOnComplete: 1000,
        removeOnFail: 1000,
      },
    );

    console.log("[reconcile-pending] enqueued", {
      paymentIntentId: row.id,
      publicId: row.publicId,
      merchantReference: row.merchantReference,
      requestedAt: row.requestedAt,
      lastReconciledAt: row.lastReconciledAt,
      expiresAt: row.expiresAt,
    });
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
