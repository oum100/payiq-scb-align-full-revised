<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">
    <!-- Breadcrumb + back -->
    <div class="flex items-center gap-2 mb-6">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" to="/admin/tenants" />
      <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-neutral-400">
        <NuxtLink to="/admin/tenants" class="hover:text-amber-500 transition-colors">Tenants</NuxtLink>
        <span>/</span>
        <span class="text-gray-800 dark:text-neutral-200 font-medium">{{ tenant?.name ?? '…' }}</span>
      </div>
    </div>

    <div v-if="pending" class="text-center py-24 text-sm text-gray-600 dark:text-neutral-400">Loading…</div>
    <template v-else-if="tenant">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-2xl font-semibold tracking-tight text-gray-800 dark:text-neutral-200">{{ tenant.name }}</h1>
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" title="Edit name" @click="openEdit" />
            <!-- Status button group -->
            <div class="flex rounded-md overflow-hidden border border-gray-200 dark:border-neutral-700 text-xs">
              <button
                class="px-3 py-1 transition-colors"
                :class="tenant.status === 'ACTIVE'
                  ? 'bg-green-500 text-white font-semibold'
                  : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'"
                :disabled="toggling || tenant.status === 'ACTIVE'"
                @click="setStatus('ACTIVE')"
              >Active</button>
              <button
                class="px-3 py-1 transition-colors border-l border-gray-200 dark:border-neutral-700"
                :class="tenant.status !== 'ACTIVE'
                  ? 'bg-red-500 text-white font-semibold'
                  : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'"
                :disabled="toggling || tenant.status !== 'ACTIVE'"
                @click="setStatus('SUSPENDED')"
              >Disabled</button>
            </div>
          </div>
          <div class="font-mono text-sm text-gray-500 dark:text-neutral-500 mt-1">{{ tenant.code }}</div>
        </div>
      </div>

      <!-- Stat cards — two groups -->
      <div class="flex flex-col gap-4 mb-8">
        <!-- Commerce group: merchant-owned data -->
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-semibold uppercase tracking-widest text-amber-500">Commerce</span>
            <div class="flex-1 h-px bg-amber-500/20" />
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NuxtLink v-for="card in commerceCards" :key="card.to" :to="card.to">
              <UCard :ui="{ body: 'p-4' }"
                class="text-center cursor-pointer hover:ring-1 hover:ring-amber-500/50 hover:bg-white dark:hover:bg-neutral-800/60 transition-all h-full">
                <UIcon :name="card.icon" class="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <div class="text-2xl font-bold text-gray-800 dark:text-neutral-200">{{ card.value }}</div>
                <div class="text-xs uppercase tracking-wide text-gray-600 dark:text-neutral-400 mt-0.5">{{ card.label }}</div>
              </UCard>
            </NuxtLink>
            <UCard :ui="{ body: 'p-4' }" class="text-center">
              <UIcon name="i-lucide-banknote" class="w-5 h-5 mx-auto mb-1 text-amber-500" />
              <div class="text-2xl font-bold text-gray-800 dark:text-neutral-200">{{ tenant._count?.paymentIntents ?? 0 }}</div>
              <div class="text-xs uppercase tracking-wide text-gray-600 dark:text-neutral-400 mt-0.5">Payments</div>
            </UCard>
          </div>
        </div>

        <!-- Tenant Config group: tenant-level settings -->
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-semibold uppercase tracking-widest text-gray-600 dark:text-neutral-400">Tenant Config</span>
            <div class="flex-1 h-px bg-gray-300 dark:bg-neutral-700" />
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NuxtLink v-for="card in configCards" :key="card.to" :to="card.to">
              <UCard :ui="{ body: 'p-4' }"
                class="text-center cursor-pointer hover:ring-1 hover:ring-gray-400/50 dark:hover:ring-neutral-500/50 hover:bg-white dark:hover:bg-neutral-800/60 transition-all h-full">
                <UIcon :name="card.icon" class="w-5 h-5 mx-auto mb-1 text-gray-600 dark:text-neutral-400" />
                <div class="text-2xl font-bold text-gray-800 dark:text-neutral-200">{{ card.value }}</div>
                <div class="text-xs uppercase tracking-wide text-gray-600 dark:text-neutral-400 mt-0.5">{{ card.label }}</div>
              </UCard>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Payment Volume chart -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between flex-wrap gap-2">
            <span class="text-sm font-semibold text-gray-800 dark:text-neutral-200">Payment Volume</span>
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Chart mode toggle -->
              <div class="flex rounded-md overflow-hidden border border-gray-200 dark:border-neutral-700 text-xs">
                <button
                  v-for="opt in chartModeOptions" :key="opt.value"
                  class="px-3 py-1 transition-colors border-l first:border-l-0 border-gray-200 dark:border-neutral-700"
                  :class="chartMode === opt.value
                    ? 'bg-amber-500 text-white font-semibold'
                    : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'"
                  @click="chartMode = opt.value"
                >{{ opt.label }}</button>
              </div>
              <!-- Period toggle -->
              <div class="flex rounded-md overflow-hidden border border-gray-200 dark:border-neutral-700 text-xs">
                <button
                  v-for="opt in periodOptions" :key="opt.value"
                  class="px-3 py-1 transition-colors border-l first:border-l-0 border-gray-200 dark:border-neutral-700"
                  :class="period === opt.value
                    ? 'bg-amber-500 text-white font-semibold'
                    : 'bg-white dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200'"
                  @click="period = opt.value"
                >{{ opt.label }}</button>
              </div>
            </div>
          </div>
          <!-- Merchant filter — visual highlight only, doesn't filter chart -->
          <div v-if="stats?.merchants?.length >= 1" class="flex flex-wrap gap-1.5 mt-3">
            <button
              class="px-2 py-0.5 rounded-full text-xs border transition-colors"
              :class="highlightedMerchants.length === 0
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:border-amber-500 hover:text-amber-400'"
              @click="highlightedMerchants = []"
            >All</button>
            <button
              v-for="m in stats.merchants" :key="m.id"
              class="px-2 py-0.5 rounded-full text-xs border transition-colors"
              :class="highlightedMerchants.includes(m.id)
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-gray-300 dark:border-neutral-600 text-gray-600 dark:text-neutral-400 hover:border-amber-500 hover:text-amber-400'"
              @click="toggleHighlight(m.id)"
            >{{ m.name }}</button>
          </div>
        </template>

        <div v-if="statsPending" class="h-52 flex items-center justify-center text-sm text-gray-600 dark:text-neutral-400">Loading…</div>
        <div v-else-if="!chartData" class="h-52 flex items-center justify-center text-sm text-gray-600 dark:text-neutral-400">No payment data yet</div>
        <ClientOnly v-else>
          <Bar :data="chartData" :options="chartOptions" class="max-h-64" />
        </ClientOnly>
      </UCard>
    </template>

    <!-- Edit Modal -->
    <div v-if="editModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="editModal = false">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-200">Edit Tenant Name</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="editModal = false" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitEdit">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Name</label>
            <UInput v-model="form.name" required />
          </div>
          <div v-if="formError" class="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">{{ formError }}</div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="editModal = false" />
            <UButton type="submit" :label="submitting ? 'Saving…' : 'Save'" color="warning" variant="soft" :disabled="submitting" />
          </div>
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChartData, ChartOptions } from 'chart.js'
import { defineAsyncComponent } from 'vue'

