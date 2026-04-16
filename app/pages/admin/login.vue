<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 flex flex-col items-center justify-center px-6">
    <div class="w-full max-w-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl p-10">
      <!-- Logo -->
      <div class="flex items-center gap-2 mb-9 text-xl font-bold tracking-tight">
        <span class="text-gray-900 dark:text-white">pay</span>
        <span class="text-amber-500">IQ</span>
        <span class="ml-1 text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded px-1.5 py-0.5">
          Administrator
        </span>
      </div>

      <!-- Error banner -->
      <UAlert
        v-if="errorMsg"
        color="error"
        variant="soft"
        :description="errorMsg"
        icon="i-heroicons-exclamation-triangle"
        class="mb-5"
      />

      <!-- Sent state -->
      <template v-if="sent">
        <div class="text-4xl mb-4 text-center">✉</div>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center">Check your inbox</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 text-center leading-relaxed mb-1">
          We sent a sign-in link to<br>
          <strong class="text-gray-700 dark:text-neutral-200">{{ sentEmail }}</strong>
        </p>
        <p class="text-xs text-gray-400 dark:text-neutral-500 text-center mt-4 mb-4">
          Link expires in 15 minutes · check spam if not arrived
        </p>
        <UButton block color="neutral" variant="outline" @click="reset">Send another link</UButton>
      </template>

      <!-- Login form -->
      <template v-else>
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sign in</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mb-7">Enter your admin email to receive a sign-in link</p>

        <form @submit.prevent="submit">
          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-neutral-200 mb-1.5">
              Email address
            </label>
            <UInput
              id="email"
              v-model="email"
              type="email"
              placeholder="you@company.com"
              autocomplete="email"
              required
              :disabled="loading"
              size="lg"
              class="w-full"
            />
          </div>
          <UButton
            type="submit"
            block
            color="warning"
            size="lg"
            :loading="loading"
            :disabled="loading || !email"
            class="font-bold"
          >
            Send sign-in link →
          </UButton>
        </form>
      </template>
    </div>

    <!-- Footer -->
    <p class="mt-6 text-xs text-gray-400 dark:text-neutral-500 text-center">
      PayIQ Internal Dashboard · Unauthorized access is prohibited
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const email = ref("")
const loading = ref(false)
const sent = ref(false)
const sentEmail = ref("")

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: "This sign-in link is invalid.",
  token_used: "This sign-in link has already been used. Please request a new one.",
  token_expired: "This sign-in link has expired. Please request a new one.",
  inactive: "Your account is inactive. Contact your administrator.",
  session_expired: "Your session has expired. Please sign in again.",
  error: "Something went wrong. Please try again.",
}

const errorMsg = computed(() => {
  const code = route.query.error as string
  return code ? (ERROR_MESSAGES[code] ?? "An error occurred.") : ""
})

async function submit() {
  if (!email.value || loading.value) return
  loading.value = true
  try {
    await $fetch("/api/admin/auth/magic-link", {
      method: "POST",
      body: { email: email.value },
    })
    sentEmail.value = email.value
    sent.value = true
  } catch {
    // Silently succeed — don't reveal if email exists
    sentEmail.value = email.value
    sent.value = true
  } finally {
    loading.value = false
  }
}

function reset() {
  sent.value = false
  email.value = ""
  sentEmail.value = ""
}
</script>
