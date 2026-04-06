<template>
  <div class="verify-root">
    <div class="verify-card">
      <div class="logo">
        <span class="logo-pay">pay</span><span class="logo-iq">IQ</span>
      </div>

      <!-- Loading state -->
      <template v-if="state === 'loading'">
        <div class="spinner-wrap">
          <div class="spinner" />
        </div>
        <p class="verify-title">Signing you in…</p>
        <p class="verify-sub">Please wait a moment</p>
      </template>

      <!-- Success state (brief flash before redirect) -->
      <template v-else-if="state === 'success'">
        <div class="icon-wrap icon-success">✓</div>
        <p class="verify-title">Signed in!</p>
        <p class="verify-sub">Redirecting to dashboard…</p>
      </template>

      <!-- Error state -->
      <template v-else-if="state === 'error'">
        <div class="icon-wrap icon-error">✗</div>
        <p class="verify-title">{{ errorTitle }}</p>
        <p class="verify-sub">{{ errorMsg }}</p>
        <NuxtLink to="/admin/login" class="btn-back">← Back to sign in</NuxtLink>
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
    const mapped = ERROR_MAP[errorCode] ?? ERROR_MAP.error
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
    await $fetch(`/api/admin/auth/callback?token=${token}`, {
      // server จะ set cookie ผ่าน response headers
      credentials: "include",
    })
    state.value = "success"
    await new Promise((r) => setTimeout(r, 800))
    await navigateTo("/admin")
  } catch (err: any) {
    const code = err?.data?.code ?? "error"
    const mapped = ERROR_MAP[code] ?? ERROR_MAP.error
    errorTitle.value = mapped.title
    errorMsg.value = mapped.msg
    state.value = "error"
  }
})
</script>

<style scoped>
.verify-root {
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
}

.verify-card {
  width: 100%;
  max-width: 360px;
  background: #141414;
  border: 1px solid #242424;
  border-radius: 16px;
  padding: 44px 36px;
  text-align: center;
}

.logo {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 36px;
}

.logo-pay {
  color: #e8e8e8;
}

.logo-iq {
  color: #f59e0b;
}

/* ── Spinner ── */
.spinner-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2a2a2a;
  border-top-color: #f59e0b;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── Icon states ── */
.icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}

.icon-success {
  background: #0f2a1a;
  color: #22c55e;
  border: 2px solid #155233;
  animation: pop 0.3s ease-out;
}

.icon-error {
  background: #2a0f0f;
  color: #ef4444;
  border: 2px solid #521515;
}

@keyframes pop {
  0% {
    transform: scale(0.6);
    opacity: 0;
  }

  70% {
    transform: scale(1.1);
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ── Text ── */
.verify-title {
  font-size: 18px;
  font-weight: 600;
  color: #f0f0f0;
  margin: 0 0 8px;
  letter-spacing: -0.2px;
}

.verify-sub {
  font-size: 14px;
  color: #555;
  margin: 0;
  line-height: 1.6;
}

/* ── Back button ── */
.btn-back {
  display: inline-block;
  margin-top: 24px;
  font-size: 13px;
  color: #666;
  text-decoration: none;
  padding: 9px 16px;
  border: 1px solid #242424;
  border-radius: 7px;
  transition: color 0.15s, border-color 0.15s;
}

.btn-back:hover {
  color: #f59e0b;
  border-color: #333;
}
</style>