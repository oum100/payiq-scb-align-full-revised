<template>
  <div>
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">{{ today }}</p>
      </div>
      <button class="refresh-btn" :class="{ spinning: pending }" title="Refresh" @click="() => refresh()">↻</button>
    </div>

    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Revenue (all time)</div>
        <div class="stat-value">฿{{ fmtAmount(stats?.totalRevenueTHB) }}</div>
        <div class="stat-sub">{{ fmtNum(stats?.totalPayments) }} payments total</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Payments (24h)</div>
        <div class="stat-value">{{ fmtNum(stats?.payments24h) }}</div>
        <div class="stat-sub stat-green">{{ stats?.succeededToday ?? 0 }} succeeded</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Success rate (24h)</div>
        <div class="stat-value" :class="rateClass">{{ stats?.successRate24h ?? 0 }}%</div>
        <div class="stat-sub stat-red">{{ stats?.failedToday ?? 0 }} failed today</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pending callbacks</div>
        <div class="stat-value" :class="stats?.pendingCallbacks ? 'val-amber' : ''">
          {{ fmtNum(stats?.pendingCallbacks) }}
        </div>
        <div class="stat-sub">Dead webhooks: {{ stats?.deadWebhooks ?? 0 }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active merchants</div>
        <div class="stat-value">{{ fmtNum(stats?.activeMerchants) }}</div>
        <div class="stat-sub">{{ stats?.activeApiKeys ?? 0 }} active API keys</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row">
      <!-- Revenue bar chart -->
      <div class="chart-card">
        <div class="chart-title">Revenue — last 7 days (THB)</div>
        <div class="bar-chart">
          <template v-for="(d, i) in revenueChart" :key="i">
            <div class="bar-col">
              <div class="bar" :style="{ height: barHeight(d.revenue) + 'px' }"
                :title="`฿${fmtAmount(d.revenue)} · ${d.count} txns`" />
              <div class="bar-label">{{ shortDate(d.date) }}</div>
            </div>
          </template>
        </div>
      </div>

      <!-- Status distribution donut -->
      <div class="chart-card">
        <div class="chart-title">Status distribution (24h)</div>
        <div class="dist-list">
          <div v-for="row in statusDistribution" :key="row.status" class="dist-row">
            <span class="dist-dot" :style="{ background: statusColor(row.status) }" />
            <span class="dist-status">{{ row.status }}</span>
            <span class="dist-bar-wrap">
              <span class="dist-bar-fill" :style="{
                width: distPct(row.count) + '%',
                background: statusColor(row.status),
              }" />
            </span>
            <span class="dist-count">{{ row.count }}</span>
          </div>
          <div v-if="!statusDistribution?.length" class="dist-empty">No payments in last 24h</div>
        </div>
      </div>
    </div>

    <!-- Quick links -->
    <div class="quick-links">
      <NuxtLink to="/admin/payments" class="qlink">
        <span class="qlink-icon">◈</span>
        <span>View all payments</span>
      </NuxtLink>
      <NuxtLink to="/admin/callbacks" class="qlink">
        <span class="qlink-icon">↺</span>
        <span>Callbacks monitor</span>
      </NuxtLink>
      <NuxtLink to="/admin/webhooks" class="qlink">
        <span class="qlink-icon">⇗</span>
        <span>Webhook deliveries</span>
      </NuxtLink>
      <NuxtLink to="/admin/queues" class="qlink">
        <span class="qlink-icon">⧖</span>
        <span>Queue health</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { data, pending, refresh } = await useFetch("/api/admin/dashboard/stats", { lazy: false })

const stats = computed(() => (data.value as any)?.stats)
const revenueChart = computed(() => (data.value as any)?.revenueChart ?? [])
const statusDistribution = computed(() => (data.value as any)?.statusDistribution ?? [])

const today = new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

