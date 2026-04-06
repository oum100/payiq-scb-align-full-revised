<script setup lang="ts">
const { $getLocale, $switchLocale, $getLocales, $t } = useI18n()
const colorMode = useColorMode()

// $getLocales จาก nuxt-i18n-micro เป็น plain array ไม่ใช่ Ref
const availableLocales = computed(() =>
  $getLocales().map((l: { code: string; name?: string }) => ({
    label: l.name ?? l.code,
    value: l.code,
  }))
)

// console.log('Available locales:', availableLocales.value, $getLocales())

const currentLocale = computed({
  get: () => $getLocale(),
  set: (val: string) => $switchLocale(val),
})

function toggleColorMode() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
    <!-- Top Navbar -->
    <header class="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur">
      <div class="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <!-- Logo / Title -->
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center">
            <span class="text-white text-xs font-bold">P</span>
          </div>
          <span class="font-semibold text-gray-900 dark:text-white text-sm">
            {{ $t('nav.title') }}
          </span>
        </div>

        <!-- Right controls -->
        <div class="flex items-center gap-2">
          <!-- Language switcher -->
          <USelect
            v-model="currentLocale"
            :items="availableLocales"
            value-key="value"
            label-key="label"
            size="sm"
            class="w-22"
          />

          <!-- Color mode toggle -->
          <UButton
            :icon="colorMode.value === 'dark' ? 'i-heroicons-sun' : 'i-heroicons-moon'"
            color="neutral"
            variant="ghost"
            size="sm"
            @click="toggleColorMode"
          />
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="max-w-screen-2xl mx-auto px-6 py-6">
      <NuxtPage />
    </main>
  </div>
</template>
