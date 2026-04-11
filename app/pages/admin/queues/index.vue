<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t("admin.queue.title") }}
      </h1>
      <UButton icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" :loading="pending"
        @click="() => refresh()" />
    </div>

    <!-- Last updated -->
    <p class="text-sm text-gray-500 dark:text-neutral-200 -mt-3">
      {{ data?.generatedAt ? $t("admin.queue.lastUpdated") + ": " + fmtDateTime(data.generatedAt) : "Loading…" }}
    </p>

    <!-- Empty state -->
    <div v-if="!pending && !data?.items?.length"
      class="flex items-center justify-center py-20 text-gray-300 dark:text-neutral-400 text-sm">
      No queue data available
    </div>

    <!-- Queue grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <UCard v-for="q in data?.items ?? []" :key="q.name" :ui="{ body: 'p-5' }">
        <!-- Card Header -->
        <template #header>
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold capitalize text-gray-900 dark:text-white">
              {{ shortName(q.name) }}
            </div>
            <UBadge :color="healthBadgeColor(q.counts)" size="lg">
              {{ healthLabel(q.counts) }}
            </UBadge>
          </div>
          <div class="font-sans text-sm text-gray-500 dark:text-neutral-400 truncate">
            {{ q.name }}
          </div>
        </template>

        <!-- Metrics grid -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          <div v-for="(val, key) in q.counts" :key="key" class="text-center">
            <div class="text-xl font-bold" :class="metricClass(key as string, val)">{{ val }}</div>
            <div class="text-sm capitalize text-gray-500 dark:text-neutral-400 mt-0.5">{{ key }}</div>
          </div>
        </div>
      </UCard>
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

const { data, pending, refresh } = await useFetch("/api/internal/queues/health", {
  transform: (d: any) => d,
})

function shortName(name: string) {
  return name.replace("payiq-", "").replace(/-/g, " ")
}

function metricClass(key: string, val: number) {
  if (key === "failed" && val > 0) return "text-red-600 dark:text-red-400"
  if (key === "active" && val > 0) return "text-amber-600 dark:text-amber-400"
  if (key === "waiting" && val > 10) return "text-amber-600 dark:text-amber-400"
  if (val > 0) return "text-gray-900 dark:text-neutral-200"
  return "text-gray-300 dark:text-neutral-700"
}

function healthBadgeColor(counts: Record<string, number>): "error" | "warning" | "success" {
  if ((counts.failed ?? 0) > 0) return "error"
  if ((counts.active ?? 0) > 0 || (counts.waiting ?? 0) > 0) return "warning"
  return "success"
}

function healthLabel(counts: Record<string, number>) {
  if ((counts.failed ?? 0) > 0) return `${counts.failed} FAILED`
  if ((counts.active ?? 0) > 0) return `${counts.active} ACTIVE`
  if ((counts.waiting ?? 0) > 0) return `${counts.waiting} WAITING`
  return "IDLE"
}
</script>
