<template>
  <div>
    <!-- Page header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">Dashboard</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">{{ today }}</p>
      </div>
      <UButton
        icon="i-heroicons-arrow-path"
        color="neutral"
        variant="outline"
        :loading="pending"
        title="Refresh"
        @click="() => refresh()"
      />
    </div>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      <UCard class="col-span-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">Revenue (all time)</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">฿{{ fmtAmount(stats?.totalRevenueTHB) }}</p>
        <p class="text-xs mt-1 text-gray-500 dark:text-neutral-400">{{ fmtNum(stats?.totalPayments) }} payments total</p>
      </UCard>

      <UCard class="col-span-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">Payments (24h)</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmtNum(stats?.payments24h) }}</p>
        <p class="text-xs mt-1 text-green-600 dark:text-green-400">{{ stats?.succeededToday ?? 0 }} succeeded</p>
      </UCard>

      <UCard class="col-span-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">Success rate (24h)</p>
        <p class="text-2xl font-bold" :class="rateColorClass">{{ stats?.successRate24h ?? 0 }}%</p>
        <p class="text-xs mt-1 text-red-500 dark:text-red-400">{{ stats?.failedToday ?? 0 }} failed today</p>
      </UCard>

      <UCard class="col-span-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">Pending callbacks</p>
        <p class="text-2xl font-bold" :class="stats?.pendingCallbacks ? 'text-amber-500' : 'text-gray-900 dark:text-white'">
          {{ fmtNum(stats?.pendingCallbacks) }}
        </p>
        <p class="text-xs mt-1 text-gray-500 dark:text-neutral-400">Dead webhooks: {{ stats?.deadWebhooks ?? 0 }}</p>
      </UCard>

      <UCard class="col-span-1">
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-2">Active merchants</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmtNum(stats?.activeMerchants) }}</p>
        <p class="text-xs mt-1 text-gray-500 dark:text-neutral-400">{{ stats?.activeApiKeys ?? 0 }} active API keys</p>
      </UCard>
    </div>

    <!-- Charts row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
      <!-- Revenue bar chart -->
      <UCard>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-4">Revenue — last 7 days (THB)</p>
        <div class="flex items-end gap-1.5 h-24">
          <template v-for="(d, i) in revenueChart" :key="i">
            <div class="flex-1 flex flex-col items-center gap-1.5">
              <div
                class="w-full rounded-t bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/35 transition-colors cursor-default min-h-1"
                :style="{ height: barHeight(d.revenue) + 'px' }"
                :title="`฿${fmtAmount(d.revenue)} · ${d.count} txns`"
              />
              <span class="text-[10px] text-gray-500 dark:text-neutral-400 whitespace-nowrap">{{ shortDate(d.date) }}</span>
            </div>
          </template>
        </div>
      </UCard>

      <!-- Status distribution -->
      <UCard>
        <p class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-4">Status distribution (24h)</p>
        <div class="flex flex-col gap-2.5">
          <div v-for="row in statusDistribution" :key="row.status" class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: statusColor(row.status) }" />
            <span class="text-xs text-gray-700 dark:text-neutral-200 w-36 flex-shrink-0">{{ row.status }}</span>
            <div class="flex-1 h-1 bg-gray-100 dark:bg-neutral-800 rounded overflow-hidden">
              <span
                class="block h-full rounded transition-all"
                :style="{ width: distPct(row.count) + '%', background: statusColor(row.status) }"
              />
            </div>
            <span class="text-xs text-gray-500 dark:text-neutral-400 w-7 text-right flex-shrink-0">{{ row.count }}</span>
          </div>
          <p v-if="!statusDistribution?.length" class="text-sm text-gray-500 dark:text-neutral-400 text-center py-5">
            No payments in last 24h
          </p>
        </div>
      </UCard>
    </div>

    <!-- Quick links -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <NuxtLink
        v-for="link in quickLinks"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-gray-700 dark:text-neutral-200 hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
      >
        <UIcon :name="link.icon" class="text-base flex-shrink-0" />
        <span>{{ link.label }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { $t, $getLocale, $switchLocale, $getLocales } = useI18n()

const { data, pending, refresh } = await useFetch("/api/admin/dashboard/stats", { lazy: false })

const stats = computed(() => (data.value as any)?.stats)
const revenueChart = computed(() => (data.value as any)?.revenueChart ?? [])
const statusDistribution = computed(() => (data.value as any)?.statusDistribution ?? [])

const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

function fmtAmount(v?: number) {
  if (v == null) return "0.00"
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNum(v?: number) {
  return (v ?? 0).toLocaleString()
}

const rateColorClass = computed(() => {
  const r = stats.value?.successRate24h ?? 0
  if (r >= 90) return "text-green-600 dark:text-green-400"
  if (r >= 70) return "text-amber-500"
  return "text-red-500 dark:text-red-400"
})

// Bar chart helpers
const maxRevenue = computed(() => Math.max(...revenueChart.value.map((d: any) => d.revenue), 1))
function barHeight(v: number) {
  return Math.max(4, Math.round((v / maxRevenue.value) * 80))
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

// Distribution helpers
const totalDist = computed(() => statusDistribution.value.reduce((s: number, r: any) => s + r.count, 0))
function distPct(count: number) {
  return totalDist.value ? Math.round((count / totalDist.value) * 100) : 0
}
const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: "#22c55e", AWAITING_CUSTOMER: "#f59e0b", CREATED: "#60a5fa",
  PROCESSING: "#a78bfa", PENDING_PROVIDER: "#fb923c", ROUTING: "#94a3b8",
  FAILED: "#ef4444", EXPIRED: "#6b7280", CANCELLED: "#6b7280",
}
function statusColor(s: string) { return STATUS_COLORS[s] ?? "#555" }

const quickLinks = [
  { to: "/admin/payments", icon: "i-heroicons-credit-card", label: "View all payments" },
  { to: "/admin/callbacks", icon: "i-heroicons-arrow-path", label: "Callbacks monitor" },
  { to: "/admin/webhooks", icon: "i-heroicons-arrow-top-right-on-square", label: "Webhook deliveries" },
  { to: "/admin/queues", icon: "i-heroicons-queue-list", label: "Queue health" },
]
</script>
