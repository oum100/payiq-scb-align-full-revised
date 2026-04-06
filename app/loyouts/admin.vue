<template>
  <div class="dash-root">
    <!-- Sidebar -->
    <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
      <div class="sidebar-header">
        <div class="logo">
          <span class="logo-pay">pay</span><span class="logo-iq">IQ</span>
        </div>
        <button class="sidebar-close" @click="sidebarOpen = false">✕</button>
      </div>

      <nav class="nav">
        <div class="nav-section-label">Overview</div>
        <NuxtLink to="/admin" class="nav-item" exact-active-class="nav-item--active">
          <span class="nav-icon">▦</span> Dashboard
        </NuxtLink>

        <div class="nav-section-label">Payments</div>
        <NuxtLink to="/admin/payments" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">◈</span> Payments
        </NuxtLink>
        <NuxtLink to="/admin/callbacks" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">↺</span> Callbacks
        </NuxtLink>

        <div class="nav-section-label">Delivery</div>
        <NuxtLink to="/admin/webhooks" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">⇗</span> Webhooks
        </NuxtLink>
        <NuxtLink to="/admin/queues" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">⧖</span> Queue Health
        </NuxtLink>

        <div class="nav-section-label">Management</div>
        <NuxtLink to="/admin/merchants" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">◉</span> Merchants
        </NuxtLink>
        <NuxtLink to="/admin/api-keys" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">⚿</span> API Keys
        </NuxtLink>
        <NuxtLink to="/admin/users" class="nav-item" active-class="nav-item--active">
          <span class="nav-icon">◎</span> Admin Users
        </NuxtLink>
      </nav>

      <div class="sidebar-footer">
        <div class="admin-info">
          <div class="admin-avatar">{{ adminInitial }}</div>
          <div class="admin-meta">
            <div class="admin-name">{{ admin?.name ?? admin?.email?.split("@")[0] }}</div>
            <div class="admin-email">{{ admin?.email }}</div>
          </div>
        </div>
        <button class="logout-btn" title="Sign out" @click="logout">⏻</button>
      </div>
    </aside>

    <!-- Overlay for mobile -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false" />

    <!-- Main -->
    <main class="main">
      <!-- Top bar -->
      <header class="topbar">
        <button class="menu-btn" @click="sidebarOpen = true">☰</button>
        <div class="topbar-right">
          <span class="env-badge">SANDBOX</span>
        </div>
      </header>

      <!-- Page content -->
      <div class="page-content">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: "admin-auth" })

const { admin, fetchAdmin, logout } = useAdmin()
const sidebarOpen = ref(false)

await fetchAdmin()

const adminInitial = computed(() => {
  const name = admin.value?.name ?? admin.value?.email ?? "A"
  return name[0].toUpperCase()
})
</script>

<style>
/* Global reset for dashboard */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #0a0a0a; color: #d4d4d4; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; }
a { text-decoration: none; color: inherit; }
</style>

<style scoped>
.dash-root {
  display: flex;
  min-height: 100vh;
  background: #0a0a0a;
}

/* ─── Sidebar ─────────────────────────────────────────────────── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #111;
  border-right: 1px solid #1e1e1e;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
  transition: transform 0.2s;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 18px 16px;
  border-bottom: 1px solid #1e1e1e;
}
.logo { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; }
.logo-pay { color: #e8e8e8; }
.logo-iq  { color: #f59e0b; }
.sidebar-close { display: none; background: none; border: none; color: #555; cursor: pointer; font-size: 14px; }

.nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 8px;
}
.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #3a3a3a;
  padding: 14px 10px 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  border-radius: 7px;
  font-size: 13px;
  color: #f1efef;
  transition: background 0.12s, color 0.12s;
  margin-bottom: 1px;
}
.nav-item:hover { background: #1a1a1a; color: #bbb; }
.nav-item--active { background: #1e1a10; color: #f59e0b; }
.nav-icon { font-size: 14px; width: 16px; text-align: center; }

.sidebar-footer {
  padding: 14px 12px;
  border-top: 1px solid #1e1e1e;
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-info { flex: 1; display: flex; align-items: center; gap: 9px; min-width: 0; }
.admin-avatar {
  width: 30px; height: 30px; flex-shrink: 0;
  background: #2a200a; color: #f59e0b;
  border-radius: 50%; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.admin-meta { min-width: 0; }
.admin-name { font-size: 12px; color: #bbb; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.admin-email { font-size: 10px; color: #b1acac; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.logout-btn {
  background: none; border: 1px solid #222; border-radius: 6px;
  color: #444; font-size: 14px; width: 30px; height: 30px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: color 0.12s, border-color 0.12s; flex-shrink: 0;
}
.logout-btn:hover { color: #f87171; border-color: #4a1f1f; }

/* ─── Main ────────────────────────────────────────────────────── */
.main {
  flex: 1;
  margin-left: 220px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.topbar {
  height: 52px;
  background: #0d0d0d;
  border-bottom: 1px solid #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 50;
}
.menu-btn { display: none; background: none; border: none; color: #666; cursor: pointer; font-size: 18px; }
.topbar-right { display: flex; align-items: center; gap: 12px; }
.env-badge {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #1a200a;
  color: #84cc16;
  border: 1px solid #2a3a10;
}

.page-content {
  padding: 28px 32px;
  flex: 1;
}

/* Sidebar overlay + mobile */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: #00000088;
  z-index: 90;
}

@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); }
  .sidebar-open { transform: translateX(0); }
  .sidebar-close { display: block; }
  .sidebar-overlay { display: block; }
  .main { margin-left: 0; }
  .menu-btn { display: block; }
  .page-content { padding: 20px 16px; }
}
</style>
