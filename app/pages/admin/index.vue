<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">

    <!-- Header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Global Dashboard</h1>
        <p class="mt-1 text-sm text-gray-500 dark:text-neutral-400">{{ today }}</p>
      </div>
      <UButton icon="i-heroicons-arrow-path" color="neutral" variant="outline" size="sm" :loading="pending" title="Refresh" @click="() => refresh()" />
    </div>

    <!-- ── Provider Health ── -->
    <UCard class="mb-5" :ui="{ body: 'p-3' }">
      <div class="flex items-center gap-3 flex-wrap mb-2.5">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Provider Health</p>
        <span class="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-600">
          <UIcon name="i-lucide-radio" class="w-3 h-3" /> ping = ยิง HTTP
        </span>
        <span class="flex items-center gap-1 text-xs text-gray-400 dark:text-neutral-600">
          <UIcon name="i-lucide-database" class="w-3 h-3" /> activity = ดูจาก DB log
        </span>
        <span class="ml-auto text-xs text-gray-400 dark:text-neutral-600">
          {{ healthPending ? 'กำลังตรวจสอบ…' : `อัปเดต ${healthAge}` }}
        </span>
      </div>
      <div v-if="healthPending" class="flex gap-2">
        <div v-for="n in 4" :key="n" class="h-10 flex-1 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
      </div>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="p in providerHealth" :key="p.code"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm flex-1 min-w-32 text-left transition-all hover:shadow-sm hover:scale-[1.01] cursor-pointer"
          :class="healthCardClass(p.status)"
          @click="openProviderModal(p)"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :class="healthDotClass(p.status)" />
          <div class="min-w-0 flex-1">
            <div class="font-medium truncate" :class="healthTextClass(p.status)">{{ p.displayName }}</div>
            <div class="text-xs truncate" :class="healthSubClass(p.status)">
              {{ p.method }} · {{ p.status }}
            </div>
          </div>
          <span v-if="p.latencyMs != null" class="text-xs flex-shrink-0 font-mono" :class="healthSubClass(p.status)">
            {{ p.latencyMs }}ms
          </span>
          <span v-else-if="p.minutesSince != null" class="text-xs flex-shrink-0" :class="healthSubClass(p.status)">
            {{ p.minutesSince }}m
          </span>
        </button>
      </div>
    </UCard>

    <!-- Provider edit modal -->
    <div v-if="providerModal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="providerModal.open = false">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <div>
            <h2 class="text-sm font-semibold text-gray-800 dark:text-neutral-200">{{ providerModal.displayName }}</h2>
            <p class="text-xs text-gray-400 dark:text-neutral-600 mt-0.5">{{ providerModal.code }} · {{ providerModal.type?.replace(/_/g, ' ') }}</p>
          </div>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="providerModal.open = false" />
        </div>
        <form class="px-5 py-4 flex flex-col gap-4" @submit.prevent="submitProviderModal">
          <!-- Health method -->
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">วิธีตรวจ Health</label>
            <USelect v-model="providerForm.healthMethod" :items="healthMethodOptions" value-key="value" label-key="label" :selected-icon="''" />
          </div>
          <!-- Ping fields -->
          <template v-if="providerForm.healthMethod === 'ping'">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Ping URL</label>
              <UInput v-model="providerForm.pingUrl" placeholder="https://api.provider.com/health" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Timeout (ms)</label>
                <UInput v-model="providerForm.pingTimeoutMs" type="number" placeholder="5000" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Expected Status</label>
                <UInput v-model="providerForm.pingExpectStatus" type="number" placeholder="200" />
              </div>
            </div>
          </template>
          <!-- Activity fields -->
          <template v-if="providerForm.healthMethod === 'activity'">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Activity Source</label>
              <USelect v-model="providerForm.activitySource" :items="activitySourceOptions" value-key="value" label-key="label" :selected-icon="''" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Warn (นาที)</label>
                <UInput v-model="providerForm.activityWarnMinutes" type="number" placeholder="30" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Stale (นาที)</label>
                <UInput v-model="providerForm.activityStaleMinutes" type="number" placeholder="60" />
              </div>
            </div>
          </template>
          <div v-if="providerModalError" class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{{ providerModalError }}</div>
          <div class="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-neutral-800">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="providerModal.open = false" />
            <UButton type="submit" :label="providerModalSaving ? 'Saving…' : 'Save'" color="warning" variant="soft" :disabled="providerModalSaving" />
          </div>
        </form>
      </UCard>
    </div>

    <!-- 🔴 Alert bar — Stuck transactions -->
    <div v-if="stats?.stuckTransactions > 0"
      class="flex items-center gap-3 mb-5 px-4 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg">
      <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-red-500 flex-shrink-0" />
      <span class="text-sm font-medium text-red-700 dark:text-red-400">
        {{ stats.stuckTransactions }} transaction{{ stats.stuckTransactions > 1 ? 's' : '' }} stuck &gt; 15 min
      </span>
      <NuxtLink to="/admin/payments?filter=stuck" class="ml-auto text-sm text-red-600 dark:text-red-400 underline underline-offset-2 hover:text-red-800 dark:hover:text-red-300">
        ดู →
      </NuxtLink>
    </div>
    <div v-if="stats?.deadWebhooks > 0"
      class="flex items-center gap-3 mb-5 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
      <UIcon name="i-lucide-webhook" class="w-5 h-5 text-amber-500 flex-shrink-0" />
      <span class="text-sm font-medium text-amber-700 dark:text-amber-400">
        {{ stats.deadWebhooks }} dead webhook{{ stats.deadWebhooks > 1 ? 's' : '' }} — ต้องตรวจสอบ
      </span>
      <NuxtLink to="/admin/webhooks" class="ml-auto text-sm text-amber-600 dark:text-amber-400 underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300">
        ดู →
      </NuxtLink>
    </div>

    <!-- ── Stat cards row 1 ── -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
      <!-- Revenue 24h -->
      <UCard class="col-span-2 sm:col-span-1 lg:col-span-2" :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">Volume (24h)</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">฿{{ fmtAmount(stats?.revenue24hTHB) }}</p>
        <div class="flex items-center gap-1.5 mt-1">
          <span class="text-xs" :class="deltaClass(stats?.revenueDeltaPct)">
            {{ deltaTxt(stats?.revenueDeltaPct) }}
          </span>
          <span class="text-xs text-gray-400 dark:text-neutral-600">vs ช่วงก่อน</span>
        </div>
      </UCard>

      <!-- Payments 24h -->
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">Payments (24h)</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmtNum(stats?.payments24h) }}</p>
        <div class="flex items-center gap-1.5 mt-1">
          <span class="text-xs" :class="deltaClass(stats?.countDeltaPct)">{{ deltaTxt(stats?.countDeltaPct) }}</span>
          <span class="text-xs text-gray-400 dark:text-neutral-600">vs ช่วงก่อน</span>
        </div>
      </UCard>

      <!-- Success rate -->
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">Success rate</p>
        <p class="text-2xl font-bold" :class="rateColorClass">{{ stats?.successRate24h ?? 0 }}%</p>
        <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">
          prev {{ stats?.successRatePrev != null ? stats.successRatePrev + '%' : '—' }}
        </p>
      </UCard>

      <!-- Active Tenants -->
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">Active Tenants</p>
        <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ fmtNum(stats?.activeTenants) }}</p>
        <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">{{ fmtNum(stats?.activeMerchants) }} merchants</p>
      </UCard>

      <!-- Pending callbacks -->
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-1">Pending callbacks</p>
        <p class="text-2xl font-bold" :class="stats?.pendingCallbacks ? 'text-amber-500' : 'text-gray-900 dark:text-white'">
          {{ fmtNum(stats?.pendingCallbacks) }}
        </p>
        <p class="text-xs mt-1 text-gray-400 dark:text-neutral-600">{{ stats?.activeApiKeys ?? 0 }} active keys</p>
      </UCard>
    </div>

    <!-- ── Charts row ── -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

      <!-- Revenue bar chart (7d) -->
      <UCard class="md:col-span-2" :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-4">Revenue — 7 วันล่าสุด (THB)</p>
        <div class="flex items-end gap-1.5 h-24">
          <template v-for="(d, i) in revenueChart" :key="i">
            <div class="flex-1 flex flex-col items-center gap-1">
              <div
                class="w-full rounded-t bg-amber-500/25 border border-amber-500/40 hover:bg-amber-500/40 transition-colors min-h-1"
                :style="{ height: barHeight(d.revenue) + 'px' }"
                :title="`฿${fmtAmount(d.revenue)} · ${d.count} txns`"
              />
              <span class="text-[10px] text-gray-500 dark:text-neutral-500 whitespace-nowrap">{{ shortDate(d.date) }}</span>
            </div>
          </template>
        </div>
      </UCard>

      <!-- Status distribution -->
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-4">Status (24h)</p>
        <div class="flex flex-col gap-2">
          <div v-for="row in statusDistribution" :key="row.status" class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ background: statusColor(row.status) }" />
            <span class="text-xs text-gray-700 dark:text-neutral-300 w-32 flex-shrink-0 truncate">{{ row.status }}</span>
            <div class="flex-1 h-1.5 bg-gray-100 dark:bg-neutral-800 rounded overflow-hidden">
              <span class="block h-full rounded" :style="{ width: distPct(row.count) + '%', background: statusColor(row.status) }" />
            </div>
            <span class="text-xs text-gray-500 dark:text-neutral-400 w-6 text-right flex-shrink-0">{{ row.count }}</span>
          </div>
          <p v-if="!statusDistribution?.length" class="text-sm text-gray-500 dark:text-neutral-400 text-center py-4">ไม่มีข้อมูล</p>
        </div>
      </UCard>
    </div>

    <!-- ── Method breakdown + Top Tenants ── -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">

      <!-- Method breakdown -->
      <UCard :ui="{ body: 'p-4' }">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400 mb-4">Payment Method (24h)</p>
        <div v-if="methodBreakdown?.length" class="flex flex-col gap-2.5">
          <div v-for="row in methodBreakdown" :key="row.method" class="flex flex-col gap-1">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-700 dark:text-neutral-300 truncate">{{ row.method.replace(/_/g, ' ') }}</span>
              <span class="text-xs text-gray-500 dark:text-neutral-400 ml-2 flex-shrink-0">{{ row.count }}</span>
            </div>
            <div class="h-1.5 bg-gray-100 dark:bg-neutral-800 rounded overflow-hidden">
              <span class="block h-full rounded bg-amber-500/60" :style="{ width: methodPct(row.count) + '%' }" />
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-gray-500 dark:text-neutral-400 text-center py-4">ไม่มีข้อมูล</p>
      </UCard>

      <!-- Top Tenants -->
      <UCard class="md:col-span-2" :ui="{ body: 'p-0' }">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Top Tenants by Volume (24h)</p>
        </div>
        <div v-if="topTenants?.length" class="divide-y divide-gray-100 dark:divide-neutral-800">
          <div v-for="(t, i) in topTenants" :key="t.tenantId"
            class="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
            <span class="w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
              {{ i + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">{{ t.name }}</div>
              <div class="text-xs text-gray-400 dark:text-neutral-600 font-sans">{{ t.code }}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="text-sm font-medium text-gray-800 dark:text-neutral-200">฿{{ fmtAmount(t.amount) }}</div>
              <div class="text-xs text-gray-400 dark:text-neutral-500">{{ t.count }} txns · <span :class="rateColor(t.successRate)">{{ t.successRate }}%</span></div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-8 text-sm text-gray-500 dark:text-neutral-400">ไม่มีข้อมูล</div>
      </UCard>
    </div>

    <!-- ── Quick links ── -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <NuxtLink
        v-for="link in quickLinks" :key="link.to" :to="link.to"
        class="flex items-center gap-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl px-4 py-3.5 text-sm text-gray-700 dark:text-neutral-200 hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
      >
        <UIcon :name="link.icon" class="text-base flex-shrink-0 text-gray-500 dark:text-neutral-400" />
        <span>{{ link.label }}</span>
      </NuxtLink>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { data, pending, refresh } = await useFetch("/api/admin/dashboard/stats", { lazy: false })

// ── Provider Health (separate fetch, can be slower) ─────────────
const { data: healthData, pending: healthPending, refresh: refreshHealth } =
  await useFetch("/api/admin/dashboard/provider-health", { lazy: true })

const providerHealth = computed(() => (healthData.value as any)?.providers ?? [])
const healthGeneratedAt = computed(() => (healthData.value as any)?.generatedAt ?? null)
const healthAge = computed(() => {
  if (!healthGeneratedAt.value) return '—'
  const sec = Math.round((Date.now() - new Date(healthGeneratedAt.value).getTime()) / 1000)
  if (sec < 60) return `${sec}s ที่แล้ว`
  return `${Math.round(sec / 60)}m ที่แล้ว`
})

const stats             = computed(() => (data.value as any)?.stats)
const revenueChart      = computed(() => (data.value as any)?.revenueChart ?? [])
const statusDistribution = computed(() => (data.value as any)?.statusDistribution ?? [])
const methodBreakdown   = computed(() => (data.value as any)?.methodBreakdown ?? [])
const topTenants        = computed(() => (data.value as any)?.topTenants ?? [])

const today = new Date().toLocaleDateString("th-TH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

// ── Formatters ──────────────────────────────────────────────────
function fmtAmount(v?: number) {
  if (v == null) return "0.00"
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNum(v?: number) { return (v ?? 0).toLocaleString() }

// ── Delta helpers ───────────────────────────────────────────────
function deltaClass(pct?: number | null) {
  if (pct == null) return "text-gray-400 dark:text-neutral-600"
  if (pct > 0)  return "text-green-600 dark:text-green-400"
  if (pct < 0)  return "text-red-500 dark:text-red-400"
  return "text-gray-500 dark:text-neutral-400"
}
function deltaTxt(pct?: number | null) {
  if (pct == null) return "—"
  if (pct > 0)  return `▲ ${pct}%`
  if (pct < 0)  return `▼ ${Math.abs(pct)}%`
  return `= 0%`
}

// ── Success rate color ──────────────────────────────────────────
const rateColorClass = computed(() => rateColor(stats.value?.successRate24h ?? 0))
function rateColor(r: number) {
  if (r >= 90) return "text-green-600 dark:text-green-400"
  if (r >= 70) return "text-amber-500"
  return "text-red-500 dark:text-red-400"
}

// ── Bar chart ───────────────────────────────────────────────────
const maxRevenue = computed(() => Math.max(...revenueChart.value.map((d: any) => d.revenue), 1))
function barHeight(v: number) { return Math.max(4, Math.round((v / maxRevenue.value) * 80)) }
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

// ── Status distribution ─────────────────────────────────────────
const totalDist = computed(() => statusDistribution.value.reduce((s: number, r: any) => s + r.count, 0))
function distPct(count: number) { return totalDist.value ? Math.round((count / totalDist.value) * 100) : 0 }
const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: "#22c55e", AWAITING_CUSTOMER: "#f59e0b", CREATED: "#60a5fa",
  PROCESSING: "#a78bfa", PENDING_PROVIDER: "#fb923c", ROUTING: "#94a3b8",
  FAILED: "#ef4444", EXPIRED: "#6b7280", CANCELLED: "#6b7280",
}
function statusColor(s: string) { return STATUS_COLORS[s] ?? "#555" }

// ── Method breakdown ────────────────────────────────────────────
const totalMethod = computed(() => methodBreakdown.value.reduce((s: number, r: any) => s + r.count, 0))
function methodPct(count: number) { return totalMethod.value ? Math.round((count / totalMethod.value) * 100) : 0 }

// ── Provider modal ──────────────────────────────────────────────
const providerModal = reactive({
  open: false, code: '', displayName: '', type: '',
})
const providerForm = reactive({
  healthMethod: 'disabled',
  pingUrl: '', pingTimeoutMs: 5000, pingExpectStatus: 200,
  activitySource: 'both', activityWarnMinutes: 30, activityStaleMinutes: 60,
})
const providerModalSaving = ref(false)
const providerModalError  = ref('')

const healthMethodOptions = [
  { label: 'ping — ยิง HTTP จริง',      value: 'ping' },
  { label: 'activity — ดูจาก DB log',   value: 'activity' },
  { label: 'disabled — ไม่ตรวจสอบ',    value: 'disabled' },
]
const activitySourceOptions = [
  { label: 'attempt — เราเรียก provider',      value: 'attempt' },
  { label: 'callback — provider เรียกเรา',    value: 'callback' },
  { label: 'both — ทั้งสอง',                  value: 'both' },
]

function openProviderModal(p: any) {
  providerModal.code        = p.code
  providerModal.displayName = p.displayName
  providerModal.type        = p.type ?? ''
  const c = p.config ?? {}
  Object.assign(providerForm, {
    healthMethod:         p.method              ?? 'disabled',
    pingUrl:              c.pingUrl             ?? '',
    pingTimeoutMs:        c.pingTimeoutMs        ?? 5000,
    pingExpectStatus:     c.pingExpectStatus     ?? 200,
    activitySource:       c.activitySource       ?? 'both',
    activityWarnMinutes:  c.activityWarnMinutes  ?? 30,
    activityStaleMinutes: c.activityStaleMinutes ?? 60,
  })
  providerModalError.value = ''
  providerModal.open = true
}

async function submitProviderModal() {
  providerModalError.value = ''; providerModalSaving.value = true
  try {
    await $fetch(`/api/admin/providers/${providerModal.code}`, {
      method: 'PATCH',
      body: {
        healthMethod:         providerForm.healthMethod,
        pingUrl:              providerForm.pingUrl || null,
        pingTimeoutMs:        Number(providerForm.pingTimeoutMs),
        pingExpectStatus:     Number(providerForm.pingExpectStatus),
        activitySource:       providerForm.activitySource,
        activityWarnMinutes:  Number(providerForm.activityWarnMinutes),
        activityStaleMinutes: Number(providerForm.activityStaleMinutes),
      },
    })
    providerModal.open = false
    await refreshHealth()
  } catch (e: any) {
    providerModalError.value = e?.data?.message ?? e?.message ?? 'เกิดข้อผิดพลาด'
  } finally { providerModalSaving.value = false }
}

// ── Provider Health helpers ─────────────────────────────────────
function healthCardClass(status: string) {
  switch (status) {
    case 'UP':       return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
    case 'WARN':     return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
    case 'STALE':    return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
    case 'DOWN':     return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
    case 'DISABLED': return 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 opacity-50'
    default:         return 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800'
  }
}
function healthDotClass(status: string) {
  switch (status) {
    case 'UP':       return 'bg-green-500'
    case 'WARN':
    case 'STALE':    return 'bg-amber-400'
    case 'DOWN':     return 'bg-red-500'
    default:         return 'bg-gray-400 dark:bg-neutral-500'
  }
}
function healthTextClass(status: string) {
  switch (status) {
    case 'UP':       return 'text-green-800 dark:text-green-300'
    case 'WARN':
    case 'STALE':    return 'text-amber-800 dark:text-amber-300'
    case 'DOWN':     return 'text-red-700 dark:text-red-400'
    default:         return 'text-gray-600 dark:text-neutral-400'
  }
}
function healthSubClass(status: string) {
  switch (status) {
    case 'UP':       return 'text-green-600 dark:text-green-500'
    case 'WARN':
    case 'STALE':    return 'text-amber-600 dark:text-amber-500'
    case 'DOWN':     return 'text-red-500 dark:text-red-400'
    default:         return 'text-gray-400 dark:text-neutral-600'
  }
}

// ── Quick links ─────────────────────────────────────────────────
const quickLinks = [
  { to: "/admin/tenants",   icon: "i-lucide-building",         label: "Tenants" },
  { to: "/admin/payments",  icon: "i-lucide-credit-card",      label: "Payments" },
  { to: "/admin/callbacks", icon: "i-heroicons-arrow-path",    label: "Callbacks" },
  { to: "/admin/webhooks",  icon: "i-lucide-webhook",          label: "Webhooks" },
]
</script>
