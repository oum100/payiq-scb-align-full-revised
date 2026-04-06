<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Webhook Deliveries</h1>
      <button class="refresh-btn" :class="{ spinning: pending }" @click="refresh">↻</button>
    </div>

    <!-- Summary cards -->
    <div class="summary-grid" v-if="summary">
      <div class="s-card"><div class="s-val">{{ summary.total }}</div><div class="s-lbl">Total</div></div>
      <div class="s-card"><div class="s-val s-green">{{ summary.delivered }}</div><div class="s-lbl">Delivered</div></div>
      <div class="s-card"><div class="s-val s-amber">{{ summary.retrying }}</div><div class="s-lbl">Retrying</div></div>
      <div class="s-card"><div class="s-val s-red">{{ summary.dead }}</div><div class="s-lbl">Dead</div></div>
      <div class="s-card"><div class="s-val">{{ summary.last24h }}</div><div class="s-lbl">Last 24h</div></div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="searchPublicId" class="filter-input" placeholder="Payment public ID…" @input="onInput" />
      <select v-model="statusFilter" class="filter-select" @change="page = 1">
        <option value="">All statuses</option>
        <option v-for="s in WH_STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
    </div>

    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Event type</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Payment ID</th>
            <th>Endpoint</th>
            <th>HTTP</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in items" :key="w.id" class="table-row">
            <td class="td-mono">{{ w.eventType }}</td>
            <td><span class="status-badge" :class="whkClass(w.status)">{{ w.status }}</span></td>
            <td class="td-muted">{{ w.attemptNumber }}</td>
            <td class="td-mono">{{ w.paymentIntent?.publicId ?? "—" }}</td>
            <td class="td-mono">{{ w.webhookEndpoint?.code ?? "—" }}</td>
            <td class="td-muted">{{ w.responseStatusCode ?? "—" }}</td>
            <td class="td-muted">{{ fmtDate(w.createdAt) }}</td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="7" class="td-empty">No deliveries found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="pagination && pagination.totalPages > 1" class="pagination">
      <button :disabled="page <= 1" class="pg-btn" @click="page--">‹ Prev</button>
      <span class="pg-info">Page {{ page }} of {{ pagination.totalPages }}</span>
      <button :disabled="page >= pagination.totalPages" class="pg-btn" @click="page++">Next ›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const WH_STATUSES = ["PENDING","PROCESSING","DELIVERED","FAILED","RETRYING","DEAD"]
const page = ref(1)
const statusFilter = ref("")
const searchPublicId = ref("")

const query = computed(() => ({
  page: page.value, pageSize: 30,
  ...(statusFilter.value && { status: statusFilter.value }),
  ...(searchPublicId.value && { publicId: searchPublicId.value }),
}))

const { data, pending, refresh } = await useFetch("/api/internal/webhook-deliveries", { query, watch: [query] })
const { data: summaryData } = await useFetch("/api/internal/webhook-deliveries/summary")

const items = computed(() => (data.value as any)?.items ?? [])
const pagination = computed(() => (data.value as any)?.pagination)
const summary = computed(() => (summaryData.value as any)?.summary)

let inputTimer: ReturnType<typeof setTimeout>
function onInput() { clearTimeout(inputTimer); inputTimer = setTimeout(() => { page.value = 1 }, 400) }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}
function whkClass(s: string) {
  return s === "DELIVERED" ? "s-green" : s === "DEAD" ? "s-red" : s === "RETRYING" ? "s-amber" : s === "PROCESSING" ? "s-purple" : "s-gray"
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 32px; font-weight: 600; color: #ababab; letter-spacing: -0.3px; }
.refresh-btn { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 7px; color: #666; font-size: 18px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
.refresh-btn:hover { color: #f59e0b; }
.refresh-btn.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 10px; margin-bottom: 20px; }
.s-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 10px; padding: 14px 16px; text-align: center; }
.s-val { font-size: 22px; font-weight: 700; color: #f0f0f0; margin-bottom: 4px; }
.s-lbl { font-size: 11px; color: #444; text-transform: uppercase; letter-spacing: 0.5px; }
.s-green { color: #22c55e; }
.s-amber { color: #f59e0b; }
.s-red   { color: #ef4444; }
.filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-input { background: #141414; border: 1px solid #242424; border-radius: 7px; color: #ababab; font-size: 13px; padding: 8px 12px; outline: none; font-family: inherit; flex: 1; min-width: 180px; }
.filter-select { background: #141414; border: 1px solid #242424; border-radius: 7px; color: #ababab; font-size: 13px; padding: 8px 12px; outline: none; font-family: inherit; min-width: 160px; }
.table-wrap { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid #1e1e1e; }
.table th { padding: 12px 14px; font-size: 11px; font-weight: 600; color: #b2b2b2; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
.table-row { border-bottom: 1px solid #1a1a1a; }
.table-row:last-child { border-bottom: none; }
td { padding: 11px 14px; font-size: 13px; color: #b2b2b2; vertical-align: middle; }
.td-mono { font-family: 'DM Mono', monospace; font-size: 11px; color: #b2b2b2; }
.td-muted { color: #b2b2b2; font-size: 12px; }
.td-empty, .table-loading { text-align: center; color: #444; padding: 40px; font-size: 14px; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
.s-green  { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-red    { background: #2a0f0f; color: #ef4444; border: 1px solid #521515; }
.s-amber  { background: #2a1f0a; color: #f59e0b; border: 1px solid #523a0f; }
.s-purple { background: #1a0f2a; color: #a78bfa; border: 1px solid #331552; }
.s-gray   { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.pg-btn { background: #141414; border: 1px solid #242424; border-radius: 7px; color: #888; font-size: 13px; padding: 7px 16px; cursor: pointer; font-family: inherit; }
.pg-btn:hover:not(:disabled) { color: #f59e0b; }
.pg-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pg-info { font-size: 13px; color: #555; }
</style>
