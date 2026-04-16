<template>
  <div>
    <!-- Page header -->
    <div class="flex items-center justify-between mb-5">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Payments</h1>
      <UBadge color="neutral" variant="subtle" class="text-sm">
        {{ pagination?.total?.toLocaleString() ?? "—" }} total
      </UBadge>
    </div>

    <!-- Filters row 1: search + status + env -->
    <div class="flex flex-wrap gap-2 mb-2 items-center">
      <UInput v-model="search" placeholder="Search ID, order, customer, description…" icon="i-lucide-search"
        class="flex-1 min-w-48" @input="onSearchInput" />
      <USelect v-model="statusFilter" :items="statusOptions" value-key="value" label-key="label" class="w-48" />
      <USelect v-model="envFilter" :items="envOptions" value-key="value" label-key="label" class="w-28" />
    </div>

    <!-- Filters row 2: tenant + merchant + date range + column toggle -->
    <div class="flex flex-wrap gap-2 mb-4 items-center">
      <USelect v-model="tenantFilter" :items="tenantOptions" value-key="value" label-key="label" class="w-48" />
      <USelect v-model="merchantFilter" :items="merchantOptions" value-key="value" label-key="label" class="w-48"
        :disabled="!tenantFilter" />
      <UInput v-model="fromDate" type="date" class="w-36" />
      <span class="text-gray-400 dark:text-neutral-500 text-sm">→</span>
      <UInput v-model="toDate" type="date" class="w-36" />
      <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-x" @click="clearFilters">Clear</UButton>

      <!-- Column toggle -->
      <div class="relative ml-auto" ref="colMenuAnchor">
        <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-columns-3"
          :trailing-icon="colMenuOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
          @click="colMenuOpen = !colMenuOpen">
          Columns
        </UButton>
        <div v-if="colMenuOpen"
          class="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg py-1">
          <label v-for="col in TOGGLE_COLS" :key="col.key"
            class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 select-none">
            <input type="checkbox" :checked="visibleCols.has(col.key)"
              class="rounded border-gray-300 dark:border-neutral-600 text-primary-500 focus:ring-primary-500"
              @change="toggleCol(col.key)" />
            <span class="text-sm text-gray-700 dark:text-neutral-200">{{ col.label }}</span>
          </label>
          <div class="border-t border-gray-100 dark:border-neutral-800 mt-1 pt-1 px-3 pb-1">
            <button class="text-sm text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-gray-700 dark:text-neutral-300"
              @click="resetCols">Reset to default</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="py-10 text-center text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <!-- Fixed columns -->
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Status</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Amount</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Public ID</th>
              <!-- Toggleable columns -->
              <th v-if="col('method')"
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Method</th>
              <th v-if="col('provider')"
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Provider</th>
              <th v-if="col('customer')"
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Customer</th>
              <th v-if="col('tenant')"
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Tenant</th>
              <th v-if="col('merchant')"
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Merchant</th>
              <th v-if="col('created')"
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Created</th>
              <th v-if="col('env')"
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Env</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="p.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
              @click="goDetail(p.publicId)">
              <!-- Status -->
              <td class="px-4 py-3 text-center">
                <UBadge :color="statusColor(p.status)" variant="subtle" size="sm" class="font-semibold tracking-wide">{{
                  p.status }}</UBadge>
              </td>
              <!-- Amount -->
              <td class="px-4 py-3 font-semibold text-sm text-gray-900 dark:text-white whitespace-nowrap">฿{{
                fmtAmount(p.amount) }}</td>
              <!-- Public ID -->
              <td class="px-4 py-3 font-mono text-sm text-gray-700 dark:text-neutral-300">{{ p.publicId }}</td>
              <!-- Method -->
              <td v-if="col('method')" class="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300 font-mono">{{
                p.paymentMethodType ?? '—' }}</td>
              <!-- Provider -->
              <td v-if="col('provider')" class="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300 font-mono">{{
                p.paymentMethodType === 'CASH' ? 'CASH' : (p.providerCode ?? '—') }}</td>
              <!-- Customer -->
              <td v-if="col('customer')" class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ p.customerName
                ?? p.customerEmail ?? '—' }}</td>
              <!-- Tenant -->
              <td v-if="col('tenant')" class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ p.tenant?.name
                ?? '—' }}</td>
              <!-- Merchant -->
              <td v-if="col('merchant')" class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{
                p.merchantAccount?.name ?? '—' }}</td>
              <!-- Created -->
              <td v-if="col('created')" class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-300 whitespace-nowrap">
                {{ fmtDate(p.createdAt) }}</td>
              <!-- ENV -->
              <td v-if="col('env')" class="px-4 py-3 text-center">
                <UBadge :label="p.environment" :color="p.environment === 'LIVE' ? 'success' : 'warning'" variant="soft"
                  size="sm" />
              </td>
            </tr>
            <tr v-if="!items?.length">
              <td :colspan="activeColCount" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-neutral-300">
                No payments found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-center gap-4 mt-5">
      <UButton color="neutral" variant="outline" size="sm" :disabled="page <= 1" @click="fetchPage(page - 1)">‹ Prev
      </UButton>
      <span class="text-sm text-gray-500 dark:text-neutral-400">Page {{ page }} of {{ pagination.totalPages }}</span>
      <UButton color="neutral" variant="outline" size="sm" :disabled="page >= pagination.totalPages"
        @click="fetchPage(page + 1)">Next ›</UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'

definePageMeta({ layout: "admin", middleware: "admin-auth" })

const router = useRouter()
const { $t, $getLocale } = useI18n()

// ─── filter state ─────────────────────────────────────────────────────────────
const page = ref(1)
const search = ref("")
const statusFilter = ref("__all__")
const envFilter = ref("__all__")
const tenantFilter = ref("__all__")
const merchantFilter = ref("__all__")
const fromDate = ref("")
const toDate = ref("")

