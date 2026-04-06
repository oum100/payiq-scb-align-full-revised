<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Payments</h1>
      <div class="header-actions">
        <span class="total-badge">{{ pagination?.total?.toLocaleString() ?? "—" }} total</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <input v-model="search" class="filter-input filter-search" placeholder="Search publicId, order, ref, email…" @input="onSearchInput" />
      <select v-model="statusFilter" class="filter-select" @change="fetchPage(1)">
        <option value="">All statuses</option>
        <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
      </select>
      <input v-model="fromDate" type="date" class="filter-input filter-date" @change="fetchPage(1)" />
      <span class="filter-sep">→</span>
      <input v-model="toDate" type="date" class="filter-input filter-date" @change="fetchPage(1)" />
      <button class="btn-clear" @click="clearFilters">Clear</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Public ID</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Merchant</th>
            <th>Order / Ref</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in items" :key="p.id" class="table-row" @click="goDetail(p.publicId)">
            <td class="td-mono">{{ p.publicId }}</td>
            <td><span class="status-badge" :class="statusClass(p.status)">{{ p.status }}</span></td>
            <td class="td-amount">฿{{ fmtAmount(p.amount) }}</td>
            <td class="td-muted">{{ p.merchantAccount?.name ?? "—" }}</td>
            <td class="td-mono td-sm">{{ p.merchantOrderId ?? p.merchantReference ?? "—" }}</td>
            <td class="td-muted td-sm">{{ fmtDate(p.createdAt) }}</td>
            <td class="td-arrow">›</td>
          </tr>
          <tr v-if="!items?.length">
            <td colspan="7" class="td-empty">No payments found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="pagination">
      <button :disabled="page <= 1" class="pg-btn" @click="fetchPage(page - 1)">‹ Prev</button>
      <span class="pg-info">Page {{ page }} of {{ pagination.totalPages }}</span>
      <button :disabled="page >= pagination.totalPages" class="pg-btn" @click="fetchPage(page + 1)">Next ›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const router = useRouter()
const STATUSES = ["CREATED","ROUTING","PENDING_PROVIDER","AWAITING_CUSTOMER","PROCESSING","SUCCEEDED","FAILED","CANCELLED","EXPIRED","REVERSED","REFUNDED"]

const page = ref(1)
const search = ref("")
const statusFilter = ref("")
const fromDate = ref("")
const toDate = ref("")

const queryParams = computed(() => ({
  page: page.value,
  pageSize: 25,
  ...(search.value && { search: search.value }),
  ...(statusFilter.value && { status: statusFilter.value }),
  ...(fromDate.value && { from: fromDate.value }),
  ...(toDate.value && { to: toDate.value }),
}))

const { data, pending, refresh } = await useFetch("/api/admin/payments", { query: queryParams, watch: [queryParams] })

const items = computed(() => (data.value as any)?.items ?? [])
const pagination = computed(() => (data.value as any)?.pagination)

function fetchPage(p: number) { page.value = p }

let searchTimer: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchPage(1), 350)
}
function clearFilters() {
  search.value = ""; statusFilter.value = ""; fromDate.value = ""; toDate.value = ""
  fetchPage(1)
}
function goDetail(publicId: string) { router.push(`/admin/payments/${publicId}`) }

function fmtAmount(v: string) {
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

const STATUS_CLASSES: Record<string, string> = {
  SUCCEEDED: "s-green", FAILED: "s-red", EXPIRED: "s-gray", CANCELLED: "s-gray",
  AWAITING_CUSTOMER: "s-amber", PROCESSING: "s-purple", CREATED: "s-blue",
  ROUTING: "s-blue", PENDING_PROVIDER: "s-orange", REVERSED: "s-gray", REFUNDED: "s-gray",
}
function statusClass(s: string) { return STATUS_CLASSES[s] ?? "s-gray" }
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; }
.total-badge { font-size: 12px; color: #555; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 4px 10px; }

.filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; align-items: center; }
.filter-input, .filter-select {
  background: #141414; border: 1px solid #242424; border-radius: 7px;
  color: #ccc; font-size: 13px; padding: 8px 12px; outline: none;
  font-family: inherit; transition: border-color 0.15s;
}
.filter-input:focus, .filter-select:focus { border-color: #f59e0b44; }
.filter-search { flex: 1; min-width: 200px; }
.filter-date { width: 140px; }
.filter-select { min-width: 160px; }
.filter-sep { color: #444; font-size: 12px; }
.btn-clear {
  background: transparent; border: 1px solid #242424; border-radius: 7px;
  color: #555; font-size: 13px; padding: 8px 14px; cursor: pointer;
  transition: color 0.15s; font-family: inherit;
}
.btn-clear:hover { color: #aaa; }

.table-wrap { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid #1e1e1e; }
.table th { padding: 12px 16px; font-size: 11px; font-weight: 600; color: #444; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
.table-row { border-bottom: 1px solid #1a1a1a; cursor: pointer; transition: background 0.1s; }
.table-row:hover { background: #1a1a1a; }
.table-row:last-child { border-bottom: none; }
td { padding: 12px 16px; font-size: 13px; color: #bbb; vertical-align: middle; }
.td-mono { font-family: 'DM Mono', monospace; font-size: 12px; color: #888; }
.td-amount { font-weight: 600; color: #f0f0f0; }
.td-muted { color: #666; }
.td-sm { font-size: 12px; }
.td-arrow { color: #333; font-size: 16px; text-align: right; padding-right: 20px; }
.td-empty { text-align: center; color: #444; padding: 40px; }
.table-loading { padding: 40px; text-align: center; color: #444; font-size: 14px; }

.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; letter-spacing: 0.3px; }
.s-green  { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-red    { background: #2a0f0f; color: #ef4444; border: 1px solid #521515; }
.s-amber  { background: #2a1f0a; color: #f59e0b; border: 1px solid #523a0f; }
.s-blue   { background: #0f1a2a; color: #60a5fa; border: 1px solid #153352; }
.s-purple { background: #1a0f2a; color: #a78bfa; border: 1px solid #331552; }
.s-orange { background: #2a1a0a; color: #fb923c; border: 1px solid #523210; }
.s-gray   { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }

.pagination { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 20px; }
.pg-btn {
  background: #141414; border: 1px solid #242424; border-radius: 7px;
  color: #888; font-size: 13px; padding: 7px 16px; cursor: pointer;
  transition: color 0.15s; font-family: inherit;
}
.pg-btn:hover:not(:disabled) { color: #f59e0b; border-color: #333; }
.pg-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.pg-info { font-size: 13px; color: #555; }
</style>
