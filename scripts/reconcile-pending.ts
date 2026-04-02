import { prisma } from "../server/lib/prisma";
import { enqueueReconcileCandidates } from "../server/services/reconcile/enqueueReconcileCandidates";

async function main() {
  const result = await enqueueReconcileCandidates();

  console.log("[reconcile-pending] candidates:", result.candidates);

  for (const row of result.items) {
    console.log("[reconcile-pending] enqueued", {
      paymentIntentId: row.id,
      publicId: row.publicId,
      merchantReference: row.merchantReference,
      requestedAt: row.requestedAt,
      lastReconciledAt: row.lastReconciledAt,
      expiresAt: row.expiresAt,
    });
  }

  console.log("[reconcile-pending] done", {
    candidates: result.candidates,
    enqueued: result.enqueued,
  });

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("[reconcile-pending] failed", error);
  await prisma.$disconnect();
  process.exit(1);
});