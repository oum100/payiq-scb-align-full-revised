<script setup lang="ts">
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'
import { useLocalStore } from '~~/stores/local' // เพิ่มบรรทัดนี้

const { admin, fetchAdmin, logout } = useAdmin()
const { $t,$getLocale, $switchLocale, $getLocales } = useI18n()
const colorMode = useColorMode()

await fetchAdmin()
const open = ref(true)

const adminInitial = computed(() => {
  const n = admin.value?.name ?? admin.value?.email ?? 'A'
  return (n?.[0] ?? 'A').toUpperCase()
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

//Theme toggle
function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

function getNavItems(state: 'collapsed' | 'expanded'): NavigationMenuItem[] {
  return [
    {
      label: $t('admin.nav.overview') as string,
      icon: 'i-lucide-folder-kanban',
      defaultOpen: true,
      children: [
        { label: $t('admin.nav.dashboard') as string, icon: 'i-lucide-layout-dashboard', to: '/admin' },
      ],
    },
    {
      label: $t('admin.nav.payments') as string,
      icon: 'i-lucide-hand-coins',
      defaultOpen: true,
      children: [
        { label: $t('admin.payment.title') as string, icon: 'i-lucide-banknote', to: '/admin/payments' },
        { label: $t('admin.nav.callbacks') as string, icon: 'i-lucide-refresh-cw', to: '/admin/callbacks' },
      ],
    },
    {
      label: 'Delivery',
      icon: 'i-lucide-truck',
      defaultOpen: true,
      children: [
        { label: $t('admin.nav.webhooks') as string, icon: 'i-lucide-send', to: '/admin/webhooks' },
        { label: $t('admin.nav.queueHealth') as string, icon: 'i-lucide-activity', to: '/admin/queues' },
      ],
    },
    {
      label: 'Management',
      icon: 'i-lucide-square-chart-gantt',
      defaultOpen: true,
      children: [
        { label: $t('admin.nav.tenants') as string, icon: 'i-lucide-building-2', to: '/admin/tenants' },
        { label: $t('admin.nav.merchants') as string, icon: 'i-lucide-users', to: '/admin/merchants' },
        { label: $t('admin.nav.apiKeys') as string, icon: 'i-lucide-key', to: '/admin/api-keys' },
        { label: $t('admin.nav.adminUsers') as string, icon: 'i-lucide-shield-check', to: '/admin/users' },
      ],
    },
  ]
}

const userItems = computed<DropdownMenuItem[][]>(() => [
  [
    { label: admin.value?.email ?? '', disabled: true },
  ],
  [
    {
      label: 'Appearance',
      icon: 'i-lucide-sun-moon',
      children: [
        {
          label: 'Light',
          icon: 'i-lucide-sun',
          type: 'checkbox' as const,
          checked: colorMode.value === 'light',
          onUpdateChecked(checked: boolean) {
            if (checked) colorMode.preference = 'light'
          },
          onSelect(e: Event) { e.preventDefault() },
        },
        {
          label: 'Dark',
          icon: 'i-lucide-moon',
          type: 'checkbox' as const,
          checked: colorMode.value === 'dark',
          onUpdateChecked(checked: boolean) {
            if (checked) colorMode.preference = 'dark'
          },
          onSelect(e: Event) { e.preventDefault() },
        },
      ],
    },
  ],
  [
    { label: $t('admin.signOut') as string, icon: 'i-lucide-log-out', onSelect: logout },
  ],
])
</script>

<template>
  <div class="flex min-h-screen font-sans bg-gray-50 dark:bg-neutral-950">
    <USidebar v-model:open="open" collapsible="icon" :ui="{
      container: 'h-full',
      inner: 'divide-transparent',
      body: 'py-0',
    }">
      <!-- Logo -->
      <template #header="{ open: isOpen }">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="text-xl font-bold tracking-tight flex-shrink-0">
            <span class="text-gray-900 dark:text-neutral-100">pay</span><span class="text-amber-500">IQ</span>
          </span>
          <UBadge v-if="isOpen" label="Admin" color="neutral" variant="soft" size="xs" />
        </div>
      </template>

      <!-- Nav -->
      <template #default="{ state }">
        <UNavigationMenu :key="state" :items="getNavItems(state)" orientation="vertical"
          :ui="{ link: 'p-1.5 overflow-hidden' }" />
      </template>

      <!-- User footer -->
      <template #footer>
        <UDropdownMenu :items="userItems" :content="{ align: 'center', collisionPadding: 12 }"
          :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }">
          <UButton color="neutral" variant="ghost" square class="w-full data-[state=open]:bg-elevated overflow-hidden">
            <div
              class="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 text-xs font-bold flex-shrink-0">
              {{ adminInitial }}
            </div>
            <span class="truncate text-sm font-medium text-gray-700 dark:text-neutral-300">
              {{ admin?.name ?? admin?.email?.split('@')[0] }}
            </span>
            <UIcon name="i-lucide-chevrons-up-down" class="ms-auto text-gray-400 w-4 h-4 flex-shrink-0" />
          </UButton>
        </UDropdownMenu>
      </template>
    </USidebar>

    <!-- Main -->
    <div class="flex flex-1 flex-col min-w-0">
      <!-- Topbar -->
      <header class="sticky top-0 z-30 h-10 shrink-0 flex items-center justify-between px-6
                     border-b border-gray-200 dark:border-neutral-800
                     bg-white/90 dark:bg-neutral-900/90 backdrop-blur">
        <UButton icon="i-lucide-panel-left" color="neutral" variant="ghost" size="md" aria-label="Toggle sidebar"
          @click="open = !open" />

        <div class="flex items-center gap-2">
          <span class="hidden sm:inline-flex text-xs font-bold tracking-widest px-2 py-0.5 rounded
                       bg-lime-500/10 text-lime-600 dark:text-lime-400 border border-lime-500/20">
            SANDBOX
          </span>
          <USelect v-model="currentLocale" :items="availableLocales" value-key="value" label-key="label" size="sm" class="w-24" />
          <UButton :icon="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" color="neutral" variant="ghost"
            size="sm" @click="toggleTheme" />
        </div>
      </header>

      <!-- Page content — full width, no max-width cap -->
      <main class="flex-1 p-6 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
