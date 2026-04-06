<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">API Keys</h1>
      <button class="btn-primary" @click="showCreate = true">+ New API Key</button>
    </div>

    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr><th>Prefix</th><th>Name</th><th>Status</th><th>Environment</th><th>Scopes</th><th>Merchant</th><th>Last used</th><th>Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="k in items" :key="k.id" class="table-row">
            <td class="td-mono">{{ k.keyPrefix }}</td>
            <td class="td-label">{{ k.name }}</td>
            <td><span class="status-badge" :class="k.status === 'ACTIVE' ? 's-green' : 's-gray'">{{ k.status }}</span></td>
            <td><span class="env-badge" :class="k.environment === 'LIVE' ? 'env-live' : 'env-test'">{{ k.environment }}</span></td>
            <td class="td-scopes">
              <span v-for="sc in k.scopes" :key="sc" class="scope-tag">{{ sc }}</span>
            </td>
            <td class="td-muted">{{ k.merchantAccount?.name ?? "Tenant-level" }}</td>
            <td class="td-muted">{{ k.lastUsedAt ? fmtDate(k.lastUsedAt) : "Never" }}</td>
            <td class="td-actions">
              <button v-if="k.status === 'ACTIVE'" class="action-btn action-revoke" @click="revoke(k.id)">Revoke</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="8" class="td-empty">No API keys found</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-title">Create API Key</div>
        <div class="form-field">
          <label>Name</label>
          <input v-model="form.name" placeholder="e.g. Production key" />
        </div>
        <div class="form-field">
          <label>Scopes</label>
          <div class="scope-checkboxes">
            <label v-for="s in ALL_SCOPES" :key="s" class="scope-check">
              <input type="checkbox" :value="s" v-model="form.scopes" /> {{ s }}
            </label>
          </div>
        </div>
        <div class="form-field">
          <label>Environment</label>
          <select v-model="form.environment">
            <option value="TEST">TEST</option>
            <option value="LIVE">LIVE</option>
          </select>
        </div>
        <div v-if="createdKey" class="new-key-banner">
          <div class="new-key-label">⚠ Copy this key — it won't be shown again</div>
          <code class="new-key-val">{{ createdKey }}</code>
          <button class="copy-btn" @click="copy(createdKey)">{{ copied ? "Copied!" : "Copy" }}</button>
        </div>
        <div class="modal-actions">
          <button class="btn-ghost" @click="closeCreate">Close</button>
          <button v-if="!createdKey" class="btn-primary" :disabled="!form.name || !form.scopes.length || creating" @click="createKey">
            {{ creating ? "Creating…" : "Create" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const ALL_SCOPES = ["payments:create","payments:read","api_keys:manage","webhooks:manage"]

const showCreate = ref(false)
const creating = ref(false)
const createdKey = ref("")
const copied = ref(false)
const form = reactive({ name: "", scopes: [] as string[], environment: "TEST" })

const { data, pending, refresh } = await useFetch("/api/v1/api-keys")
const items = computed(() => (data.value as any)?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

async function createKey() {
  if (!form.name || !form.scopes.length) return
  creating.value = true
  try {
    const res = await $fetch<any>("/api/v1/api-keys", {
      method: "POST",
      body: { name: form.name, scopes: form.scopes, environment: form.environment },
    })
    createdKey.value = res.fullKey
    await refresh()
  } catch (e: any) {
    alert(e?.data?.message ?? "Failed to create key")
  } finally {
    creating.value = false
  }
}

async function revoke(id: string) {
  if (!confirm("Revoke this API key? This cannot be undone.")) return
  await $fetch(`/api/v1/api-keys/${id}/revoke`, { method: "POST" })
  await refresh()
}

function closeCreate() {
  showCreate.value = false; createdKey.value = ""; copied.value = false
  form.name = ""; form.scopes = []; form.environment = "TEST"
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; }
.btn-primary { background: #f59e0b; color: #0a0a0a; border: none; border-radius: 7px; padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; transition: opacity 0.15s; }
.btn-primary:hover:not(:disabled) { opacity: 0.88; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-ghost { background: transparent; border: 1px solid #2a2a2a; border-radius: 7px; color: #666; font-size: 13px; padding: 9px 16px; cursor: pointer; font-family: inherit; transition: color 0.15s; }
.btn-ghost:hover { color: #aaa; }
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
.td-scopes { display: flex; flex-wrap: wrap; gap: 4px; }
.td-actions { white-space: nowrap; }
.scope-tag { font-size: 10px; background: #1a1a2a; color: #60a5fa; border: 1px solid #1e2a40; border-radius: 4px; padding: 2px 6px; }
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
.s-green { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-gray  { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
.env-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; }
.env-live { background: #0f2a1a; color: #22c55e; }
.env-test { background: #1a1a2a; color: #60a5fa; }
.action-btn { font-size: 11px; padding: 4px 10px; border-radius: 5px; cursor: pointer; border: 1px solid; font-family: inherit; transition: opacity 0.15s; }
.action-revoke { background: #2a0f0f; color: #ef4444; border-color: #521515; }
.action-revoke:hover { opacity: 0.8; }
.modal-overlay { position: fixed; inset: 0; background: #00000088; z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: #161616; border: 1px solid #2a2a2a; border-radius: 14px; padding: 28px; width: 100%; max-width: 440px; }
.modal-title { font-size: 16px; font-weight: 600; color: #f0f0f0; margin-bottom: 22px; }
.form-field { margin-bottom: 16px; }
.form-field label { display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 500; }
.form-field input, .form-field select { width: 100%; background: #0f0f0f; border: 1px solid #2a2a2a; border-radius: 7px; color: #ccc; font-size: 13px; padding: 9px 12px; outline: none; font-family: inherit; box-sizing: border-box; }
.scope-checkboxes { display: flex; flex-wrap: wrap; gap: 8px; }
.scope-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #888; cursor: pointer; }
.scope-check input { width: auto; }
.new-key-banner { background: #1a1500; border: 1px solid #3a2f00; border-radius: 8px; padding: 14px; margin: 16px 0; }
.new-key-label { font-size: 12px; color: #f59e0b; margin-bottom: 8px; font-weight: 600; }
.new-key-val { display: block; font-family: 'DM Mono', monospace; font-size: 12px; color: #d0d0d0; word-break: break-all; margin-bottom: 10px; }
.copy-btn { background: #2a2200; border: 1px solid #3a3000; border-radius: 5px; color: #f59e0b; font-size: 12px; padding: 5px 12px; cursor: pointer; font-family: inherit; }
.modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
</style>
