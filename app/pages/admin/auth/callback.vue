<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 flex items-center justify-center px-6">
    <div
      class="w-full max-w-sm bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-2xl py-11 px-9 text-center">
      <!-- Logo -->
      <div class="text-xl font-bold tracking-tight mb-9">
        <span class="text-gray-900 dark:text-white">pay</span>
        <span class="text-amber-500">IQ</span>
      </div>

      <!-- Loading state -->
      <template v-if="state === 'loading'">
        <div class="flex justify-center mb-6">
          <UIcon name="i-heroicons-arrow-path" class="text-4xl text-amber-500 animate-spin" />
        </div>
        <p class="text-base font-semibold text-gray-900 dark:text-white mb-2">Signing you in…</p>
        <p class="text-sm text-gray-500 dark:text-neutral-400">Please wait a moment</p>
      </template>

      <!-- Success state -->
      <template v-else-if="state === 'success'">
        <div
          class="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-400 dark:border-green-600 flex items-center justify-center mx-auto mb-6 animate-[pop_0.3s_ease-out]">
          <UIcon name="i-heroicons-check" class="text-2xl text-green-600 dark:text-green-400" />
        </div>
        <p class="text-base font-semibold text-gray-900 dark:text-white mb-2">Signed in!</p>
        <p class="text-sm text-gray-500 dark:text-neutral-400">Redirecting to dashboard…</p>
      </template>

      <!-- Error state -->
      <template v-else-if="state === 'error'">
        <div
          class="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 border-2 border-red-400 dark:border-red-600 flex items-center justify-center mx-auto mb-6">
          <UIcon name="i-heroicons-x-mark" class="text-2xl text-red-600 dark:text-red-400" />
        </div>
        <p class="text-base font-semibold text-gray-900 dark:text-white mb-2">{{ errorTitle }}</p>
        <p class="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed mb-6">{{ errorMsg }}</p>
        <UButton to="/admin/login" color="neutral" variant="outline" size="sm">← Back to sign in</UButton>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()

type State = "loading" | "success" | "error"
const state = ref<State>("loading")
const errorTitle = ref("Link invalid")
const errorMsg = ref("This sign-in link is not valid.")

const ERROR_MAP: Record<string, { title: string; msg: string }> = {
  invalid_token: {
    title: "Link not found",
    msg: "This sign-in link is invalid or has already expired.",
  },
  token_used: {
    title: "Link already used",
    msg: "This link has already been used. Please request a new one.",
  },
  token_expired: {
    title: "Link expired",
    msg: "This link expired after 15 minutes. Please request a new one.",
  },
  inactive: {
    title: "Account inactive",
    msg: "Your account has been deactivated. Contact your administrator.",
  },
  error: {
    title: "Something went wrong",
    msg: "An unexpected error occurred. Please try again.",
  },
}

onMounted(async () => {
  const token = route.query.token as string | undefined
  const errorCode = route.query.error as string | undefined

  // ถ้า server redirect มาพร้อม ?error= แล้ว
  if (errorCode) {
    const mapped = ERROR_MAP[errorCode] ?? ERROR_MAP["error"]!
    errorTitle.value = mapped.title
    errorMsg.value = mapped.msg
    state.value = "error"
    return
  }

  // ถ้าไม่มี token เลย
  if (!token) {
    errorTitle.value = "No token provided"
    errorMsg.value = "The sign-in link appears to be incomplete."
    state.value = "error"
    return
  }

  // Hit server verify endpoint — มัน set cookie แล้ว redirect
  // แต่ถ้า fetch ใน client จะไม่ follow redirect โดยอัตโนมัติ
  // จึงเรียก API แยกแล้ว navigate เอง
  try {
    await $fetch(`/api/admin/auth/verify?token=${token}`, {
      // server จะ set cookie ผ่าน response headers
      credentials: "include",
    })
    state.value = "success"
    await new Promise((r) => setTimeout(r, 800))
    await navigateTo("/admin")
  } catch (err: any) {
    const code = err?.data?.code ?? "error"
    const mapped = ERROR_MAP[code] ?? ERROR_MAP["error"]!
    errorTitle.value = mapped.title
    errorMsg.value = mapped.msg
    state.value = "error"
  }
})
</script>
