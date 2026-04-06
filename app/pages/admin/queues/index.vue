<template>
  <div>
    <div class="page-header">
      <h1 class="page-title">Queue Health</h1>
      <button class="refresh-btn" :class="{ spinning: pending }" @click="refresh">↻</button>
    </div>
    <p class="page-sub">{{ data?.generatedAt ? 'Last updated: ' + fmtDate(data.generatedAt) : 'Loading…' }}</p>

    <div class="queue-grid">
      <div v-for="q in data?.items ?? []" :key="q.name" class="queue-card">
        <div class="queue-name">{{ shortName(q.name) }}</div>
        <div class="queue-full-name">{{ q.name }}</div>
        <div class="metrics-grid">
          <div v-for="(val, key) in q.counts" :key="key" class="metric">
            <div class="metric-val" :class="metricClass(key, val)">{{ val }}</div>
            <div class="metric-key">{{ key }}</div>
          </div>
        </div>
        <div class="queue-health" :class="healthClass(q.counts)">
          {{ healthLabel(q.counts) }}
        </div>
      </div>
    </div>

    <div v-if="!pending && !data?.items?.length" class="empty">No queue data available</div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { data, pending, refresh } = await useFetch("/api/internal/queues/health", {
  transform: (d: any) => d,
})

function shortName(name: string) {
  return name.replace("payiq-", "").replace(/-/g, " ")
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}
function metricClass(key: string, val: number) {
  if (key === "failed" && val > 0) return "val-red"
  if (key === "active" && val > 0) return "val-amber"
  if (key === "waiting" && val > 10) return "val-amber"
  if (val > 0) return "val-normal"
  return "val-zero"
}
function healthClass(counts: Record<string, number>) {
  if ((counts.failed ?? 0) > 0) return "health-warn"
  if ((counts.active ?? 0) > 0 || (counts.waiting ?? 0) > 0) return "health-active"
  return "health-ok"
}
function healthLabel(counts: Record<string, number>) {
  if ((counts.failed ?? 0) > 0) return `${counts.failed} failed`
  if ((counts.active ?? 0) > 0) return `${counts.active} active`
  if ((counts.waiting ?? 0) > 0) return `${counts.waiting} waiting`
  return "idle"
}
</script>

<style scoped>
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.page-title { font-size: 22px; font-weight: 600; color: #f0f0f0; letter-spacing: -0.3px; }
.page-sub { font-size: 12px; color: #444; margin-bottom: 24px; }
.refresh-btn { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 7px; color: #666; font-size: 18px; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: color 0.15s; }
.refresh-btn:hover { color: #f59e0b; }
.refresh-btn.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.queue-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }
.queue-card { background: #141414; border: 1px solid #1e1e1e; border-radius: 12px; padding: 18px 20px; }
.queue-name { font-size: 14px; font-weight: 600; color: #e0e0e0; text-transform: capitalize; margin-bottom: 2px; }
.queue-full-name { font-size: 10px; color: #383838; font-family: 'DM Mono', monospace; margin-bottom: 16px; }

.metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.metric { text-align: center; }
.metric-val { font-size: 20px; font-weight: 700; margin-bottom: 3px; }
.metric-key { font-size: 10px; color: #444; text-transform: capitalize; }
.val-red    { color: #ef4444; }
.val-amber  { color: #f59e0b; }
.val-normal { color: #bbb; }
.val-zero   { color: #333; }

.queue-health { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 5px; display: inline-block; letter-spacing: 0.3px; }
.health-ok     { background: #0f2a1a; color: #22c55e; border: 1px solid #155233; }
.health-active { background: #2a1f0a; color: #f59e0b; border: 1px solid #523a0f; }
.health-warn   { background: #2a0f0f; color: #ef4444; border: 1px solid #521515; }
.empty { text-align: center; color: #444; padding: 60px; font-size: 14px; }
</style>
