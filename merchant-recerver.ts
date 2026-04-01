import crypto from "node:crypto";

const WEBHOOK_SECRET = process.env.PAYIQ_WEBHOOK_SECRET ?? "merchant-webhook-secret";

function sign(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

function secureEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

Bun.serve({
  port: 3001,
  async fetch(req) {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method not allowed" }), {
        status: 405,
        headers: { "content-type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-payiq-signature") ?? "";

    if (!signature) {
      return new Response(JSON.stringify({ error: "missing signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const expected = sign(rawBody, WEBHOOK_SECRET);

    if (!secureEqual(signature, expected)) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const payload = JSON.parse(rawBody);

    console.log("\n=== VERIFIED MERCHANT WEBHOOK ===");
    console.log(payload);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  },
});

console.log("Verified merchant receiver listening on http://127.0.0.1:3001");