<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t('portal.webhooks.title') }}
      </h1>
      <UBadge color="neutral" variant="subtle" class="text-sm">
        {{ data?.pagination?.total?.toLocaleString() ?? '—' }}
      </UBadge>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap gap-2 items-center">
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        label-key="label"
        class="w-44"
      />
      <UButton
        v-if="statusFilter"
        color="neutral"
        variant="outline"
        size="sm"
        icon="i-lucide-x"
        @click="statusFilter = ''; page = 1"
      >
        {{ $t('portal.payments.clear') }}
      </UButton>
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="py-12 text-center text-sm text-gray-500 dark:text-neutral-400">
        {{ $t('portal.webhooks.loading') }}
      </div>
      <div v-else-if="!data?.items?.length" class="py-12 text-center text-sm text-gray-400 dark:text-neutral-500">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 mb-3 opacity-30 mx-auto" />
        <p>{{ $t('portal.webhooks.empty') }}</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.webhooks.colStatus') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.webhooks.colEvent') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.webhooks.colPayment') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden md:table-cell">{{ $t('portal.webhooks.colEndpoint') }}</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden sm:table-cell">{{ $t('portal.webhooks.colAttempts') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden lg:table-cell">{{ $t('portal.webhooks.colDate') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-neutral-800">
            <tr
              v-for="d in data.items"
              :key="d.id"
              class="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td class="px-4 py-3 text-center">
                <UBadge :color="webhookStatusColor(d.status)" variant="soft" size="xs">{{ d.status }}</UBadge>
              </td>
              <td class="px-4 py-3">
                <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">{{ d.eventType }}</span>
              </td>
              <td class="px-4 py-3">
                <span class="font-mono text-xs text-gray-500 dark:text-neutral-400">{{ d.paymentIntent.publicId }}</span>
                <div class="text-xs text-gray-400 dark:text-neutral-500">
                  {{ fmtAmount(d.paymentIntent.amount, d.paymentIntent.currency) }}
                </div>
              </td>
              <td class="px-4 py-3 hidden md:table-cell max-w-48">
                <span class="text-xs text-gray-500 dark:text-neutral-400 truncate block">{{ d.targetUrlSnapshot ?? '—' }}</span>
              </td>
              <td class="px-4 py-3 text-center hidden sm:table-cell">
                <span class="text-sm text-gray-600 dark:text-neutral-300">{{ d.attemptNumber }}</span>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <span class="text-xs text-gray-500 dark:text-neutral-400">{{ fmtDate(d.createdAt) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Pagination -->
    <div v-if="data?.pagination && data.pagination.totalPages > 1" class="flex items-center justify-between">
      <UButton color="neutral" variant="outline" size="sm" :disabled="page === 1" @click="page--">
        {{ $t('pagination.previous') }}
      </UButton>
      <span class="text-sm text-gray-500 dark:text-neutral-400">
        {{ $t('pagination.page', { current: page, total: data.pagination.totalPages }) }}
      </span>
      <UButton color="neutral" variant="outline" size="sm" :disabled="page >= data.pagination.totalPages" @click="page++">
        {{ $t('pagination.next') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'portal', middleware: 'portal-auth' })

const { $t } = useI18n()

const statusFilter = ref('')
const page = ref(1)

const statusOptions = computed(() => [
  { value: '', label: $t('portal.webhooks.statusAll') },
  { value: 'DELIVERED', label: 'DELIVERED' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'RETRYING', label: 'RETRYING' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'PROCESSING', label: 'PROCESSING' },
])

const WEBHOOK_STATUS_COLORS: Record<string, string> = {
  DELIVERED: 'emerald',
  FAILED: 'red',
  RETRYING: 'amber',
  PENDING: 'neutral',
  PROCESSING: 'blue',
}

function webhookStatusColor(status: string) {
  return WEBHOOK_STATUS_COLORS[status] ?? 'neutral'
}

function fmtAmount(amount: string, currency: string) {
  return `${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ${currency}`
}

function fmtDate(date: string | Date) {
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

watch(statusFilter, () => { page.value = 1 })

const { data, pending } = await useFetch('/api/portal/webhooks', {
  query: computed(() => ({
    page: page.value,
    pageSize: 25,
    status: statusFilter.value || undefined,
  })),
  watch: [page, statusFilter],
})
</script>
