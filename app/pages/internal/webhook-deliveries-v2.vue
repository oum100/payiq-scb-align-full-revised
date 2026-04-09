<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
definePageMeta({ layout: 'default' })
const { $t } = useI18n()

useHead({ title: () => `${$t('nav.webhookDeliveries')} — ${$t('nav.title')}` })

// ── Types ──────────────────────────────────────────────────────────────────
type DeliveryRow = {
  id: string
  eventType: string
  status: string
  attemptNumber: number
  nextAttemptAt: string | null
  deliveredAt: string | null
  lastErrorAt: string | null
  targetUrlSnapshot: string | null
  responseStatusCode: number | null
  responseHeaders?: Record<string, string> | null
  responseBody?: string | null
  requestHeaders?: Record<string, string> | null
  requestBody?: unknown
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  paymentIntent?: {
    publicId: string
    merchantReference: string | null
    merchantOrderId?: string | null
    status: string
    providerReference?: string | null
    providerTransactionId?: string | null
  } | null
  webhookEndpoint?: {
    code: string
    url: string
    maxAttempts: number
    timeoutMs: number
  } | null
}

type ListResponse = {
  items: DeliveryRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

type SummaryResponse = {
  generatedAt: string
  summary: {
    total: number
    delivered: number
    retrying: number
    dead: number
    processing: number
    pending: number
    last24h: number
    last24hDelivered: number
    last24hDead: number
  }
}

// ── Filters ────────────────────────────────────────────────────────────────
const filters = reactive({
  page: 1,
  pageSize: 20,
  status: 'ALL',
  eventType: 'ALL',
  merchantReference: '',
  publicId: '',
})

const statusOptions = computed(() => [
  { label: $t('filters.allStatuses') as string, value: 'ALL' },
  { label: 'PENDING', value: 'PENDING' },
  { label: 'PROCESSING', value: 'PROCESSING' },
  { label: 'RETRYING', value: 'RETRYING' },
  { label: 'DELIVERED', value: 'DELIVERED' },
  { label: 'DEAD', value: 'DEAD' },
])

const eventTypeOptions = computed(() => [
  { label: $t('filters.allStatuses') as string, value: 'ALL' },
  { label: 'PAYMENT_SUCCEEDED', value: 'PAYMENT_SUCCEEDED' },
  { label: 'PAYMENT_FAILED', value: 'PAYMENT_FAILED' },
  { label: 'PAYMENT_EXPIRED', value: 'PAYMENT_EXPIRED' },
  { label: 'PAYMENT_CANCELLED', value: 'PAYMENT_CANCELLED' },
  { label: 'PAYMENT_REVERSED', value: 'PAYMENT_REVERSED' },
  { label: 'PAYMENT_REFUNDED', value: 'PAYMENT_REFUNDED' },
])

const pageSizeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

const queryParams = computed(() => ({
  page: filters.page,
  pageSize: filters.pageSize,
  // 'ALL' = ไม่ส่ง status filter ไป API
  ...(filters.status && filters.status !== 'ALL' ? { status: filters.status } : {}),
  ...(filters.eventType && filters.eventType !== 'ALL' ? { eventType: filters.eventType } : {}),
  ...(filters.merchantReference ? { merchantReference: filters.merchantReference } : {}),
  ...(filters.publicId ? { publicId: filters.publicId } : {}),
}))

// ── Data fetching (ไม่ใช้ await เพื่อไม่ให้ component suspend และค้าง) ────────
const {
  data: listData,
  pending: listPending,
  refresh: refreshList,
} = useFetch<ListResponse>('/api/internal/webhook-deliveries', {
  query: queryParams,
  watch: [queryParams],
})

const {
  data: summaryData,
  pending: summaryPending,
  refresh: refreshSummary,
} = useFetch<SummaryResponse>('/api/internal/webhook-deliveries/summary')

const rows = computed(() => listData.value?.items ?? [])
const pagination = computed(() =>
  listData.value?.pagination ?? { page: 1, pageSize: 20, total: 0, totalPages: 1 }
)

// ── Table columns (NuxtUI v4 / TanStack Table format) ─────────────────────
const columns = computed(() => [
  { id: 'status', accessorKey: 'status', header: $t('table.status') as string },
  { id: 'eventType', accessorKey: 'eventType', header: $t('table.event') as string },
  { id: 'merchantRef', header: $t('table.merchantRef') as string },
  { id: 'attemptNumber', accessorKey: 'attemptNumber', header: $t('table.attempt') as string },
  { id: 'response', header: $t('table.response') as string },
  { id: 'createdAt', accessorKey: 'createdAt', header: $t('table.createdAt') as string },
  { id: 'target', header: $t('table.target') as string },
  { id: 'actions', header: '' },
])

// ── Detail slideover ───────────────────────────────────────────────────────
const isOpen = ref(false)
const selected = ref<DeliveryRow | null>(null)

function openDetail(rowData: DeliveryRow | TableRow<DeliveryRow>) {
  // ใช้ row.index (TanStack) เพื่อ lookup จาก rows array โดยตรง — ไม่ขึ้นกับ row.original
  const idx = (rowData as any)?.index
  const data = (typeof idx === 'number') ? rows.value[idx] : ((rowData as any)?.original ?? rowData)
  if (data) {
    selected.value = data as DeliveryRow
    isOpen.value = true
  }
}

function onSelect(e: Event, rowData: TableRow<DeliveryRow>) {
  // console.log('Row selected:', rowData)
  openDetail(rowData)
}

// ── Status badge ───────────────────────────────────────────────────────────
type BadgeColor = 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'neutral'

function statusColor(status: string): BadgeColor {
  switch (status) {
    case 'DELIVERED': return 'success'
    case 'RETRYING': return 'warning'
    case 'DEAD': return 'error'
    case 'PROCESSING': return 'info'
    case 'PENDING': return 'secondary'
    default: return 'neutral'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString()
}

function prettyJson(value: unknown): string {
  if (value == null) return '—'
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

// ── Redrive ────────────────────────────────────────────────────────────────
const redrivePending = ref(false)
const toast = useToast()

function canRedrive(item: DeliveryRow | null): boolean {
  return !!item && (item.status === 'DEAD' || item.status === 'RETRYING')
}

async function retrySelected() {
  if (!selected.value || !canRedrive(selected.value) || redrivePending.value) return
  redrivePending.value = true
  try {
    const result = await $fetch<{ ok: boolean; id: string; previousStatus: string }>(
      `/api/internal/webhook-deliveries/${selected.value.id}/redrive`,
      { method: 'POST' }
    )
    toast.add({
      title: $t('actions.redriveSuccess', { id: result.id, status: result.previousStatus }) as string,
      color: 'success',
    })
    await refreshAll()
    const updated = rows.value.find((r) => r.id === selected.value?.id)
    if (updated) selected.value = updated
  } catch (e) {
    toast.add({
      title: $t('actions.redriveFailed') as string,
      description: e instanceof Error ? e.message : String(e),
      color: 'error',
    })
  } finally {
    redrivePending.value = false
  }
}

// ── Actions ────────────────────────────────────────────────────────────────
async function refreshAll() {
  await Promise.all([refreshList(), refreshSummary()])
}

function applyFilters() {
  filters.page = 1
  selected.value = null
}

function resetFilters() {
  filters.page = 1
  filters.pageSize = 20
  filters.status = 'ALL'
  filters.eventType = 'ALL'
  filters.merchantReference = ''
  filters.publicId = ''
  selected.value = null
}

function nextPage() {
  if (filters.page < pagination.value.totalPages) {
    filters.page += 1
    selected.value = null
  }
}

function prevPage() {
  if (filters.page > 1) {
    filters.page -= 1
    selected.value = null
  }
}

// ── Summary cards ──────────────────────────────────────────────────────────
const summaryCards = computed(() => {
  const s = summaryData.value?.summary
  return [
    { key: 'total', label: $t('summary.total'), value: s?.total ?? 0, color: 'text-gray-700 dark:text-gray-200' },
    { key: 'delivered', label: $t('summary.delivered'), value: s?.delivered ?? 0, color: 'text-green-600 dark:text-green-400' },
    { key: 'retrying', label: $t('summary.retrying'), value: s?.retrying ?? 0, color: 'text-amber-600 dark:text-amber-400' },
    { key: 'dead', label: $t('summary.dead'), value: s?.dead ?? 0, color: 'text-red-600 dark:text-red-400' },
    { key: 'last24h', label: $t('summary.last24h'), value: s?.last24h ?? 0, color: 'text-gray-700 dark:text-gray-200' },
    { key: 'last24hDead', label: $t('summary.last24hDead'), value: s?.last24hDead ?? 0, color: 'text-red-600 dark:text-red-400' },
  ]
})
</script>

<template>
  <div class="space-y-5">

    <!-- Page header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ $t('nav.webhookDeliveries') }}
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Inspect, filter and redrive webhook deliveries
        </p>
      </div>
      <UButton icon="i-heroicons-arrow-path" :loading="listPending || summaryPending" color="neutral" variant="outline"
        @click="refreshAll">
        {{ $t('actions.refresh') }}
      </UButton>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <UCard v-for="card in summaryCards" :key="card.key" class="text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{{ card.label }}</p>
        <p class="text-2xl font-bold" :class="card.color">
          {{ summaryPending ? '…' : card.value }}
        </p>
      </UCard>
    </div>

    <!-- Filters -->
    <UCard>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <USelect v-model="filters.status" :items="statusOptions" value-key="value" label-key="label"
          :placeholder="$t('filters.status') as string" />
        <USelect v-model="filters.eventType" :items="eventTypeOptions" value-key="value" label-key="label"
          :placeholder="$t('filters.eventType') as string" />
        <UInput v-model="filters.merchantReference" :placeholder="$t('filters.merchantReference') as string"
          icon="i-heroicons-tag" />
        <UInput v-model="filters.publicId" :placeholder="$t('filters.publicId') as string"
          icon="i-heroicons-identification" />
        <USelect v-model="filters.pageSize" :items="pageSizeOptions" value-key="value" label-key="label"
          :placeholder="$t('filters.pageSize') as string" />
      </div>
      <div class="flex gap-2 mt-3">
        <UButton color="primary" @click="applyFilters">{{ $t('filters.apply') }}</UButton>
        <UButton color="neutral" variant="outline" @click="resetFilters">{{ $t('filters.reset') }}</UButton>
      </div>
    </UCard>

    <!-- Table -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-medium text-gray-900 dark:text-white">{{ $t('table.title') }}</h2>
          <span class="text-sm text-gray-500 dark:text-gray-400">
            {{ listPending ? $t('table.loading') : $t('table.records', { n: pagination.total }) }}
          </span>
        </div>
      </template>

      <UTable :data="rows" :columns="columns" :loading="listPending" class="w-full [&_tbody_tr]:cursor-pointer"
        @select="onSelect">
        <!-- Status -->
        <template #status-cell="{ row }">
          <UBadge :color="statusColor(row?.original?.status || '')" variant="soft" size="sm">
            {{ row?.original?.status ?? '—' }}
          </UBadge>
        </template>

        <!-- Event -->
        <template #eventType-cell="{ row }">
          <div class="text-sm font-medium text-gray-900 dark:text-white">
            {{ row?.original?.eventType ?? '—' }}
          </div>
          <div class="text-xs text-gray-400 font-mono">
            {{ row?.original?.id ?? '—' }}
          </div>
        </template>

        <!-- Merchant ref -->
        <template #merchantRef-cell="{ row }">
          <div class="text-sm">
            {{ row?.original?.paymentIntent?.merchantReference || '—' }}
          </div>
          <div class="text-xs text-gray-400 font-mono">
            {{ row?.original?.paymentIntent?.publicId || '—' }}
          </div>
        </template>

        <!-- Attempt -->
        <template #attemptNumber-cell="{ row }">
          <span class="text-sm">{{ row?.original?.attemptNumber ?? '—' }}</span>
        </template>

        <!-- Response -->
        <template #response-cell="{ row }">
          <div class="text-sm">
            {{ row?.original?.status === 'DELIVERED'
              ? (row?.original?.responseStatusCode ?? 200)
              : (row?.original?.responseStatusCode ?? '—') }}
          </div>
          <div v-if="row?.original?.status !== 'DELIVERED' && row?.original?.errorMessage"
            class="text-xs text-red-500 truncate max-w-[140px]">
            {{ row?.original?.errorMessage }}
          </div>
        </template>

        <!-- Created At -->
        <template #createdAt-cell="{ row }">
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ formatDate(row?.original?.createdAt) }}
          </span>
        </template>

        <!-- Target -->
        <template #target-cell="{ row }">
          <span class="text-xs font-mono text-gray-500 truncate block max-w-[180px]">
            {{ row?.original?.targetUrlSnapshot || row?.original?.webhookEndpoint?.url || '—' }}
          </span>
        </template>

        <!-- Actions — ส่ง row ทั้งก้อน (TanStack Row) ให้ openDetail ใช้ row.index lookup -->
        <template #actions-cell="{ row }">
          <UButton size="xs" color="neutral" variant="ghost" icon="i-heroicons-eye" @click.stop="openDetail(row)" />
        </template>
      </UTable>

      <template #footer>
        <div class="flex items-center justify-between">
          <UButton :disabled="filters.page <= 1" color="neutral" variant="outline" size="sm"
            icon="i-heroicons-chevron-left" @click="prevPage">
            {{ $t('pagination.previous') }}
          </UButton>
          <span class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t('pagination.page', { current: pagination.page, total: pagination.totalPages }) }}
          </span>
          <UButton :disabled="filters.page >= pagination.totalPages" color="neutral" variant="outline" size="sm"
            trailing-icon="i-heroicons-chevron-right" @click="nextPage">
            {{ $t('pagination.next') }}
          </UButton>
        </div>
      </template>
    </UCard>

    <!-- Detail Modal (กลางจอ) — ใช้ #content slot เพื่อ override ทั้งหมด -->
    <UModal v-model:open="isOpen" :ui="{ content: 'sm:max-w-3xl' }">
      <template #content>
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div class="flex items-center gap-2">
            <h3 class="font-semibold text-gray-900 dark:text-white">{{ $t('detail.title') }}</h3>
            <UBadge v-if="selected" :color="statusColor(selected.status)" variant="soft" size="sm">
              {{ selected.status }}
            </UBadge>
          </div>
          <div class="flex items-center gap-2">
            <UButton v-if="selected && canRedrive(selected)" :loading="redrivePending"
              :label="(redrivePending ? $t('detail.retrying') : $t('detail.retry')) as string" color="primary"
              icon="i-heroicons-arrow-path" size="sm" @click="retrySelected" />
            <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="isOpen = false" />
          </div>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto max-h-[75vh]">
          <div v-if="!selected" class="flex items-center justify-center h-40 text-gray-400 text-sm">
            {{ $t('detail.selectRow') }}
          </div>

          <div v-else class="p-4 space-y-5 text-sm">

            <!-- Overview -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{{ $t('detail.overview') }}
              </p>
              <div class="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.id') }}</p>
                  <p class="font-mono text-xs break-all">{{ selected.id }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.eventType') }}</p>
                  <p>{{ selected.eventType }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.attemptNumber') }}</p>
                  <p>{{ selected.attemptNumber }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.createdAt') }}</p>
                  <p>{{ formatDate(selected.createdAt) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.deliveredAt') }}</p>
                  <p>{{ formatDate(selected.deliveredAt) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.nextAttemptAt') }}</p>
                  <p>{{ formatDate(selected.nextAttemptAt) }}</p>
                </div>
                <div class="col-span-2">
                  <p class="text-xs text-gray-500">{{ $t('detail.lastError') }}</p>
                  <p :class="selected.errorMessage ? 'text-red-500' : ''">
                    {{ selected.status === 'DELIVERED' ? '—' : selected.errorMessage || '—' }}
                  </p>
                </div>
              </div>
            </div>

            <USeparator />

            <!-- Payment -->
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">{{ $t('detail.payment') }}
              </p>
              <div class="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.publicId') }}</p>
                  <p class="font-mono text-xs">{{ selected.paymentIntent?.publicId || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.paymentStatus') }}</p>
                  <p>{{ selected.paymentIntent?.status || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.merchantReference') }}</p>
                  <p>{{ selected.paymentIntent?.merchantReference || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.merchantOrderId') }}</p>
                  <p>{{ selected.paymentIntent?.merchantOrderId || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.providerReference') }}</p>
                  <p class="font-mono text-xs">{{ selected.paymentIntent?.providerReference || '—' }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500">{{ $t('detail.providerTransactionId') }}</p>
                  <p class="font-mono text-xs">{{ selected.paymentIntent?.providerTransactionId || '—' }}</p>
                </div>
              </div>
            </div>

            <USeparator />

            <!-- Request / Response payloads -->
            <div class="space-y-3">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{{ $t('detail.requestBody')
                }}</p>
                <pre
                  class="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">{{ prettyJson(selected.requestBody) }}</pre>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{{
                  $t('detail.responseBody') }}</p>
                <pre
                  class="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap break-words">{{ selected.responseBody || '—' }}</pre>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{{
                  $t('detail.requestHeaders') }}</p>
                <pre
                  class="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap break-words">{{ prettyJson(selected.requestHeaders) }}</pre>
              </div>
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">{{
                  $t('detail.responseHeaders') }}</p>
                <pre
                  class="text-xs bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap break-words">{{ prettyJson(selected.responseHeaders) }}</pre>
              </div>
            </div>

          </div>
        </div><!-- end body scroll wrapper -->
      </template>
    </UModal>

  </div>
</template>
