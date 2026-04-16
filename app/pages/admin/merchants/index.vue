<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">
    <!-- Page header -->
    <div class="mb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Merchants</h1>
    </div>

    <!-- Table card -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">
        Loading…
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Name</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Code</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Tenant</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Status</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Env</th>
              <th
                class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Payments</th>
              <th
                class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                API Keys</th>
              <th
                class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Webhooks</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in items" :key="m.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <td class="px-4 py-3 font-medium text-sm text-gray-900 dark:text-white">{{ m.name }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ m.code }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ m.tenant?.name ?? m.tenant?.code ??
                '—' }}</td>
              <td class="px-4 py-3">
                <UBadge :label="m.status" :color="m.status === 'ACTIVE' ? 'success' : 'neutral'" variant="soft"
                  size="sm" />
              </td>
              <td class="px-4 py-3">
                <UBadge :label="m.environment" :color="m.environment === 'LIVE' ? 'success' : 'info'" variant="soft"
                  size="sm" />
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ m._count?.paymentIntents
                ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ m._count?.apiKeys ?? 0 }}
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{
                m._count?.webhookEndpoints ?? 0 }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{{ fmtDateTime(m.createdAt) }}</td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="9" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">
                No merchants found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { $t, $getLocale } = useI18n()

function fmtDateTime(iso: string | null | undefined) {
  return fmtDateTimeFn(iso, $getLocale())
}

const { data, pending } = await useFetch("/api/admin/merchants")
const items = computed(() => (data.value as any)?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
</script>
