import { defineEventHandler } from "h3";
import { prisma } from "~~/server/lib/prisma";

export default defineEventHandler(async () => {
  const rows = await prisma.webhookDelivery.findMany({
    select: {
      status: true,
      createdAt: true,
    },
  });

  const since24h = Date.now() - 24 * 60 * 60 * 1000;

  const summary = {
    total: rows.length,
    delivered: 0,
    retrying: 0,
    dead: 0,
    processing: 0,
    pending: 0,
    last24h: 0,
    last24hDelivered: 0,
    last24hDead: 0,
  };

  for (const row of rows) {
    if (row.status === "DELIVERED") summary.delivered += 1;
    else if (row.status === "RETRYING") summary.retrying += 1;
    else if (row.status === "DEAD") summary.dead += 1;
    else if (row.status === "PROCESSING") summary.processing += 1;
    else if (row.status === "PENDING") summary.pending += 1;

    const isLast24h = new Date(row.createdAt).getTime() >= since24h;

    if (isLast24h) {
      summary.last24h += 1;
      if (row.status === "DELIVERED") summary.last24hDelivered += 1;
      if (row.status === "DEAD") summary.last24hDead += 1;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary,
  };
});
