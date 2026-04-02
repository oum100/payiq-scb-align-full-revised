import { Queue } from "bullmq";
import { redis } from "~/server/lib/redis";

export const queueNames = {
  callback: "payiq-callback",
  webhook: "payiq-webhook",
  webhookInbound: "payiq-webhook-inbound",
  reconcile: "payiq-reconcile",
  reconcileScheduler: "payiq-reconcile-scheduler",
} as const;

export const callbackQueue = new Queue(queueNames.callback, {
  connection: redis,
});

export const webhookQueue = new Queue(queueNames.webhook, {
  connection: redis,
});

export const webhookInboundQueue = new Queue(queueNames.webhookInbound, {
  connection: redis,
});

export const reconcileQueue = new Queue(queueNames.reconcile, {
  connection: redis,
});

export const reconcileSchedulerQueue = new Queue(queueNames.reconcileScheduler, {
  connection: redis,
});