// app/composables/useAdmin.ts
// Composable สำหรับ get admin session + logout

export function useAdmin() {
  const admin = useState<{ id: string; email: string; name: string | null } | null>(
    "admin",
    () => null
  )

  async function fetchAdmin() {
    try {
      const data = await $fetch<{ admin: { id: string; email: string; name: string | null } }>(
        "/api/admin/auth/me"
      )
      admin.value = data.admin
    } catch {
      admin.value = null
    }
  }

  async function logout() {
    await $fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => {})
    admin.value = null
    await navigateTo("/admin/login")
  }

  return { admin, fetchAdmin, logout }
}