const Bar = defineAsyncComponent(() =>
  import('vue-chartjs').then(async (m) => {
    const { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } = await import('chart.js')
    Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)
    return m.Bar
  })
)

definePageMeta({ layout: 'admin', middleware: 'admin-auth' })

const route = useRoute()
const tenantId = route.params.id as string
const colorMode = useColorMode()

const { data, pending, refresh } = await useFetch(`/api/admin/tenants/${tenantId}`)
const tenant = computed(() => data.value as any)

// Commerce = merchant-owned data (shown as tenant-wide aggregates)
const commerceCards = computed(() => [
  { to: `/admin/tenants/${tenantId}/merchants`, icon: 'i-lucide-store', label: 'Merchants', value: tenant.value?._count?.merchants ?? 0 },
  { to: `/admin/tenants/${tenantId}/api-keys`, icon: 'i-lucide-key', label: 'API Keys', value: tenant.value?._count?.apiKeys ?? 0 },
])

// Tenant Config = tenant-level settings (users, billers, routes belong to the tenant itself)
const configCards = computed(() => [
  { to: `/admin/tenants/${tenantId}/users`, icon: 'i-lucide-users', label: 'Users', value: tenant.value?._count?.tenantUsers ?? 0 },
  { to: `/admin/tenants/${tenantId}/payment-setup`, icon: 'i-lucide-building-2', label: 'Billers', value: tenant.value?._count?.billerProfiles ?? 0 },
  { to: `/admin/tenants/${tenantId}/payment-setup`, icon: 'i-lucide-route', label: 'Routes', value: tenant.value?._count?.paymentRoutes ?? 0 },
])

