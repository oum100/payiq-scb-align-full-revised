<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t("admin.webhook.title") }}
      </h1>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm"
        :loading="activeTab === 'deliveries' ? pending : epPending" @click="activeTab === 'deliveries' ? refresh() : epRefresh()" />
    </div>

    <!-- Tabs -->
    <UTabs v-model="activeTab" :items="tabs" />

    <!-- ── Deliveries Tab ── -->
    <template v-if="activeTab === 'deliveries'">
      <!-- Summary cards -->
      <div v-if="summary" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <UCard v-for="(val, label) in summaryCards" :key="label" class="text-center" :ui="{ body: 'p-4' }">
          <div v-if="val" class="text-2xl font-bold" :class="val.cls">{{ val.value }}</div>
          <div class="text-sm uppercase tracking-wide text-gray-500 dark:text-neutral-200 mt-1">{{ label }}</div>
        </UCard>
      </div>

      <!-- Filters -->
      <div class="flex flex-wrap gap-3">
        <div class="relative flex-1 min-w-[180px]">
          <UInput v-model="searchPublicId" placeholder="Payment public ID…" icon="i-lucide-search"
            class="w-full" @input="onInput" />
          <button v-if="searchPublicId" type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-800 dark:text-neutral-200"
            @click="clearSearch">
            <UIcon name="i-lucide-x" class="w-4 h-4" />
          </button>
        </div>
        <USelect v-model="statusFilter" :items="statusOptions" value-key="value" label-key="label"
          placeholder="All statuses" class="min-w-[160px]" />
      </div>

      <!-- Table -->
      <UCard :ui="{ body: 'p-0' }">
        <div v-if="pending" class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-300 text-sm">
          Loading…
        </div>
        <div v-else-if="!items.length"
          class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-300 text-sm">
          No deliveries found
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.eventType") }}</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.status") }}</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.attempts") }}</th>
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.paymentId") }}</th>
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.endPoint") }}</th>
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.http_status") }}</th>
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t("admin.webhook.createdAt") }}</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in items" :key="w.id"
                class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ w.eventType }}</td>
                <td class="px-4 py-3 flex items-center justify-center">
                  <UBadge :color="whkBadgeColor(w.status)" variant="subtle" size="sm">{{ w.status }}</UBadge>
                </td>
                <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ w.attemptNumber }}</td>
                <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ w.paymentIntent?.publicId ?? "—" }}</td>
                <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ w.webhookEndpoint?.code ?? "—" }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ w.responseStatusCode ?? "—" }}</td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDateTime(w.createdAt) }}</td>
                <td class="px-4 py-3 text-center">
                  <UButton v-if="w.status === 'DEAD'" size="sm" color="warning" variant="subtle"
                    icon="i-lucide-refresh-cw" :loading="redriving === w.id" @click="redrive(w.id)">
                    Redrive
                  </UButton>
                  <UButton v-else-if="['PENDING','RETRYING'].includes(w.status)" size="sm" color="error" variant="subtle"
                    icon="i-lucide-ban" :loading="cancelling === w.id" @click="cancelDelivery(w.id)">
                    Cancel
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Pagination -->
      <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-center gap-4">
        <UButton :disabled="page <= 1" color="neutral" variant="outline" size="sm" @click="page--">&lsaquo; Prev</UButton>
        <span class="text-sm text-gray-500 dark:text-neutral-300">Page {{ page }} of {{ pagination.totalPages }}</span>
        <UButton :disabled="page >= pagination.totalPages" color="neutral" variant="outline" size="sm" @click="page++">Next &rsaquo;</UButton>
      </div>
    </template>

    <!-- ── Endpoints Tab ── -->
    <template v-else-if="activeTab === 'endpoints'">
      <UCard :ui="{ body: 'p-0' }">
        <div v-if="epPending" class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-300 text-sm">Loading…</div>
        <div v-else-if="!endpoints.length" class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-300 text-sm">No endpoints found</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Endpoint</th>
                <th class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Tenant</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Status</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Max Attempts</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Timeout (ms)</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Deliveries</th>
                <th class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ep in endpoints" :key="ep.id"
                class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
                <td class="px-4 py-3">
                  <div class="font-medium text-gray-900 dark:text-white">{{ ep.code }}</div>
                  <div class="text-xs text-gray-400 dark:text-neutral-500 truncate max-w-[240px]">{{ ep.url }}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ ep.tenant?.name ?? "—" }}</td>
                <td class="px-4 py-3 text-center">
                  <UBadge :color="ep.status === 'ACTIVE' ? 'success' : 'neutral'" variant="subtle" size="sm">{{ ep.status }}</UBadge>
                </td>
                <!-- Inline edit: maxAttempts -->
                <td class="px-4 py-3 text-center">
                  <template v-if="editingId === ep.id">
                    <UInput v-model.number="editForm.maxAttempts" type="number" min="1" max="30" size="sm" class="w-20 mx-auto text-center" />
                  </template>
                  <span v-else class="text-gray-700 dark:text-neutral-300">{{ ep.maxAttempts }}</span>
                </td>
                <!-- Inline edit: timeoutMs -->
                <td class="px-4 py-3 text-center">
                  <template v-if="editingId === ep.id">
                    <UInput v-model.number="editForm.timeoutMs" type="number" min="1000" max="60000" step="1000" size="sm" class="w-28 mx-auto text-center" />
                  </template>
                  <span v-else class="text-gray-700 dark:text-neutral-300">{{ ep.timeoutMs.toLocaleString() }}</span>
                </td>
                <td class="px-4 py-3 text-center text-sm text-gray-500 dark:text-neutral-400">{{ ep.deliveryCount }}</td>
                <td class="px-4 py-3 text-center">
                  <div v-if="editingId === ep.id" class="flex items-center justify-center gap-2">
                    <UButton size="sm" color="primary" variant="solid" :loading="saving" @click="saveEndpoint(ep.id)">Save</UButton>
                    <UButton size="sm" color="neutral" variant="outline" @click="cancelEdit">Cancel</UButton>
                  </div>
                  <UButton v-else size="sm" color="neutral" variant="ghost" icon="i-lucide-settings" @click="startEdit(ep)" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'


