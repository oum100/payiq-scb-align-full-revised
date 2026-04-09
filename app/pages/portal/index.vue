<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
        {{ $t('portal.dashboard.welcome') }}{{ user?.name ? `, ${user.name}` : '' }} 👋
      </h1>
      <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">{{ today }}</p>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <UCard v-for="card in summaryCards" :key="card.key">
        <p class="text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2">{{ card.label }}</p>
        <p class="text-2xl font-bold" :class="card.color">
          {{ pending ? '…' : card.value }}
        </p>
      </UCard>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <NuxtLink to="/portal/payments" class="quick-link">
        <UIcon name="i-heroicons-banknotes" class="w-5 h-5 text-amber-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">{{ $t('portal.dashboard.quickActions.payments') }}</span>
      </NuxtLink>
      <NuxtLink to="/portal/webhooks" class="quick-link">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 text-blue-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">{{ $t('portal.dashboard.quickActions.webhooks') }}</span>
      </NuxtLink>
      <NuxtLink to="/portal/api-keys" class="quick-link">
        <UIcon name="i-heroicons-key" class="w-5 h-5 text-purple-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">{{ $t('portal.dashboard.quickActions.apiKeys') }}</span>
      </NuxtLink>
      <a href="https://docs.payiq.app" target="_blank" class="quick-link">
        <UIcon name="i-heroicons-book-open" class="w-5 h-5 text-emerald-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-neutral-200">{{ $t('portal.dashboard.quickActions.docs') }}</span>
      </a>
    </div>

    <!-- Recent payments placeholder -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-medium text-gray-900 dark:text-white">{{ $t('portal.dashboard.recentPayments') }}</h2>
          <NuxtLink to="/portal/payments">
            <UButton variant="ghost" color="neutral" size="xs" trailing-icon="i-heroicons-arrow-right">
              {{ $t('portal.dashboard.viewAll') }}
            </UButton>
          </NuxtLink>
        </div>
      </template>
      <div class="flex items-center justify-center py-10 text-sm text-gray-400 dark:text-neutral-500">
        <div class="text-center">
          <UIcon name="i-heroicons-banknotes" class="w-10 h-10 mb-3 opacity-30 mx-auto" />
          <p>{{ $t('portal.dashboard.noPayments') }}</p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'portal', middleware: 'portal-auth' })

const { user } = usePortalUser()
const { $t, $getLocale } = useI18n()

const today = computed(() => {
  const locale = $getLocale() === 'th' ? 'th-TH' : 'en-GB'
  return new Date().toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
})

// Placeholder stats — จะดึงจาก API จริงในขั้นต่อไป
const pending = ref(false)
const summaryCards = computed(() => [
  { key: 'total', label: $t('portal.dashboard.stats.total'), value: '—', color: 'text-gray-700 dark:text-neutral-200' },
  { key: 'succeeded', label: $t('portal.dashboard.stats.succeeded'), value: '—', color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'pending', label: $t('portal.dashboard.stats.pending'), value: '—', color: 'text-amber-600 dark:text-amber-400' },
  { key: 'failed', label: $t('portal.dashboard.stats.failed'), value: '—', color: 'text-red-600 dark:text-red-400' },
])
</script>

<style scoped>
.quick-link {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #e5e7eb;
  background: white;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.quick-link:hover {
  border-color: #f59e0b;
  box-shadow: 0 0 0 1px #f59e0b22;
}
.dark .quick-link {
  background: #171717;
  border-color: #262626;
}
.dark .quick-link:hover {
  border-color: #f59e0b55;
}
</style>
