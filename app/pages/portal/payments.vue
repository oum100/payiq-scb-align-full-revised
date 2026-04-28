<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t('portal.payments.title') }}
      </h1>
      <UBadge color="neutral" variant="subtle" class="text-sm">
        {{ data?.pagination?.total?.toLocaleString() ?? '—' }}
      </UBadge>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 items-center">
      <UInput
        v-model="search"
        :placeholder="$t('portal.payments.search')"
        icon="i-lucide-search"
        class="flex-1 min-w-48"
        @input="onSearchInput"
      />
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        label-key="label"
        class="w-44"
      />
      <UButton
        v-if="search || statusFilter"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-x"
        @click="clearFilters"
      >
        {{ $t('portal.payments.clear') }}
      </UButton>
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="py-12 text-center text-sm text-gray-500 dark:text-neutral-400">
        {{ $t('portal.payments.loading') }}
      </div>
      <div v-else-if="!data?.items?.length" class="py-12 text-center text-sm text-gray-400 dark:text-neutral-500">
        <UIcon name="i-heroicons-banknotes" class="w-10 h-10 mb-3 opacity-30 mx-auto" />
        <p>{{ $t('portal.payments.empty') }}</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.payments.colStatus') }}</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.payments.colAmount') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.payments.colPublicId') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden sm:table-cell">{{ $t('portal.payments.colOrderId') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden md:table-cell">{{ $t('portal.payments.colMethod') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden lg:table-cell">{{ $t('portal.payments.colDate') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-neutral-800">
            <tr
              v-for="p in data.items"
              :key="p.publicId"
              class="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td class="px-4 py-3 text-center">
                <UBadge :color="statusColor(p.status)" variant="soft" size="xs">{{ p.status }}</UBadge>
              </td>
              <td class="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-neutral-100 tabular-nums">
                {{ fmtAmount(p.amount, p.currency) }}
              </td>
              <td class="px-4 py-3">
                <span class="font-mono text-xs text-gray-500 dark:text-neutral-400">{{ p.publicId }}</span>
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                <span class="text-sm text-gray-600 dark:text-neutral-300">{{ p.merchantOrderId ?? '—' }}</span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <span class="text-sm text-gray-600 dark:text-neutral-300">{{ METHOD_LABELS[p.paymentMethodType] ?? p.paymentMethodType }}</span>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <span class="text-xs text-gray-500 dark:text-neutral-400">{{ fmtDate(p.createdAt) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Pagination -->
    <div v-if="data?.pagination && data.pagination.totalPages > 1" class="flex items-center justify-between">
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="page === 1"
        @click="page--"
      >
        {{ $t('pagination.previous') }}
      </UButton>
      <span class="text-sm text-gray-500 dark:text-neutral-400">
        {{ $t('pagination.page', { current: page, total: data.pagination.totalPages }) }}
      </span>
      <UButton
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="page >= data.pagination.totalPages"
        @click="page++"
      >
        {{ $t('pagination.next') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'portal', middleware: 'portal-auth' })

const { $t } = useI18n()

const search = ref('')
const statusFilter = ref('')
const page = ref(1)
let searchTimer: ReturnType<typeof setTimeout>

const STATUS_OPTIONS = [
  'CREATED', 'ROUTING', 'PENDING_PROVIDER', 'AWAITING_CUSTOMER',
  'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED', 'REVERSED', 'REFUNDED',
]

const statusOptions = computed(() => [
  { value: '', label: $t('portal.payments.statusAll') },
  ...STATUS_OPTIONS.map((s) => ({ value: s, label: s })),
])

const METHOD_LABELS: Record<string, string> = {
  PROMPTPAY_QR: 'PromptPay QR',
  BANK_TRANSFER_SLIP: 'Bank Transfer',
  BILL_PAYMENT: 'Bill Payment',
  CASH: 'Cash',
}

const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: 'emerald',
  FAILED: 'red',
  EXPIRED: 'neutral',
  CANCELLED: 'neutral',
  PROCESSING: 'blue',
  AWAITING_CUSTOMER: 'amber',
  PENDING_PROVIDER: 'amber',
  REVERSED: 'purple',
  REFUNDED: 'purple',
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? 'neutral'
}

function fmtAmount(amount: string, currency: string) {
  return `${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${currency}`
}

function fmtDate(date: string | Date) {
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1 }, 400)
}

function clearFilters() {
  search.value = ''
  statusFilter.value = ''
  page.value = 1
}

const { data, pending } = await useFetch('/api/portal/payments', {
  query: computed(() => ({
    page: page.value,
    pageSize: 25,
    search: search.value || undefined,
    status: statusFilter.value || undefined,
  })),
  watch: [page, statusFilter],
})
</script>