function fmtAmount(v?: number) {
  if (v == null) return "0.00"
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtNum(v?: number) {
  return (v ?? 0).toLocaleString()
}

const rateClass = computed(() => {
  const r = stats.value?.successRate24h ?? 0
  if (r >= 90) return "val-green"
  if (r >= 70) return "val-amber"
  return "val-red"
})

// Bar chart helpers
const maxRevenue = computed(() => Math.max(...revenueChart.value.map((d: any) => d.revenue), 1))
function barHeight(v: number) {
  return Math.max(4, Math.round((v / maxRevenue.value) * 80))
}
function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

// Distribution helpers
const totalDist = computed(() => statusDistribution.value.reduce((s: number, r: any) => s + r.count, 0))
function distPct(count: number) {
  return totalDist.value ? Math.round((count / totalDist.value) * 100) : 0
}
const STATUS_COLORS: Record<string, string> = {
  SUCCEEDED: "#22c55e", AWAITING_CUSTOMER: "#f59e0b", CREATED: "#60a5fa",
  PROCESSING: "#a78bfa", PENDING_PROVIDER: "#fb923c", ROUTING: "#94a3b8",
  FAILED: "#ef4444", EXPIRED: "#6b7280", CANCELLED: "#6b7280",
}
function statusColor(s: string) { return STATUS_COLORS[s] ?? "#555" }
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 24px;
}

.page-title {
  font-size: 32px;
  font-weight: 600;
  color: #acabab;
  letter-spacing: -0.3px;
}

.page-sub {
  font-size: 13px;
  color: #575555;
  margin-top: 4px;
}

.refresh-btn {
  background: #353535;
  border: 1px solid #2a2a2a;
  border-radius: 7px;
  color: #866f6f;
  font-size: 18px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s;
  flex-shrink: 0;
  margin-top: 4px;
}

.refresh-btn:hover {
  color: #f59e0b;
}

.refresh-btn.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

.stat-card {
  background: #141414;
  border: 1px solid #1e1e1e;
  border-radius: 12px;
  padding: 18px 20px;
}

.stat-label {
  font-size: 11px;
  color: #acabab;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 26px;
  font-weight: 700;
  color: #f0f0f0;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}

.stat-sub {
  font-size: 12px;
  color: #acabab;
}

.stat-green {
  color: #22c55e;
}

.stat-red {
  color: #ef4444;
}

.val-green {
  color: #22c55e;
}

.val-amber {
  color: #f59e0b;
}

.val-red {
  color: #ef4444;
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 24px;
}

@media (max-width: 860px) {
  .charts-row {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  background: #373636;
  border: 1px solid #acabab;
  border-radius: 12px;
  padding: 20px;
}

.chart-title {
  font-size: 12px;
  color: #acabab;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
}

.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 96px;
}

.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bar {
  width: 100%;
  background: #f59e0b33;
  border-radius: 4px 4px 0 0;
  border: 1px solid #f59e0b66;
  min-height: 4px;
  transition: height 0.3s;
  cursor: default;
}

.bar:hover {
  background: #f59e0b55;
}

.bar-label {
  font-size: 10px;
  color: #acabab;
  white-space: nowrap;
}

.dist-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dist-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dist-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dist-status {
  font-size: 12px;
  color: #888;
  width: 140px;
  flex-shrink: 0;
}

.dist-bar-wrap {
  flex: 1;
  height: 4px;
  background: #1e1e1e;
  border-radius: 2px;
  overflow: hidden;
}

.dist-bar-fill {
  display: block;
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s;
}

.dist-count {
  font-size: 12px;
  color: #555;
  width: 30px;
  text-align: right;
  flex-shrink: 0;
}

.dist-empty {
  font-size: 13px;
  color: #444;
  text-align: center;
  padding: 20px 0;
}

.quick-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}

.qlink {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #141414;
  border: 1px solid #1e1e1e;
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 13px;
  color: #acabab;
  transition: border-color 0.15s, color 0.15s;
}

.qlink:hover {
  border-color: #333;
  color: #f59e0b;
}

.qlink-icon {
  font-size: 16px;
}
</style>
