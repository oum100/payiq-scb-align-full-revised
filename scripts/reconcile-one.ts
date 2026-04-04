import { prisma } from "../server/lib/prisma";
import { scbProvider } from "../server/services/providers/scb/scb.adapter";

async function main() {
  const payment = await prisma.paymentIntent.findFirst({
    where: { merchantReference: "order-009" },
    include: { billerProfile: true },
  });

  if (!payment || !payment.billerProfile) {
    throw new Error("payment or billerProfile not found");
  }

  const inquiry = await scbProvider.inquirePayment({
    providerReference: payment.providerReference ?? payment.merchantReference,
    providerTransactionId: payment.providerTransactionId,
    billerProfile: payment.billerProfile,
  });

  console.log("INQUIRY RESULT");
  console.dir(inquiry, { depth: null });

  if (inquiry.status === "SUCCEEDED") {
    const updated = await prisma.paymentIntent.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        providerReference: inquiry.providerReference ?? payment.providerReference,
        providerTransactionId: inquiry.providerTransactionId ?? payment.providerTransactionId,
        providerQrRef: inquiry.providerQrRef ?? payment.providerQrRef,
        succeededAt: new Date(),
      },
    });

    await prisma.paymentEvent.create({
      data: {
        paymentIntentId: payment.id,
        type: "PAYMENT_SUCCEEDED",
        fromStatus: payment.status,
        toStatus: "SUCCEEDED",
        summary: "Payment marked successful from reconciliation inquiry",
        payload: inquiry as any,
      },
    });

    console.log("UPDATED PAYMENT");
    console.dir(updated, { depth: null });
  } else {
    console.log("NO STATE CHANGE");
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});