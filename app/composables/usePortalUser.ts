// app/composables/usePortalUser.ts
export function usePortalUser() {
  const user = useState<{
    id: string; email: string; name: string | null
    tenantId: string; role: string; tenantName: string
  } | null>("portal_user", () => null)

  async function fetchUser() {
    try {
      const data = await $fetch<{ user: typeof user.value }>("/api/portal/auth/me")
      user.value = data.user
    } catch {
      user.value = null
    }
  }

  async function logout() {
    await $fetch("/api/portal/auth/logout", { method: "POST" }).catch(() => {})
    user.value = null
    await navigateTo("/portal/login")
  }

  return { user, fetchUser, logout }
}