definePageMeta({ layout: "admin", middleware: "admin-auth" })

function fmtDateTime(iso: string | null | undefined) {
  return fmtDateTimeFn(iso, $getLocale())
}

const { $t, $getLocale, } = useI18n()

// ── Tabs ────────────────��───────────────────────────���─────────────────────────
const activeTab = ref('deliveries')
const tabs = [
  { label: 'Deliveries', value: 'deliveries' },
  { label: 'Endpoints', value: 'endpoints', icon: 'i-lucide-settings' },
]

// ── Deliveries ──────────────────────────────��─────────────────────────���───────
const WH_STATUSES = ["PENDING", "PROCESSING", "DELIVERED", "FAILED", "RETRYING", "DEAD"]
const page = ref(1)
const statusFilter = ref("__all__")
const searchPublicId = ref("")

const statusOptions = [
  { label: "All statuses", value: "__all__" },
  ...WH_STATUSES.map((s) => ({ label: s, value: s })),
]

watch(statusFilter, () => { page.value = 1 })

const query = computed(() => ({
  page: page.value,
  pageSize: 30,
  ...(statusFilter.value !== "__all__" && { status: statusFilter.value }),
  ...(searchPublicId.value && { publicId: searchPublicId.value }),
}))

const { data, pending, refresh } = await useFetch("/api/internal/webhook-deliveries", { query, watch: [query] })
const { data: summaryData } = await useFetch("/api/internal/webhook-deliveries/summary")

const items = computed(() => (data.value as any)?.items ?? [])
const pagination = computed(() => (data.value as any)?.pagination)
const summary = computed(() => (summaryData.value as any)?.summary)

const summaryCards = computed(() => {
  if (!summary.value) return {}
  return {
    Total: { value: summary.value.total, cls: "text-gray-900 dark:text-white" },
    Delivered: { value: summary.value.delivered, cls: "text-green-600 dark:text-green-400" },
    Retrying: { value: summary.value.retrying, cls: "text-amber-600 dark:text-amber-400" },
    Dead: { value: summary.value.dead, cls: "text-red-600 dark:text-red-400" },
    "Last 24h": { value: summary.value.last24h, cls: "text-gray-900 dark:text-white" },
  }
})

let inputTimer: ReturnType<typeof setTimeout>
function onInput() {
  clearTimeout(inputTimer)
  inputTimer = setTimeout(() => { page.value = 1 }, 400)
}

function clearSearch() {
  searchPublicId.value = ""
  page.value = 1
}

const redriving = ref<string | null>(null)
const cancelling = ref<string | null>(null)

async function redrive(id: string) {
  redriving.value = id
  try {
    await $fetch(`/api/internal/webhook-deliveries/${id}/redrive`, { method: "POST" })
    await refresh()
  } finally {
    redriving.value = null
  }
}

async function cancelDelivery(id: string) {
  cancelling.value = id
  try {
    await $fetch(`/api/internal/webhook-deliveries/${id}/cancel`, { method: "POST" })
    await refresh()
  } finally {
    cancelling.value = null
  }
}

function whkBadgeColor(s: string): "success" | "error" | "warning" | "secondary" | "neutral" {
  if (s === "DELIVERED") return "success"
  if (s === "DEAD") return "error"
  if (s === "RETRYING") return "warning"
  if (s === "PROCESSING") return "secondary"
  return "neutral"
}

// ── Endpoints ──────────────────────────────────────────────────────────��───────
const { data: epData, pending: epPending, refresh: epRefresh } = await useFetch("/api/admin/webhooks/endpoints")
const endpoints = computed(() => (epData.value as any)?.items ?? [])

const editingId = ref<string | null>(null)
const editForm = ref({ maxAttempts: 10, timeoutMs: 10000 })
const saving = ref(false)

function startEdit(ep: any) {
  editingId.value = ep.id
  editForm.value = { maxAttempts: ep.maxAttempts, timeoutMs: ep.timeoutMs }
}

function cancelEdit() {
  editingId.value = null
}

async function saveEndpoint(id: string) {
  saving.value = true
  try {
    await $fetch(`/api/admin/webhooks/endpoints/${id}`, {
      method: "PATCH",
      body: editForm.value,
    })
    await epRefresh()
    editingId.value = null
  } finally {
    saving.value = false
  }
}
</script>
