<script setup lang="ts">
import { useLocalStore } from '~~/stores/local' // เพิ่มบรรทัดนี้

const { user, fetchUser, logout } = usePortalUser()
const colorMode = useColorMode()
const { $t, $getLocale, $switchLocale, $getLocales } = useI18n()
await fetchUser()

const userInitial = computed(() => {
  const n = user.value?.name ?? user.value?.email ?? 'U'
  return n[0].toUpperCase()
})

// Multi-language: Create Language List
const availableLocales = computed(() =>
  $getLocales().map((l: { code: string; name?: string }) => ({ label: l.name ?? l.code, value: l.code }))
)

// Multi-language: Current Language with Pinia Store
const localStore = useLocalStore()
const currentLocale = computed({
  get: () => localStore.currentLocale || $getLocale(), // ดึงค่าจาก Pinia store ก่อน ถ้าไม่มีค่อยใช้ค่าเริ่มต้นจาก i18n
  set: (val: string) => {
    $switchLocale(val)
    localStore.setLanguage(val) // บันทึกการตั้งค่าภาษาใน Pinia store
  },
})

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 transition-colors font-sans">
    <!-- Topbar -->
    <header
      class="sticky top-0 z-50 border-b border-gray-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
      <div class="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <!-- Logo + Tenant -->
        <div class="flex items-center gap-3">
          <div class="text-base font-bold tracking-tight">
            <span class="text-gray-900 dark:text-neutral-100">pay</span><span class="text-amber-500">IQ</span>
          </div>
          <div class="w-px h-4 bg-gray-200 dark:bg-neutral-700" />
          <span class="text-sm font-medium text-gray-600 dark:text-neutral-300">{{ user?.tenantName }}</span>
          <UBadge v-if="user?.role" :label="user.role" size="xs" variant="soft" color="neutral" />
        </div>

        <!-- Right -->
        <div class="flex items-center gap-2">
          <USelect v-model="currentLocale" :items="availableLocales" value-key="value" label-key="label" size="sm"
            class="w-24" />
          <UButton :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" color="neutral"
            variant="ghost" size="sm" @click="toggleColorMode" />
          <UDropdownMenu :items="[[
            { label: user?.email ?? '', disabled: true },
            { type: 'separator' },
            { label: $t('portal.signOut') as string, icon: 'i-heroicons-arrow-right-on-rectangle', onSelect: logout }
          ]]">
            <UButton color="neutral" variant="ghost" size="sm">
              <div
                class="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 text-xs font-bold">
                {{ userInitial }}
              </div>
            </UButton>
          </UDropdownMenu>
        </div>
      </div>
    </header>

    <!-- Nav tabs -->
    <div class="border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
      <div class="max-w-screen-xl mx-auto px-6">
        <nav class="flex gap-1">
          <NuxtLink to="/portal" class="portal-tab" exact-active-class="portal-tab--active">
            <UIcon name="i-heroicons-home" class="w-4 h-4" /> {{ $t('portal.nav.overview') }}
          </NuxtLink>
          <NuxtLink to="/portal/payments" class="portal-tab" active-class="portal-tab--active">
            <UIcon name="i-heroicons-banknotes" class="w-4 h-4" /> {{ $t('portal.nav.payments') }}
          </NuxtLink>
          <NuxtLink to="/portal/webhooks" class="portal-tab" active-class="portal-tab--active">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" /> {{ $t('portal.nav.webhooks') }}
          </NuxtLink>
          <NuxtLink to="/portal/api-keys" class="portal-tab" active-class="portal-tab--active">
            <UIcon name="i-heroicons-key" class="w-4 h-4" /> {{ $t('portal.nav.apiKeys') }}
          </NuxtLink>
        </nav>
      </div>
    </div>

    <!-- Page content -->
    <main class="max-w-screen-xl mx-auto px-6 py-7">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.portal-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 0.875rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.12s, border-color 0.12s;
}

.portal-tab:hover {
  color: #374151;
}

.dark .portal-tab {
  color: #9ca3af;
}

.dark .portal-tab:hover {
  color: #f3f4f6;
}

.portal-tab--active {
  color: #f59e0b;
  border-bottom-color: #f59e0b;
}

.dark .portal-tab--active {
  color: #f59e0b;
  border-bottom-color: #f59e0b;
}
</style>
