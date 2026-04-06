// server/services/admin/sendMagicLinkEmail.ts
// ส่ง magic link ผ่าน Resend API
// ติดตั้ง: bun add resend

type SendResult = { ok: true } | { ok: false; error: string }

export async function sendMagicLinkEmail(
  to: string,
  magicUrl: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY

  // Dev mode: แค่ log URL ถ้าไม่มี API key
  if (!apiKey || apiKey === "re_dev_mock") {
    console.log(`\n🔗 [Magic Link] ${to}\n   ${magicUrl}\n`)
    return { ok: true }
  }

  const expiryMin = 15

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #0f0f0f; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .wrapper { max-width: 480px; margin: 40px auto; padding: 0 20px; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 12px; overflow: hidden; }
    .header { background: #111; padding: 32px; border-bottom: 1px solid #2a2a2a; text-align: center; }
    .logo { font-size: 22px; font-weight: 700; color: #fff; letter-spacing: -0.5px; }
    .logo span { color: #f59e0b; }
    .body { padding: 32px; }
    .title { font-size: 18px; font-weight: 600; color: #f0f0f0; margin: 0 0 12px; }
    .subtitle { font-size: 14px; color: #888; margin: 0 0 28px; line-height: 1.6; }
    .btn { display: block; background: #f59e0b; color: #0f0f0f !important; text-decoration: none;
           font-size: 15px; font-weight: 700; padding: 14px 24px; border-radius: 8px;
           text-align: center; letter-spacing: 0.2px; }
    .url { margin-top: 24px; padding: 16px; background: #111; border-radius: 8px; word-break: break-all;
           font-size: 12px; color: #666; border: 1px solid #222; font-family: monospace; }
    .footer { padding: 20px 32px; border-top: 1px solid #2a2a2a; font-size: 12px; color: #555; text-align: center; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <div class="logo">pay<span>IQ</span></div>
      </div>
      <div class="body">
        <p class="title">Sign in to Dashboard</p>
        <p class="subtitle">
          Click the button below to sign in. This link expires in ${expiryMin} minutes
          and can only be used once.
        </p>
        <a href="${magicUrl}" class="btn">Sign in to PayIQ →</a>
        <div class="url">
          <div style="margin-bottom:6px;color:#444;">Or copy this link:</div>
          ${magicUrl}
        </div>
      </div>
      <div class="footer">
        If you didn't request this, you can safely ignore this email.<br>
        PayIQ Internal Dashboard — do not share this link.
      </div>
    </div>
  </div>
</body>
</html>`

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "PayIQ <noreply@payiq.app>",
        to: [to],
        subject: "Your PayIQ sign-in link",
        html,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("[Resend] Failed:", res.status, body)
      return { ok: false, error: `Resend error: ${res.status}` }
    }

    return { ok: true }
  } catch (err) {
    console.error("[Resend] Exception:", err)
    return { ok: false, error: "Email delivery failed" }
  }
}
