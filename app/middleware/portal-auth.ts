// app/middleware/portal-auth.ts
export default defineNuxtRouteMiddleware(async () => {
  const { user, fetchUser } = usePortalUser()
  if (!user.value) await fetchUser()
  if (!user.value) return navigateTo("/portal/login")
})
