<template>
  <div>
    <div class="page-header">
      <button class="back-btn" @click="$router.back()">← Back</button>
      <div class="header-main">
        <h1 class="page-title">{{ payment?.publicId }}</h1>
        <span v-if="payment" class="status-badge" :class="statusClass(payment.status)">{{ payment.status }}</span>
      </div>
    </div>

    <div v-if="pending" class="loading">Loading…</div>
    <div v-else-if="!payment" class="empty">Payment not found</div>
    <template v-else>
      <!-- Details grid -->
      <div class="detail-grid">
        <div class="detail-card">
          <div class="card-title">Payment Info</div>
          <div class="kv-list">
            <div class="kv"><span class="k">Amount</span><span class="v v-amount">฿{{ fmtAmount(payment.amount) }}</span></div>
            <div class="kv"><span class="k">Currency</span><span class="v">{{ payment.currency }}</span></div>
            <div class="kv"><span class="k">Method</span><span class="v">{{ payment.paymentMethodType }}</span></div>
            <div class="kv"><span class="k">Provider</span><span class="v">{{ payment.providerCode ?? "—" }}</span></div>
            <div class="kv"><span class="k">Environment</span><span class="v">
              <span class="env-badge" :class="payment.environment === 'LIVE' ? 'env-live' : 'env-test'">{{ payment.environment }}</span>
            </span></div>
          </div>
        </div>

        <div class="detail-card">
          <div class="card-title">References</div>
          <div class="kv-list">
            <div class="kv"><span class="k">Public ID</span><span class="v v-mono">{{ payment.publicId }}</span></div>
            <div class="kv"><span class="k">Order ID</span><span class="v v-mono">{{ payment.merchantOrderId ?? "—" }}</span></div>
            <div class="kv"><span class="k">Merchant Ref</span><span class="v v-mono">{{ payment.merchantReference ?? "—" }}</span></div>
            <div class="kv"><span class="k">Provider Txn</span><span class="v v-mono">{{ payment.providerTransactionId ?? "—" }}</span></div>
            <div class="kv"><span class="k">Provider Ref</span><span class="v v-mono">{{ payment.providerReference ?? "—" }}</span></div>
          </div>
        </div>

        <div class="detail-card">
          <div class="card-title">Timestamps</div>
          <div class="kv-list">
            <div class="kv"><span class="k">Created</span><span class="v">{{ fmtDate(payment.createdAt) }}</span></div>
            <div class="kv"><span class="k">Expires</span><span class="v">{{ payment.expiresAt ? fmtDate(payment.expiresAt) : "—" }}</span></div>
            <div class="kv"><span class="k">Succeeded</span><span class="v v-green">{{ payment.succeededAt ? fmtDate(payment.succeededAt) : "—" }}</span></div>
            <div class="kv"><span class="k">Failed</span><span class="v v-red">{{ payment.failedAt ? fmtDate(payment.failedAt) : "—" }}</span></div>
          </div>
        </div>

        <div class="detail-card">
          <div class="card-title">Customer</div>
          <div class="kv-list">
            <div class="kv"><span class="k">Name</span><span class="v">{{ payment.customerName ?? "—" }}</span></div>
            <div class="kv"><span class="k">Email</span><span class="v">{{ payment.customerEmail ?? "—" }}</span></div>
            <div class="kv"><span class="k">Phone</span><span class="v">{{ payment.customerPhone ?? "—" }}</span></div>
            <div class="kv"><span class="k">Merchant</span><span class="v">{{ payment.merchantAccount?.name ?? "—" }}</span></div>
          </div>
        </div>
      </div>

      <!-- Event timeline -->
      <div class="section-card">
        <div class="section-title">Event timeline</div>
        <div class="timeline">
          <div v-for="ev in payment.events" :key="ev.id" class="timeline-item">
            <div class="tl-dot" />
            <div class="tl-body">
              <div class="tl-header">
                <span class="tl-type">{{ ev.type }}</span>
                <span class="tl-time">{{ fmtDate(ev.createdAt) }}</span>
              </div>
              <div v-if="ev.fromStatus || ev.toStatus" class="tl-transition">
                <span v-if="ev.fromStatus" class="tl-from">{{ ev.fromStatus }}</span>
                <span v-if="ev.fromStatus && ev.toStatus" class="tl-arrow">→</span>
                <span v-if="ev.toStatus" class="status-badge sm" :class="statusClass(ev.toStatus)">{{ ev.toStatus }}</span>
              </div>
              <div v-if="ev.summary" class="tl-summary">{{ ev.summary }}</div>
            </div>
          </div>
          <div v-if="!payment.events?.length" class="tl-empty">No events</div>
        </div>
      </div>

      <!-- Provider attempts -->
      <div v-if="payment.providerAttempts?.length" class="section-card">
        <div class="section-title">Provider attempts</div>
        <table class="table">
          <thead><tr><th>Type</th><th>Status</th><th>HTTP</th><th>Provider Txn</th><th>Sent at</th></tr></thead>
          <tbody>
            <tr v-for="a in payment.providerAttempts" :key="a.id">
              <td class="td-mono">{{ a.type }}</td>
              <td><span class="status-badge sm" :class="a.status === 'SUCCEEDED' ? 's-green' : 's-red'">{{ a.status }}</span></td>
              <td class="td-muted">{{ a.httpStatusCode ?? "—" }}</td>
              <td class="td-mono">{{ a.providerTxnId ?? "—" }}</td>
              <td class="td-muted">{{ a.sentAt ? fmtDate(a.sentAt) : "—" }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Webhook deliveries -->
      <div v-if="payment.webhookDeliveries?.length" class="section-card">
        <div class="section-title">Webhook deliveries</div>
        <table class="table">
          <thead><tr><th>Event</th><th>Status</th><th>Attempts</th><th>Endpoint</th><th>Created</th></tr></thead>
          <tbody>
            <tr v-for="w in payment.webhookDeliveries" :key="w.id">
              <td class="td-mono">{{ w.eventType }}</td>
              <td><span class="status-badge sm" :class="whkClass(w.status)">{{ w.status }}</span></td>
              <td class="td-muted">{{ w.attemptNumber }}</td>
              <td class="td-mono">{{ w.webhookEndpoint?.code ?? "—" }}</td>
              <td class="td-muted">{{ fmtDate(w.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const route = useRoute()
const { data, pending } = await useFetch(`/api/admin/payments/${route.params.publicId}`)
const payment = computed(() => data.value as any)

function fmtAmount(v: string) {
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
const STATUS_CLASSES: Record<string, string> = {
  SUCCEEDED: "s-green", FAILED: "s-red", EXPIRED: "s-gray", CANCELLED: "s-gray",
  AWAITING_CUSTOMER: "s-amber", PROCESSING: "s-purple", CREATED: "s-blue",
  ROUTING: "s-blue", PENDING_PROVIDER: "s-orange", REVERSED: "s-gray", REFUNDED: "s-gray",
}
function statusClass(s: string) { return STATUS_CLASSES[s] ?? "s-gray" }
function whkClass(s: string) {
  return s === "DELIVERED" ? "s-green" : s === "DEAD" ? "s-red" : s === "RETRYING" ? "s-amber" : "s-gray"
}
</script>

<style scoped>
.page-header { margin-bottom: 24px; }
.back-btn { background: none; border: none; color: #555; font-size: 13px; cursor: pointer; padding: 0; margin-bottom: 12px; font-family: inherit; transition: color 0.15s; }
.back-btn:hover { color: #f59e0b; }
.header-main { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 20px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; font-family: 'DM Mono', monospace; }
.loading, .empty { padding: 40px; text-align: center; color: #444; font-size: 14px; }

.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; margin-bottom: 20px; }
.detail-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px 20px; }
.card-title { font-size: 11px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
.kv-list { display: flex; flex-direction: column; gap: 10px; }
.kv { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.k { font-size: 12px; color: #555; flex-shrink: 0; }
.v { font-size: 13px; color: #bbb; text-align: right; word-break: break-all; }
.v-mono { font-family: 'DM Mono', monospace; font-size: 11px; color: #888; }
.v-amount { font-size: 16px; font-weight: 700; color: #f0f0f0; }
.v-green { color: #22c55e; }
.v-red { color: #ef4444; }

.env-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; }
.env-live { background: #0f2a1a; color: #22c55e; }
.env-test { background: #1a1a2a; color: #60a5fa; }

.section-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 20px; margin-bottom: 16px; }
.section-title { font-size: 11px; font-weight: 600; color: #444; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }

.timeline { display: flex; flex-direction: column; gap: 0; }
.timeline-item { display: flex; gap: 14px; padding-bottom: 16px; position: relative; }
.timeline-item::before { content: ""; position: absolute; left: 5px; top: 18px; bottom: 0; width: 1px; background: #1e1e1e; }
.timeline-item:last-child::before { display: none; }
.tl-dot { width: 11px; height: 11px; border-radius: 50%; background: #2a2a2a; border: 2px solid #3a3a3a; flex-shrink: 0; margin-top: 3px; }
.tl-body { flex: 1; min-width: 0; }
.tl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.tl-type { font-size: 12px; font-weight: 600; color: #bbb; font-family: 'DM Mono', monospace; }
.tl-time { font-size: 11px; color: #444; }
.tl-transition { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.tl-from { font-size: 11px; color: #555; }
.tl-arrow { font-size: 11px; color: #333; }
.tl-summary { font-size: 12px; color: #555; }
.tl-empty { font-size: 13px; color: #444; text-align: center; padding: 20px 0; }

.table { width: 100%; border-collapse: collapse; }
.table th { padding: 8px 12px; font-size: 11px; font-weight: 600; color: #444; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1e1e1e; }
.table td { padding: 10px 12px; font-size: 13px; color: #bbb; border-bottom: 1px solid #171717; }
.table tr:last-child td { border-bottom: none; }
.td-mono { font-family: 'DM Mono', monospace; font-size: 11px; color: #888; }
.td-muted { color: #666; font-size: 12px; }

.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; letter-spacing: 0.3px; }
.status-badge.sm { font-size: 10px; padding: 2px 6px; }
.s-green  { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-red    { background: #2a0f0f; color: #ef4444; border: 1px solid #521515; }
.s-amber  { background: #2a1f0a; color: #f59e0b; border: 1px solid #523a0f; }
.s-blue   { background: #0f1a2a; color: #60a5fa; border: 1px solid #153352; }
.s-purple { background: #1a0f2a; color: #a78bfa; border: 1px solid #331552; }
.s-orange { background: #2a1a0a; color: #fb923c; border: 1px solid #523210; }
.s-gray   { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
</style>
