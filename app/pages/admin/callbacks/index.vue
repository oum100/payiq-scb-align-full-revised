<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Callbacks</h1>
      <button class="refresh-btn" :class="{ spinning: pending }" @click="refresh">↻</button>
    </div>

    <div class="filters">
      <select v-model="statusFilter" class="filter-select" @change="page = 1">
        <option value="">All statuses</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="providerFilter" class="filter-select" @change="page = 1">
        <option value="">All providers</option>
        <option value="SCB">SCB</option>
        <option value="KBANK">KBANK</option>
      </select>
    </div>

    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Provider</th>
            <th>Status</th>
            <th>Sig. valid</th>
            <th>Provider Ref</th>
            <th>Provider Txn</th>
            <th>Received</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cb in items" :key="cb.id" class="table-row">
            <td class="td-mono">{{ cb.id.slice(-8) }}</td>
            <td class="td-muted">{{ cb.providerCode }}</td>
            <td><span class="status-badge" :class="cbStatusClass(cb.processStatus)">{{ cb.processStatus }}</span></td>
            <td>
              <span v-if="cb.signatureValid === true" class="sig-ok">✓</span>
              <span v-else-if="cb.signatureValid === false" class="sig-fail">✗</span>
              <span v-else class="sig-na">—</span>
            </td>
            <td class="td-mono">{{ cb.providerReference ?? "—" }}</td>
            <td class="td-mono">{{ cb.providerTxnId ?? "—" }}</td>
            <td class="td-muted">{{ fmtDate(cb.receivedAt) }}</td>
            <td class="td-error">{{ cb.errorMessage ? cb.errorMessage.slice(0, 50) : "—" }}</td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="8" class="td-empty">No callbacks found</td>
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

const STATUSES = ["RECEIVED","QUEUED","PROCESSING","PROCESSED","DUPLICATE","FAILED","IGNORED"]
const page = ref(1)
const statusFilter = ref("")
const providerFilter = ref("")

const query = computed(() => ({
  page: page.value, pageSize: 30,
  ...(statusFilter.value && { status: statusFilter.value }),
  ...(providerFilter.value && { providerCode: providerFilter.value }),
}))

const { data, pending, refresh } = await useFetch("/api/internal/callbacks", { query, watch: [query] })
const items = computed(() => (data.value as any)?.items ?? [])
const pagination = computed(() => (data.value as any)?.pagination)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}
function cbStatusClass(s: string) {
  if (s === "PROCESSED") return "s-green"
  if (s === "FAILED") return "s-red"
  if (s === "QUEUED" || s === "PROCESSING") return "s-amber"
  if (s === "DUPLICATE") return "s-gray"
  return "s-blue"
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 32px; font-weight: 600; color: #6a6868; letter-spacing: -0.3px; }
.refresh-btn { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 7px; color: #acabab; font-size: 18px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
.refresh-btn:hover { color: #f59e0b; }
.refresh-btn.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
.filter-select { background: #141414; border: 1px solid #242424; border-radius: 7px; color: #ccc; font-size: 13px; padding: 8px 12px; outline: none; font-family: inherit; min-width: 160px; }
.table-wrap { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid #1e1e1e; }
.table th { padding: 12px 14px; font-size: 11px; font-weight: 600; color: #b2b2b2; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
.table-row { border-bottom: 1px solid #1a1a1a; }
.table-row:last-child { border-bottom: none; }
td { padding: 11px 14px; font-size: 13px; color: #b2b2b2; vertical-align: middle; }
.td-mono { font-family: 'DM Mono', monospace; font-size: 11px; color: #b2b2b2; }
.td-muted { color: #b2b2b2; font-size: 12px; }
.td-error { font-size: 11px; color: #ef4444; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.td-empty, .table-loading { text-align: center; color: #b2b2b2; padding: 40px; font-size: 14px; }
.sig-ok { color: #22c55e; font-weight: 700; }
.sig-fail { color: #ef4444; font-weight: 700; }
.sig-na { color: #444; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
.s-green  { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-red    { background: #2a0f0f; color: #ef4444; border: 1px solid #521515; }
.s-amber  { background: #2a1f0a; color: #f59e0b; border: 1px solid #523a0f; }
.s-blue   { background: #0f1a2a; color: #60a5fa; border: 1px solid #153352; }
.s-gray   { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.pg-btn { background: #141414; border: 1px solid #242424; border-radius: 7px; color: #888; font-size: 13px; padding: 7px 16px; cursor: pointer; font-family: inherit; }
.pg-btn:hover:not(:disabled) { color: #f59e0b; }
.pg-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pg-info { font-size: 13px; color: #555; }
</style>
