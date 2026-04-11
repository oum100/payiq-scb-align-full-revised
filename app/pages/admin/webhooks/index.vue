<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t("admin.webhook.title") }}
      </h1>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" :loading="pending"
        @click="refresh()" />
    </div>

    <!-- Summary cards -->
    <div v-if="summary" class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <UCard v-for="(val, label) in summaryCards" :key="label" class="text-center" :ui="{ body: 'p-4' }">
        <div v-if="val" class="text-2xl font-bold" :class="val.cls">{{ val.value }}</div>
        <div class="text-sm uppercase tracking-wide text-gray-500 dark:text-neutral-200 mt-1">{{ label }}</div>
      </UCard>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <UInput v-model="searchPublicId" placeholder="Payment public ID…" icon="i-lucide-search"
        class="flex-1 min-w-[180px]" @input="onInput" />
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
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.eventType") }}</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.status") }}</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.attempts") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.paymentId") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.endPoint") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.http_status") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.webhook.createdAt") }}</th>
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
              <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ w.paymentIntent?.publicId
                ?? "—" }}</td>
              <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ w.webhookEndpoint?.code ??
                "—" }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ w.responseStatusCode ?? "—" }}</td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDateTime(w.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Pagination -->
    <div v-if="pagination && pagination.totalPages > 1" class="flex items-center justify-center gap-4">
      <UButton :disabled="page <= 1" color="neutral" variant="outline" size="sm" @click="page--">
        &lsaquo; Prev
      </UButton>
      <span class="text-sm text-gray-500 dark:text-neutral-300">
        Page {{ page }} of {{ pagination.totalPages }}
      </span>
      <UButton :disabled="page >= pagination.totalPages" color="neutral" variant="outline" size="sm" @click="page++">
        Next &rsaquo;
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'
const { $t, $getLocale } = useI18n()

definePageMeta({ layout: "admin", middleware: "admin-auth" })

// const { $getLocale } = useI18n()

function fmtDateTime(iso: string | null | undefined) {
  return fmtDateTimeFn(iso, $getLocale())
}

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

function whkBadgeColor(s: string): "success" | "error" | "warning" | "secondary" | "neutral" {
  if (s === "DELIVERED") return "success"
  if (s === "DEAD") return "error"
  if (s === "RETRYING") return "warning"
  if (s === "PROCESSING") return "secondary"
  return "neutral"
}
</script>
