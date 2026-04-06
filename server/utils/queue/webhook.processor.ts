import { processProviderCallback } from "../../services/callbacks/processProviderCallback";

type ProcessWebhookInput = {
  provider: string;
  rawBody: string;
  eventId?: string;
  providerCallbackId?: string;
};

export async function processWebhook(data: ProcessWebhookInput) {
  if (!data.providerCallbackId) {
    throw new Error("missing providerCallbackId");
  }
  const result = await processProviderCallback(data.providerCallbackId);
  return {
    provider: data.provider,
    ...(typeof result === "object" && result ? result : {}),
    ok: true,
  };
}
