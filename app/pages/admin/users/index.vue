<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Admin Users</h1>
      <button class="btn-primary" @click="showCreate = true">+ Add Admin</button>
    </div>

    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr><th>Name</th><th>Email</th><th>Status</th><th>Active sessions</th><th>Last login</th><th>Created</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="u in items" :key="u.id" class="table-row">
            <td class="td-label">{{ u.name ?? "—" }}</td>
            <td class="td-mono">{{ u.email }}</td>
            <td><span class="status-badge" :class="u.isActive ? 's-green' : 's-gray'">{{ u.isActive ? "Active" : "Inactive" }}</span></td>
            <td class="td-muted">{{ u._count?.sessions ?? 0 }}</td>
            <td class="td-muted">{{ u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Never" }}</td>
            <td class="td-muted">{{ fmtDate(u.createdAt) }}</td>
            <td class="td-actions">
              <button v-if="u.email !== me?.email" class="action-btn" :class="u.isActive ? 'action-deactivate' : 'action-activate'" @click="toggleActive(u)">
                {{ u.isActive ? "Deactivate" : "Activate" }}
              </button>
              <span v-else class="td-you">You</span>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="7" class="td-empty">No admin users</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="closeCreate">
      <div class="modal">
        <div class="modal-title">Add Admin User</div>
        <div class="form-field">
          <label>Email</label>
          <input v-model="form.email" type="email" placeholder="admin@company.com" />
        </div>
        <div class="form-field">
          <label>Name (optional)</label>
          <input v-model="form.name" placeholder="Full name" />
        </div>
        <div v-if="createError" class="error-msg">{{ createError }}</div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="closeCreate">Cancel</button>
          <button class="btn-primary" :disabled="!form.email || creating" @click="createUser">
            {{ creating ? "Adding…" : "Add User" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { admin: me } = useAdmin()
const showCreate = ref(false)
const creating = ref(false)
const createError = ref("")
const form = reactive({ email: "", name: "" })

const { data, pending, refresh } = await useFetch("/api/admin/users")
const items = computed(() => (data.value as any)?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

async function createUser() {
  if (!form.email) return
  creating.value = true; createError.value = ""
  try {
    await $fetch("/api/admin/users", { method: "POST", body: { email: form.email, name: form.name || undefined } })
    await refresh()
    closeCreate()
  } catch (e: any) {
    createError.value = e?.data?.message ?? "Failed to add user"
  } finally {
    creating.value = false
  }
}

async function toggleActive(u: any) {
  const action = u.isActive ? "Deactivate" : "Activate"
  if (!confirm(`${action} ${u.email}?`)) return
  await $fetch(`/api/admin/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } })
  await refresh()
}

function closeCreate() {
  showCreate.value = false; form.email = ""; form.name = ""; createError.value = ""
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; }
.btn-primary { background: #f59e0b; color: #0a0a0a; border: none; border-radius: 7px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { background: transparent; border: 1px solid #2a2a2a; border-radius: 7px; color: #666; font-size: 13px; padding: 9px 16px; cursor: pointer; font-family: inherit; }
.table-wrap { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; }
.table { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid #1e1e1e; }
.table th { padding: 12px 14px; font-size: 11px; font-weight: 600; color: #444; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
.table-row { border-bottom: 1px solid #1a1a1a; }
.table-row:last-child { border-bottom: none; }
td { padding: 11px 14px; font-size: 13px; color: #bbb; vertical-align: middle; }
.td-mono { font-family: 'DM Mono', monospace; font-size: 12px; color: #888; }
.td-label { font-weight: 500; color: #d0d0d0; }
.td-muted { color: #666; font-size: 12px; }
.td-empty, .table-loading { text-align: center; color: #444; padding: 40px; font-size: 14px; }
.td-actions { white-space: nowrap; }
.td-you { font-size: 11px; color: #444; font-style: italic; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
.s-green { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-gray  { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
.action-btn { font-size: 11px; padding: 4px 10px; border-radius: 5px; cursor: pointer; border: 1px solid; font-family: inherit; }
.action-deactivate { background: #2a0f0f; color: #ef4444; border-color: #521515; }
.action-activate   { background: #0f2a1a; color: #22c55e; border-color: #155233; }
.modal-overlay { position: fixed; inset: 0; background: #00000088; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: #161616; border: 1px solid #2a2a2a; border-radius: 14px; padding: 28px; width: 100%; max-width: 400px; }
.modal-title { font-size: 16px; font-weight: 600; color: #f0f0f0; margin-bottom: 22px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; font-size: 12px; color: #666; margin-bottom: 6px; }
.form-field input { width: 100%; background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 7px; color: #ccc; font-size: 13px; padding: 9px 12px; outline: none; font-family: inherit; box-sizing: border-box; }
.error-msg { font-size: 12px; color: #ef4444; margin-bottom: 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
