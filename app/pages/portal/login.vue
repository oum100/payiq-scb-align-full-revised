<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 transition-colors">
    <div class="w-full max-w-sm">
      <UCard class="shadow-xl h-100">
        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-1 text-2xl font-bold tracking-tight mb-1">
            <span class="text-gray-900 dark:text-white">pay</span><span class="text-amber-500">IQ</span>
          </div>
          <p class="text-sm text-gray-500 dark:text-neutral-400">{{ $t('portal.title') }}</p>
        </div>

        <!-- Error -->
        <UAlert v-if="errorMsg" color="error" variant="soft" :description="errorMsg" class="mb-5" icon="i-heroicons-exclamation-triangle" />

        <!-- Sent state -->
        <template v-if="sent">
          <div class="text-center py-4">
            <div class="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <UIcon name="i-heroicons-envelope-open" class="w-7 h-7 text-emerald-500" />
            </div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{{ $t('portal.login.sentTitle') }}</h2>
            <p class="text-sm text-gray-500 dark:text-neutral-400 mb-1">{{ $t('portal.login.sentSubtitle') }}</p>
            <p class="text-sm font-medium text-gray-700 dark:text-neutral-200 mb-4">{{ sentEmail }}</p>
            <p class="text-xs text-gray-400 dark:text-neutral-500">{{ $t('portal.login.sentHint') }}</p>
            <UButton variant="ghost" color="neutral" size="sm" class="mt-5" @click="reset">
              {{ $t('portal.login.sendAnother') }}
            </UButton>
          </div>
        </template>

        <!-- Login form -->
        <template v-else>
          <h2 class="text-lg  py-5 font-semibold text-gray-900 dark:text-white mb-1">{{ $t('portal.login.heading') }}</h2>
          <p class="text-sm text-gray-500 dark:text-neutral-400 mb-6">{{ $t('portal.login.subtitle') }}</p>
          <form @submit.prevent="submit" class="py-6">
            <UFormField :label="$t('portal.login.emailLabel') as string" class="mb-4">
              <UInput
                v-model="email"
                type="email"
                :placeholder="$t('portal.login.emailPlaceholder') as string"
                autocomplete="email"
                :disabled="loading"
                size="lg"
                class="w-full"
              />
            </UFormField>
            <UButton type="submit" color="primary" size="lg" block :loading="loading" :disabled="!email"
              trailing-icon="i-heroicons-arrow-right">
              {{ $t('portal.login.sendBtn') }}
            </UButton>
          </form>
        </template>
      </UCard>

      <p class="text-center text-xs text-gray-400 dark:text-neutral-600 mt-6">
        {{ $t('portal.login.footer') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
const { $t } = useI18n()
const route = useRoute()
const email = ref('')
const loading = ref(false)
const sent = ref(false)
const sentEmail = ref('')

const errorMsg = computed(() => {
  const code = route.query.error as string
  if (!code) return ''
  return $t(`portal.login.errors.${code}`) as string || $t('portal.login.errors.error') as string
})

async function submit() {
  if (!email.value || loading.value) return
  loading.value = true
  try {
    await $fetch('/api/portal/auth/magic-link', { method: 'POST', body: { email: email.value } })
    sentEmail.value = email.value
    sent.value = true
  } catch {
    sentEmail.value = email.value
    sent.value = true
  } finally {
    loading.value = false
  }
}

function reset() {
  sent.value = false; email.value = ''; sentEmail.value = ''
}
</script>