const isAll = (v: string) => !v || v === "__all__"

// ─── column toggle ────────────────────────────────────────────────────────────
const LS_KEY = "payiq:payments:cols"

const TOGGLE_COLS = [
  { key: "method", label: "Method" },
  { key: "provider", label: "Provider" },
  { key: "customer", label: "Customer" },
  { key: "tenant", label: "Tenant" },
  { key: "merchant", label: "Merchant" },
  { key: "created", label: "Created" },
  { key: "env", label: "Env" },
] as const

type ColKey = typeof TOGGLE_COLS[number]["key"]

const DEFAULT_COLS = new Set<ColKey>(["env", "method", "provider", "customer", "tenant", "merchant", "created"])

function loadCols(): Set<ColKey> {
  if (!import.meta.client) return new Set(DEFAULT_COLS)
  try {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) return new Set(JSON.parse(saved) as ColKey[])
  } catch { }
  return new Set(DEFAULT_COLS)
}

const visibleCols = ref<Set<ColKey>>(loadCols())

function col(key: ColKey) { return visibleCols.value.has(key) }

function toggleCol(key: ColKey) {
  const next = new Set(visibleCols.value)
  next.has(key) ? next.delete(key) : next.add(key)
  visibleCols.value = next
  if (import.meta.client) localStorage.setItem(LS_KEY, JSON.stringify([...next]))
}

function resetCols() {
  visibleCols.value = new Set(DEFAULT_COLS)
  if (import.meta.client) localStorage.removeItem(LS_KEY)
}

// 3 fixed (status, amount, publicId) + toggled
const activeColCount = computed(() => 3 + [...TOGGLE_COLS].filter(c => visibleCols.value.has(c.key)).length)

// close column menu when clicking outside
const colMenuOpen = ref(false)
const colMenuAnchor = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (colMenuAnchor.value && !colMenuAnchor.value.contains(e.target as Node)) colMenuOpen.value = false
}
onMounted(() => document.addEventListener("click", onDocClick, true))
onUnmounted(() => document.removeEventListener("click", onDocClick, true))

// ─── tenant dropdown ──────────────────────────────────────────────────────────
const { data: tenantsData } = await useFetch<{ items: { id: string; code: string; name: string }[] }>("/api/admin/tenants")
const tenantOptions = computed(() => [
  { label: "All tenants", value: "__all__" },
  ...(tenantsData.value?.items ?? []).map(t => ({ label: `${t.name} (${t.code})`, value: t.id })),
])

// ─── merchant dropdown (filtered by selected tenant) ──────────────────────────
const { data: merchantsData } = await useFetch<{ items: { id: string; name: string; tenantId: string }[] }>("/api/admin/merchants")
const merchantOptions = computed(() => {
  const list = (merchantsData.value?.items ?? [])
    .filter(m => isAll(tenantFilter.value) || m.tenantId === tenantFilter.value)
    .map(m => ({ label: m.name, value: m.id }))
  return [{ label: "All merchants", value: "__all__" }, ...list]
})

watch(tenantFilter, () => { merchantFilter.value = "__all__" })
watch([statusFilter, envFilter, tenantFilter, merchantFilter, fromDate, toDate], () => fetchPage(1))

// ─── static options ───────────────────────────────────────────────────────────
const STATUSES = ["CREATED", "ROUTING", "PENDING_PROVIDER", "AWAITING_CUSTOMER", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELLED", "EXPIRED", "REVERSED", "REFUNDED"]
const statusOptions = computed(() => [
  { label: "All statuses", value: "__all__" },
  ...STATUSES.map(s => ({ label: s, value: s })),
])
const envOptions = [
  { label: "All envs", value: "__all__" },
  { label: "TEST", value: "TEST" },
  { label: "LIVE", value: "LIVE" },
]

// ─── fetch ────────────────────────────────────────────────────────────────────
const queryParams = computed(() => ({
  page: page.value,
  pageSize: 25,
  ...(!isAll(statusFilter.value) && { status: statusFilter.value }),
  ...(!isAll(envFilter.value) && { environment: envFilter.value }),
  ...(!isAll(tenantFilter.value) && { tenantId: tenantFilter.value }),
  ...(!isAll(merchantFilter.value) && { merchantId: merchantFilter.value }),
  ...(search.value && { search: search.value }),
  ...(fromDate.value && { from: fromDate.value }),
  ...(toDate.value && { to: toDate.value }),
}))

const { data, pending } = await useFetch("/api/admin/payments", { query: queryParams, watch: [queryParams] })

const items = computed(() => (data.value as any)?.items ?? [])
const pagination = computed(() => (data.value as any)?.pagination)

function fetchPage(p: number) { page.value = p }

let searchTimer: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => fetchPage(1), 350)
}

function clearFilters() {
  search.value = ""
  statusFilter.value = "__all__"
  envFilter.value = "__all__"
  tenantFilter.value = "__all__"
  merchantFilter.value = "__all__"
  fromDate.value = ""
  toDate.value = ""
  page.value = 1
}

function goDetail(publicId: string) { router.push(`/admin/payments/${publicId}`) }

function fmtAmount(v: string) {
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(iso: string) { return fmtDateTimeFn(iso, $getLocale()) }

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: "success",
  FAILED: "error",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  REVERSED: "warning",
  REFUNDED: "info",
  AWAITING_CUSTOMER: "warning",
  PROCESSING: "info",
  CREATED: "neutral",
  ROUTING: "neutral",
  PENDING_PROVIDER: "warning",
}
function statusColor(s: string): any { return STATUS_COLORS[s] ?? "neutral" }
</script>
