<script setup lang="ts">
import { useLocalStore } from '~~/stores/local' // เพิ่มบรรทัดนี้

const { $getLocale, $switchLocale, $getLocales, $t } = useI18n()
const colorMode = useColorMode()

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
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
    <header class="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
      <div class="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center">
            <span class="text-white text-xs font-bold">P</span>
          </div>
          <span class="font-semibold text-gray-900 dark:text-white text-sm">
            {{ $t('nav.title') }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <USelect v-model="currentLocale" :items="availableLocales" value-key="value" label-key="label" size="sm" class="w-22" />
          <UButton :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'" color="neutral" variant="ghost" size="sm" @click="toggleColorMode" />
        </div>
      </div>
    </header>
    <main class="max-w-screen-2xl mx-auto px-6 py-6">
      <slot />
    </main>
  </div>
</template>
