<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t("admin.callback.title") }}
      </h1>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" :loading="pending"
        @click="refresh()" />
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-3">
      <USelect v-model="statusFilter" :items="statusOptions" value-key="value" label-key="label"
        placeholder="All statuses" class="min-w-[160px]" />
      <USelect v-model="providerFilter" :items="providerOptions" value-key="value" label-key="label"
        placeholder="All providers" class="min-w-[160px]" />
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-400 text-sm">
        Loading…
      </div>
      <div v-else-if="!items.length"
        class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-400 text-sm">
        No callbacks found
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.id") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.provider") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.status") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.sig_valid") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.providerRef") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.providerTxn") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.receivedAt") }}</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                {{ $t("admin.callback.error") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cb in items" :key="cb.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ cb.id.slice(-8) }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ cb.providerCode }}</td>
              <td class="px-4 py-3">
                <UBadge :color="cbBadgeColor(cb.processStatus)" variant="subtle" size="sm">{{ cb.processStatus }}
                </UBadge>
              </td>
              <td class="px-4 py-3">
                <UIcon v-if="cb.signatureValid === true" name="i-lucide-check-circle"
                  class="text-green-500 dark:text-green-400 w-5 h-5" />
                <UIcon v-else-if="cb.signatureValid === false" name="i-lucide-x-circle"
                  class="text-red-500 dark:text-red-400 w-5 h-5" />
                <span v-else class="text-gray-400 dark:text-neutral-600">—</span>
              </td>
              <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ cb.providerReference ?? "—"
                }}</td>
              <td class="px-4 py-3 font-sans text-sm text-gray-500 dark:text-neutral-400">{{ cb.providerTxnId ?? "—" }}
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDateTime(cb.receivedAt) }}</td>
              <td class="px-4 py-3 text-sm text-red-600 dark:text-red-400 max-w-[200px] truncate">
                {{ cb.errorMessage ? cb.errorMessage.slice(0, 50) : "—" }}
              </td>
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
      <span class="text-sm text-gray-500 dark:text-neutral-400">
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

definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { $t, $getLocale } = useI18n()

function fmtDateTime(iso: string | null | undefined) {
  return fmtDateTimeFn(iso, $getLocale())
}

const STATUSES = ["RECEIVED", "QUEUED", "PROCESSING", "PROCESSED", "DUPLICATE", "FAILED", "IGNORED"]
const page = ref(1)
const statusFilter = ref("__all__")
const providerFilter = ref("__all__")

const statusOptions = [
  { label: "All statuses", value: "__all__" },
  ...STATUSES.map((s) => ({ label: s, value: s })),
]
const providerOptions = [
  { label: "All providers", value: "__all__" },
  { label: "SCB", value: "SCB" },
  { label: "KBANK", value: "KBANK" },
]

watch([statusFilter, providerFilter], () => { page.value = 1 })

const query = computed(() => ({
  page: page.value,
  pageSize: 30,
  ...(statusFilter.value !== "__all__" && { status: statusFilter.value }),
  ...(providerFilter.value !== "__all__" && { providerCode: providerFilter.value }),
}))

const { data, pending, refresh } = await useFetch("/api/internal/callbacks", { query, watch: [query] })
const items = computed(() => (data.value as any)?.items ?? [])
const pagination = computed(() => (data.value as any)?.pagination)

function cbBadgeColor(s: string): "success" | "error" | "warning" | "info" | "neutral" {
  if (s === "PROCESSED") return "success"
  if (s === "FAILED") return "error"
  if (s === "QUEUED" || s === "PROCESSING") return "warning"
  if (s === "DUPLICATE") return "neutral"
  return "info"
}
</script>