// Chart controls
const period = ref<'hour24' | 'week' | 'day30' | 'month12'>('day30')
const chartMode = ref<'merchant' | 'method'>('merchant')
const highlightedMerchants = ref<string[]>([]) // visual only, no API filter

const periodOptions = [
  { label: '24h', value: 'hour24' },
  { label: 'Week', value: 'week' },
  { label: '30 Days', value: 'day30' },
  { label: '12 Months', value: 'month12' },
]
const chartModeOptions = [
  { label: 'By Merchant', value: 'merchant' },
  { label: 'By Method', value: 'method' },
]

const statsUrl = computed(() => `/api/admin/tenants/${tenantId}/payment-stats?period=${period.value}`)
const { data: statsData, pending: statsPending } = await useFetch(() => statsUrl.value)
const stats = computed(() => statsData.value as any)

function toggleHighlight(id: string) {
  const idx = highlightedMerchants.value.indexOf(id)
  if (idx >= 0) highlightedMerchants.value.splice(idx, 1)
  else highlightedMerchants.value.push(id)
}

const MERCHANT_COLORS = [
  'rgba(251,191,36,0.9)',
  'rgba(59,130,246,0.9)',
  'rgba(34,197,94,0.9)',
  'rgba(239,68,68,0.9)',
  'rgba(168,85,247,0.9)',
  'rgba(20,184,166,0.9)',
  'rgba(249,115,22,0.9)',
  'rgba(236,72,153,0.9)',
]
const METHOD_COLORS = [
  'rgba(251,191,36,0.9)',
  'rgba(59,130,246,0.9)',
  'rgba(34,197,94,0.9)',
  'rgba(239,68,68,0.9)',
  'rgba(168,85,247,0.9)',
  'rgba(20,184,166,0.9)',
]
const DIM_COLOR = 'rgba(100,100,100,0.25)'

const isDark = computed(() => colorMode.value === 'dark')

const chartData = computed<ChartData<'bar'> | null>(() => {
  const labels = stats.value?.labels
  if (!labels?.length) return null

  const hasHL = highlightedMerchants.value.length > 0

  if (chartMode.value === 'merchant') {
    const series: any[] = stats.value?.byMerchant?.length
      ? stats.value.byMerchant
      : (stats.value?.byMethodSeries ?? [])
    if (!series.length) return null
    const isMerchantMode = !!stats.value?.byMerchant?.length
    return {
      labels,
      datasets: series.map((s: any, i: number) => {
        const baseColor = MERCHANT_COLORS[i % MERCHANT_COLORS.length]
        const dimmed = hasHL && isMerchantMode && !highlightedMerchants.value.includes(s.merchantId)
        return {
          label: isMerchantMode ? s.merchantName : s.method,
          data: s.data,
          backgroundColor: dimmed ? DIM_COLOR : baseColor,
          borderRadius: 3,
          stack: 'total',
        }
      }),
    }
  }

  const series: any[] = stats.value?.byMethodSeries ?? []
  if (!series.length) return null
  return {
    labels,
    datasets: series.map((s: any, i: number) => ({
      label: s.method,
      data: s.data,
      backgroundColor: METHOD_COLORS[i % METHOD_COLORS.length],
      borderRadius: 3,
      stack: 'total',
    })),
  }
})

const TICK_COLOR = '#d4d4d4'  // neutral-300 — always bright

const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: { color: TICK_COLOR, font: { size: 11 }, boxWidth: 12 },
    },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: {
      stacked: true,
      ticks: { color: TICK_COLOR, font: { size: 10 }, maxRotation: 45 },
      grid: { color: 'transparent' },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: { color: TICK_COLOR, font: { size: 10 }, precision: 0 },
      grid: { color: isDark.value ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)' },
    },
  },
}))

// Edit name
const editModal = ref(false)
const form = reactive({ name: '' })
const submitting = ref(false)
const formError = ref('')

function openEdit() {
  form.name = tenant.value?.name ?? ''
  formError.value = ''
  editModal.value = true
}

async function submitEdit() {
  formError.value = ''; submitting.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}`, { method: 'PATCH', body: { name: form.name } })
    await refresh(); editModal.value = false
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}

// Toggle status
const toggling = ref(false)
async function setStatus(status: string) {
  toggling.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}`, { method: 'PATCH', body: { status } })
    await refresh()
  } finally { toggling.value = false }
}
</script>
