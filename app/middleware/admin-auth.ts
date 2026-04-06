// app/middleware/admin-auth.ts
// Client-side guard สำหรับทุก page ใน /admin/*

export default defineNuxtRouteMiddleware(async (to) => {
  // ข้ามหน้า login
  if (to.path === "/admin/login") return

  try {
    await $fetch("/api/admin/auth/me")
  } catch {
    return navigateTo("/admin/login")
  }
})
