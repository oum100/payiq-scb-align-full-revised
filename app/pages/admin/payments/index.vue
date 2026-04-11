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

    <!-- Filters row 2: tenant + merchant + date range -->
    <div class="flex flex-wrap gap-2 mb-4 items-center">
      <USelect v-model="tenantFilter" :items="tenantOptions" value-key="value" label-key="label" class="w-48" />
      <USelect v-model="merchantFilter" :items="merchantOptions" value-key="value" label-key="label" class="w-48"
        :disabled="!tenantFilter" />
      <UInput v-model="fromDate" type="date" class="w-36" />
      <span class="text-gray-400 dark:text-neutral-500 text-xs">→</span>
      <UInput v-model="toDate" type="date" class="w-36" />
      <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-x" @click="clearFilters">Clear</UButton>
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="py-10 text-center text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Public ID</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Status</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Amount</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Tenant</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Merchant</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Customer</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Env</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Created</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="p.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
              @click="goDetail(p.publicId)">
              <td class="px-4 py-3">

                <div class="font-sans text-sm text-gray-700 dark:text-neutral-300">{{ p.publicId }}</div>

                <!-- <div v-if="p.providerTransactionId"
                  class="font-sans text-sm text-gray-400 dark:text-neutral-500 mt-0.5">{{ p.providerTransactionId }}
                </div> -->

              </td>
              <td class="px-4 py-3">
                <UBadge :color="statusColor(p.status)" variant="subtle" size="sm" class="font-semibold tracking-wide">
                  {{ p.status }}
                </UBadge>
              </td>
              <td class="px-4 py-3 font-semibold text-sm text-gray-900 dark:text-white">฿{{ fmtAmount(p.amount) }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ p.tenant?.name ?? "—" }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ p.merchantAccount?.name ?? "—" }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ p.customerName ?? p.customerEmail ??
                "—" }}</td>
              <td class="px-4 py-3">
                <UBadge :label="p.environment" :color="p.environment === 'LIVE' ? 'success' : 'warning'" variant="soft"
                  size="sm" />
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDate(p.createdAt) }}</td>
              <td class="px-4 py-3 text-right pr-5 text-gray-400 dark:text-neutral-500">›</td>
            </tr>
            <tr v-if="!items?.length">
              <td colspan="9" class="px-4 py-10 text-center text-sm text-gray-500 dark:text-neutral-400">No payments
                found</td>
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

// helper: "__all__" หรือ undefined ถือว่าไม่ได้ filter
const isAll = (v: string) => !v || v === "__all__"

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

// reset merchant when tenant changes
watch(tenantFilter, () => { merchantFilter.value = "__all__" })

// re-fetch on any filter change (NuxtUI v4 USelect ไม่ emit @change)
watch([statusFilter, envFilter, tenantFilter, merchantFilter, fromDate, toDate], () => {
  fetchPage(1)
})

// ─── static options ───────────────────────────────────────────────────────────
// NuxtUI v4 / Radix ห้ามใช้ value="" → ใช้ "__all__" แทน แล้ว convert ตอน query
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
