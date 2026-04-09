<template>
  <div class="min-h-screen bg-gray-50 dark:bg-neutral-950 flex items-center justify-center p-6 transition-colors">
    <div class="w-full max-w-sm text-center">
      <div class="inline-flex items-center gap-1 text-2xl font-bold tracking-tight mb-10">
        <span class="text-gray-900 dark:text-white">pay</span><span class="text-amber-500">IQ</span>
      </div>

      <UCard class="shadow-xl">
        <!-- Loading -->
        <div v-if="state === 'loading'" class="py-6">
          <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-amber-500 animate-spin mx-auto mb-4" />
          <p class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ $t('portal.callback.signingIn') }}</p>
          <p class="text-sm text-gray-500 dark:text-neutral-400">{{ $t('portal.callback.pleaseWait') }}</p>
        </div>

        <!-- Success -->
        <div v-else-if="state === 'success'" class="py-6">
          <div class="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-check" class="w-7 h-7 text-emerald-500" />
          </div>
          <p class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ $t('portal.callback.success') }}</p>
          <p class="text-sm text-gray-500 dark:text-neutral-400">{{ $t('portal.callback.redirecting') }}</p>
        </div>

        <!-- Error -->
        <div v-else class="py-6">
          <div class="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <UIcon name="i-heroicons-x-mark" class="w-7 h-7 text-red-500" />
          </div>
          <p class="text-base font-semibold text-gray-900 dark:text-white mb-1">{{ errorTitle }}</p>
          <p class="text-sm text-gray-500 dark:text-neutral-400 mb-5">{{ errorMsg }}</p>
          <UButton to="/portal/login" variant="outline" color="neutral" size="sm">
            {{ $t('portal.callback.backToLogin') }}
          </UButton>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const { $t } = useI18n()

type State = 'loading' | 'success' | 'error'
const state = ref<State>('loading')
const errorTitle = ref('')
const errorMsg = ref('')

function setError(code: string) {
  errorTitle.value = $t(`portal.callback.errors.${code}.title`) as string
    || $t('portal.callback.errors.error.title') as string
  errorMsg.value = $t(`portal.callback.errors.${code}.msg`) as string
    || $t('portal.callback.errors.error.msg') as string
}

onMounted(async () => {
  const token = route.query.token as string | undefined
  const errorCode = route.query.error as string | undefined

  if (errorCode) {
    setError(errorCode)
    state.value = 'error'; return
  }
  if (!token) {
    setError('no_token')
    state.value = 'error'; return
  }

  try {
    await $fetch(`/api/portal/auth/verify?token=${token}`, { credentials: 'include' })
    state.value = 'success'
    await new Promise(r => setTimeout(r, 800))
    await navigateTo('/portal')
  } catch (err: any) {
    const code = err?.data?.code ?? 'error'
    setError(code)
    state.value = 'error'
  }
})
</script>
