<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Merchants</h1>
    </div>

    <div class="table-wrap">
      <div v-if="pending" class="table-loading">Loading…</div>
      <table v-else class="table">
        <thead>
          <tr><th>Name</th><th>Code</th><th>Tenant</th><th>Status</th><th>Env</th><th>Payments</th><th>API Keys</th><th>Webhooks</th><th>Created</th></tr>
        </thead>
        <tbody>
          <tr v-for="m in items" :key="m.id" class="table-row">
            <td class="td-label">{{ m.name }}</td>
            <td class="td-mono">{{ m.code }}</td>
            <td class="td-muted">{{ m.tenant?.name ?? m.tenant?.code ?? "—" }}</td>
            <td><span class="status-badge" :class="m.status === 'ACTIVE' ? 's-green' : 's-gray'">{{ m.status }}</span></td>
            <td><span class="env-badge" :class="m.environment === 'LIVE' ? 'env-live' : 'env-test'">{{ m.environment }}</span></td>
            <td class="td-muted">{{ m._count?.paymentIntents ?? 0 }}</td>
            <td class="td-muted">{{ m._count?.apiKeys ?? 0 }}</td>
            <td class="td-muted">{{ m._count?.webhookEndpoints ?? 0 }}</td>
            <td class="td-muted">{{ fmtDate(m.createdAt) }}</td>
          </tr>
          <tr v-if="!items.length"><td colspan="9" class="td-empty">No merchants found</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { data, pending } = await useFetch("/api/admin/merchants")
const items = computed(() => (data.value as any)?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.page-title { font-size: 22px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; }
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
.status-badge { display: inline-block; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px; }
.s-green { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.s-gray  { background: #1a1a1a; color: #666; border: 1px solid #2a2a2a; }
.env-badge { display: inline-block; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.5px; }
.env-live { background: #0f2a1a; color: #22c55e; }
.env-test { background: #1a1a2a; color: #60a5fa; }
</style>
