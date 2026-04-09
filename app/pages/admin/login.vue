<template>
  <div class="login-root">
    <div class="login-card">
      <!-- Logo -->
      <div class="logo">
        <span class="logo-pay">pay</span><span class="logo-iq">IQ</span>
        <span class="logo-badge text-red-100">Administrator</span>
      </div>

      <!-- Error banner -->
      <div v-if="errorMsg" class="error-banner">
        <span class="error-icon">⚠</span> {{ errorMsg }}
      </div>

      <!-- Sent state -->
      <template v-if="sent">
        <div class="sent-icon">✉</div>
        <h1 class="title">Check your inbox</h1>
        <p class="subtitle">
          We sent a sign-in link to<br>
          <strong>{{ sentEmail }}</strong>
        </p>
        <p class="hint">Link expires in 15 minutes · check spam if not arrived</p>
        <button class="btn-ghost" @click="reset">Send another link</button>
      </template>

      <!-- Login form -->
      <template v-else>
        <h1 class="title">Sign in</h1>
        <p class="subtitle">Enter your admin email to receive a sign-in link</p>

        <form @submit.prevent="submit">
          <div class="field">
            <label for="email">Email address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="you@company.com"
              autocomplete="email"
              required
              :disabled="loading"
            />
          </div>
          <button type="submit" class="btn-primary" :disabled="loading || !email">
            <span v-if="loading" class="spinner" />
            <span v-else>Send sign-in link →</span>
          </button>
        </form>
      </template>
    </div>
    <!-- Footer -->
    <p class="footer-note">PayIQ Internal Dashboard · Unauthorized access is prohibited</p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const email = ref("")
const loading = ref(false)
const sent = ref(false)
const sentEmail = ref("")

// Error messages map
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

<style scoped>
.login-root {
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: #272727;
  border: 1px solid #242424;
  border-radius: 16px;
  padding: 40px 36px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 36px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}
.logo-pay { color: #fff; }
.logo-iq { color: #f59e0b; }
.logo-badge {
  font-size: 11px;
  font-weight: 500;
  color: #888;
  background: #1f1f1f;
  border: 1px solid #2a2a2a;
  border-radius: 4px;
  padding: 2px 7px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.error-banner {
  background: #2a1515;
  border: 1px solid #5c2020;
  border-radius: 8px;
  color: #f87171;
  font-size: 13px;
  padding: 10px 14px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.error-icon { font-size: 14px; }

.title {
  font-size: 22px;
  font-weight: 600;
  color: #f0f0f0;
  margin: 0 0 8px;
  letter-spacing: -0.3px;
}
.subtitle {
  font-size: 14px;
  color: #666;
  margin: 0 0 28px;
  line-height: 1.6;
}
.subtitle strong { color: #aaa; }

.field {
  margin-bottom: 16px;
}
.field label {
  display: block;
  font-size: 13px;
  color: #888;
  margin-bottom: 7px;
  font-weight: 500;
}
.field input {
  width: 100%;
  background: #0f0f0f;
  border: 1px solid #242424;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 14px;
  color: #f0f0f0;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
  font-family: inherit;
}
.field input:focus { border-color: #f59e0b44; box-shadow: 0 0 0 3px #f59e0b11; }
.field input::placeholder { color: #3a3a3a; }
.field input:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  width: 100%;
  background: #f59e0b;
  color: #0a0a0a;
  border: none;
  border-radius: 8px;
  padding: 13px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
}
.btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
.btn-primary:active:not(:disabled) { transform: translateY(0); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-ghost {
  width: 100%;
  background: transparent;
  color: #666;
  border: 1px solid #242424;
  border-radius: 8px;
  padding: 11px;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-top: 16px;
  font-family: inherit;
}
.btn-ghost:hover { color: #aaa; border-color: #333; }

.sent-icon {
  font-size: 36px;
  margin-bottom: 16px;
}
.hint {
  font-size: 12px;
  color: #444;
  margin-top: 16px;
  line-height: 1.6;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #0a0a0a44;
  border-top-color: #0a0a0a;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

.footer-note {
  margin-top: 24px;
  font-size: 11px;
  color: #333;
  text-align: center;
}
</style>
