PAYIQ_WEBHOOK_SECRET=merchant-webhook-secret bun -e '
import crypto from "node:crypto";

const secret = process.env.PAYIQ_WEBHOOK_SECRET ?? "merchant-webhook-secret";

function sign(timestamp, rawBody) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
}

function safeEqual(a, b) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

Bun.serve({
  port: 3001,
  async fetch(req) {
    const rawBody = await req.text();
    const signature = req.headers.get("x-payiq-signature") ?? "";
    const timestamp = req.headers.get("x-payiq-timestamp") ?? "";
    const eventId = req.headers.get("x-payiq-event-id") ?? "";
    const version = req.headers.get("x-payiq-signature-version") ?? "";

    if (!signature) {
      return new Response(JSON.stringify({ error: "missing signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (!timestamp) {
      return new Response(JSON.stringify({ error: "missing timestamp" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (!eventId) {
      return new Response(JSON.stringify({ error: "missing event id" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (version !== "v1") {
      return new Response(JSON.stringify({ error: "unsupported signature version" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const expected = sign(timestamp, rawBody);

    if (!safeEqual(signature, expected)) {
      console.log("❌ invalid signature");
      console.log({ signature, expected, timestamp, eventId, rawBody });
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) {
      return new Response(JSON.stringify({ error: "timestamp outside tolerance" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    console.log("\n✅ VERIFIED WEBHOOK v1");
    console.log({ eventId, timestamp, rawBody });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log("🚀 Merchant receiver running at http://127.0.0.1:3001");
await new Promise(() => {});
'