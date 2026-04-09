<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Tenants</h1>
        <p class="page-sub">{{ items.length }} tenant{{ items.length !== 1 ? 's' : '' }} registered</p>
      </div>
      <button class="create-btn" @click="openCreate">+ New Tenant</button>
    </div>

    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Name / Code</th>
            <th>Status</th>
            <th>Merchants</th>
            <th>Billers</th>
            <th>Routes</th>
            <th>API Keys</th>
            <th>Payments</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in items" :key="t.id" class="table-row">
            <td>
              <div class="td-label">{{ t.name }}</div>
              <div class="td-mono">{{ t.code }}</div>
            </td>
            <td>
              <span class="status-badge" :class="statusClass(t.status)">{{ t.status }}</span>
            </td>
            <td class="td-num">{{ t._count?.merchants ?? 0 }}</td>
            <td class="td-num">{{ t._count?.billerProfiles ?? 0 }}</td>
            <td class="td-num">{{ t._count?.paymentRoutes ?? 0 }}</td>
            <td class="td-num">{{ t._count?.apiKeys ?? 0 }}</td>
            <td class="td-num">{{ t._count?.paymentIntents ?? 0 }}</td>
            <td class="td-muted">{{ fmtDate(t.createdAt) }}</td>
            <td>
              <button class="action-btn" title="Edit" @click="openEdit(t)">✎</button>
            </td>
          </tr>
          <tr v-if="!items.length">
            <td colspan="9" class="td-empty">No tenants yet — create one to get started</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">{{ modal.mode === 'create' ? 'New Tenant' : 'Edit Tenant' }}</h2>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <form class="modal-body" @submit.prevent="submitModal">
          <div class="field">
            <label class="field-label">Name</label>
            <input v-model="form.name" class="field-input" placeholder="e.g. Acme Corp" required />
          </div>
          <div v-if="modal.mode === 'create'" class="field">
            <label class="field-label">Code <span class="field-hint">(lowercase · unique · immutable)</span></label>
            <input v-model="form.code" class="field-input" placeholder="e.g. acme" pattern="[a-z0-9_-]+" required />
          </div>
          <div v-else class="field">
            <label class="field-label">Code</label>
            <div class="field-readonly">{{ modal.tenant?.code }}</div>
          </div>
          <div v-if="modal.mode === 'edit'" class="field">
            <label class="field-label">Status</label>
            <select v-model="form.status" class="field-input">
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </div>
          <div v-if="formError" class="form-error">{{ formError }}</div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="closeModal">Cancel</button>
            <button type="submit" class="btn-submit" :disabled="submitting">
              {{ submitting ? 'Saving…' : modal.mode === 'create' ? 'Create' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth' })

type TenantRow = {
  id: string; code: string; name: string; status: string; createdAt: string
  _count: { merchants: number; billerProfiles: number; paymentRoutes: number; apiKeys: number; paymentIntents: number }
}

const { data, pending, refresh } = await useFetch<{ items: TenantRow[] }>('/api/admin/tenants')
const items = computed(() => data.value?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function statusClass(s: string) {
  if (s === 'ACTIVE') return 's-green'
  if (s === 'SUSPENDED') return 's-amber'
  return 's-gray'
}

const modal = reactive<{ open: boolean; mode: 'create' | 'edit'; tenant: TenantRow | null }>({
  open: false, mode: 'create', tenant: null,
})
const form = reactive({ name: '', code: '', status: 'ACTIVE' })
const submitting = ref(false)
const formError = ref('')

function openCreate() {
  modal.mode = 'create'; modal.tenant = null
  form.name = ''; form.code = ''; form.status = 'ACTIVE'
  formError.value = ''; modal.open = true
}
function openEdit(t: TenantRow) {
  modal.mode = 'edit'; modal.tenant = t
  form.name = t.name; form.code = t.code; form.status = t.status
  formError.value = ''; modal.open = true
}
function closeModal() { modal.open = false }

async function submitModal() {
  formError.value = ''; submitting.value = true
  try {
    if (modal.mode === 'create') {
      await $fetch('/api/admin/tenants', { method: 'POST', body: { code: form.code, name: form.name } })
    } else {
      await $fetch(`/api/admin/tenants/${modal.tenant!.id}`, { method: 'PATCH', body: { name: form.name, status: form.status } })
    }
    await refresh(); closeModal()
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}
</script>

<style scoped>
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.page-title  { font-size: 22px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; }
.page-sub    { font-size: 13px; color: #575555; margin-top: 4px; }
.create-btn  { background: #1e1a10; border: 1px solid #f59e0b44; border-radius: 8px; color: #f59e0b; font-size: 13px; font-weight: 500; padding: 8px 16px; cursor: pointer; }
.create-btn:hover { background: #2a2010; }

.table-wrap  { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; overflow: hidden; }
.table       { width: 100%; border-collapse: collapse; }
.table thead tr { border-bottom: 1px solid #1e1e1e; }
.table th    { padding: 12px 14px; font-size: 11px; font-weight: 600; color: #444; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
.table-row   { border-bottom: 1px solid #1a1a1a; }
.table-row:last-child { border-bottom: none; }
td           { padding: 11px 14px; font-size: 13px; color: #bbb; vertical-align: middle; }
.td-label    { font-weight: 500; color: #d0d0d0; }
.td-mono     { font-family: 'DM Mono', monospace; font-size: 11px; color: #555; margin-top: 2px; }
.td-muted    { color: #555; font-size: 12px; }
.td-num      { color: #666; font-size: 12px; text-align: center; }
.td-empty, .table-loading { text-align: center; color: #444; padding: 48px; font-size: 14px; }

.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
.s-green { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-amber { background: #2a1a00; color: #f59e0b; border: 1px solid #44310a; }
.s-gray  { background: #1a1a1a; color: #555;    border: 1px solid #2a2a2a; }

.action-btn { background: none; border: 1px solid #222; border-radius: 6px; color: #555; font-size: 13px; width: 28px; height: 28px; cursor: pointer; }
.action-btn:hover { color: #f59e0b; border-color: #f59e0b44; }

.modal-overlay { position: fixed; inset: 0; background: #00000088; display: flex; align-items: center; justify-content: center; z-index: 200; }
.modal         { background: #111; border: 1px solid #222; border-radius: 14px; width: 100%; max-width: 440px; overflow: hidden; }
.modal-header  { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid #1e1e1e; }
.modal-title   { font-size: 16px; font-weight: 600; color: #e8e8e8; }
.modal-close   { background: none; border: none; color: #555; cursor: pointer; font-size: 14px; padding: 2px 6px; }
.modal-close:hover { color: #aaa; }
.modal-body    { padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.field         { display: flex; flex-direction: column; gap: 6px; }
.field-label   { font-size: 12px; font-weight: 500; color: #888; }
.field-hint    { font-size: 11px; color: #444; font-weight: 400; }
.field-input   { background: #0d0d0d; border: 1px solid #222; border-radius: 8px; color: #e0e0e0; font-size: 13px; padding: 9px 12px; outline: none; }
.field-input:focus { border-color: #f59e0b55; }
.field-readonly { background: #0a0a0a; border: 1px solid #1a1a1a; border-radius: 8px; color: #555; font-size: 13px; padding: 9px 12px; font-family: monospace; }
.form-error    { font-size: 12px; color: #ef4444; background: #1a0a0a; border: 1px solid #3a1515; border-radius: 7px; padding: 9px 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
.btn-cancel    { background: none; border: 1px solid #222; border-radius: 7px; color: #666; font-size: 13px; padding: 8px 16px; cursor: pointer; }
.btn-cancel:hover { border-color: #333; color: #999; }
.btn-submit    { background: #1e1a10; border: 1px solid #f59e0b55; border-radius: 7px; color: #f59e0b; font-size: 13px; font-weight: 500; padding: 8px 20px; cursor: pointer; }
.btn-submit:hover:not(:disabled) { background: #2a2010; }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
