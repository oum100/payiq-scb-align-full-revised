<script setup lang="ts">
type DeliveryRow = {
  id: string;
  eventType: string;
  status: string;
  attemptNumber: number;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  lastErrorAt: string | null;
  targetUrlSnapshot: string | null;
  timeoutMsSnapshot?: number | null;
  responseStatusCode: number | null;
  responseHeaders?: Record<string, string> | null;
  responseBody?: string | null;
  requestHeaders?: Record<string, string> | null;
  requestBody?: unknown;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  paymentIntent?: {
    publicId: string;
    merchantReference: string | null;
    merchantOrderId?: string | null;
    status: string;
    providerReference?: string | null;
    providerTransactionId?: string | null;
  } | null;
  webhookEndpoint?: {
    id?: string;
    code: string;
    url: string;
    maxAttempts: number;
    timeoutMs: number;
    status?: string;
  } | null;
};

type ListResponse = {
  items: DeliveryRow[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filtersApplied?: Record<string, unknown>;
};

type SummaryResponse = {
  generatedAt: string;
  summary: {
    total: number;
    delivered: number;
    retrying: number;
    dead: number;
    processing: number;
    pending: number;
    last24h: number;
    last24hDelivered: number;
    last24hDead: number;
  };
};

const filters = reactive({
  page: 1,
  pageSize: 20,
  status: "",
  eventType: "",
  merchantReference: "",
  publicId: "",
});

const redrivePending = ref(false);
const redriveMessage = ref("");
const redriveError = ref("");

const queryParams = computed(() => ({
  page: filters.page,
  pageSize: filters.pageSize,
  ...(filters.status ? { status: filters.status } : {}),
  ...(filters.eventType ? { eventType: filters.eventType } : {}),
  ...(filters.merchantReference
    ? { merchantReference: filters.merchantReference }
    : {}),
  ...(filters.publicId ? { publicId: filters.publicId } : {}),
}));

const {
  data: listData,
  pending: listPending,
  error: listError,
  refresh: refreshList,
} = await useFetch<ListResponse>("/api/internal/webhook-deliveries", {
  query: queryParams,
  watch: [queryParams],
});

const {
  data: summaryData,
  pending: summaryPending,
  error: summaryError,
  refresh: refreshSummary,
} = await useFetch<SummaryResponse>(
  "/api/internal/webhook-deliveries/summary",
);

const selected = ref<DeliveryRow | null>(null);

const rows = computed(() => listData.value?.items ?? []);
const pagination = computed(
  () =>
    listData.value?.pagination ?? {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    },
);

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function prettyJson(value: unknown): string {
  if (value == null) return "-";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function badgeClass(status: string): string {
  switch (status) {
    case "DELIVERED":
      return "badge delivered";
    case "RETRYING":
      return "badge retrying";
    case "DEAD":
      return "badge dead";
    case "PROCESSING":
      return "badge processing";
    case "PENDING":
      return "badge pending";
    default:
      return "badge";
  }
}

function displayResponseText(item: DeliveryRow): string {
  if (item.status === "DELIVERED") return String(item.responseStatusCode ?? 200);
  if (item.responseStatusCode == null) return "-";
  return String(item.responseStatusCode);
}

function displayErrorText(item: DeliveryRow): string {
  if (item.status === "DELIVERED") return "-";
  return item.errorMessage || "-";
}

function canRedrive(item: DeliveryRow | null): boolean {
  if (!item) return false;
  return item.status === "DEAD" || item.status === "RETRYING";
}

async function refreshAll() {
  await Promise.all([refreshList(), refreshSummary()]);
}

function applyFilters() {
  filters.page = 1;
  selected.value = null;
}

function resetFilters() {
  filters.page = 1;
  filters.pageSize = 20;
  filters.status = "";
  filters.eventType = "";
  filters.merchantReference = "";
  filters.publicId = "";
  selected.value = null;
  redriveMessage.value = "";
  redriveError.value = "";
}

function nextPage() {
  if (filters.page < pagination.value.totalPages) {
    filters.page += 1;
    selected.value = null;
  }
}

function prevPage() {
  if (filters.page > 1) {
    filters.page -= 1;
    selected.value = null;
  }
}

async function retrySelected() {
  if (!selected.value || !canRedrive(selected.value) || redrivePending.value) {
    return;
  }

  redrivePending.value = true;
  redriveMessage.value = "";
  redriveError.value = "";

  try {
    const result = await $fetch<{
      ok: boolean;
      id: string;
      previousStatus: string;
      enqueued: boolean;
    }>(`/api/internal/webhook-deliveries/${selected.value.id}/redrive`, {
      method: "POST",
    });

    redriveMessage.value = `Redrive queued for ${result.id} (previous status: ${result.previousStatus})`;

    await refreshAll();

    const updated = rows.value.find((row) => row.id === selected.value?.id);
    if (updated) {
      selected.value = updated;
    }
  } catch (error) {
    redriveError.value =
      error instanceof Error ? error.message : "Failed to redrive delivery";
  } finally {
    redrivePending.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="header">
      <div>
        <h1>Webhook Delivery Dashboard</h1>
        <p>Inspect delivered, retrying, dead deliveries and redrive them safely.</p>
      </div>

      <button class="button" @click="refreshAll">Refresh</button>
    </div>

    <div class="summary-grid">
      <div class="card">
        <div class="label">Total</div>
        <div class="value">{{ summaryPending ? "..." : summaryData?.summary.total ?? 0 }}</div>
      </div>
      <div class="card">
        <div class="label">Delivered</div>
        <div class="value success">
          {{ summaryPending ? "..." : summaryData?.summary.delivered ?? 0 }}
        </div>
      </div>
      <div class="card">
        <div class="label">Retrying</div>
        <div class="value warning">
          {{ summaryPending ? "..." : summaryData?.summary.retrying ?? 0 }}
        </div>
      </div>
      <div class="card">
        <div class="label">Dead</div>
        <div class="value danger">
          {{ summaryPending ? "..." : summaryData?.summary.dead ?? 0 }}
        </div>
      </div>
      <div class="card">
        <div class="label">Last 24h</div>
        <div class="value">
          {{ summaryPending ? "..." : summaryData?.summary.last24h ?? 0 }}
        </div>
      </div>
      <div class="card">
        <div class="label">Last 24h Dead</div>
        <div class="value danger">
          {{ summaryPending ? "..." : summaryData?.summary.last24hDead ?? 0 }}
        </div>
      </div>
    </div>

    <div v-if="summaryError" class="error-box">
      {{ summaryError.message }}
    </div>

    <div class="filters card">
      <div class="filters-grid">
        <label>
          <span>Status</span>
          <select v-model="filters.status">
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="PROCESSING">PROCESSING</option>
            <option value="RETRYING">RETRYING</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="DEAD">DEAD</option>
          </select>
        </label>

        <label>
          <span>Event Type</span>
          <input v-model="filters.eventType" type="text" placeholder="PAYMENT_SUCCEEDED" />
        </label>

        <label>
          <span>Merchant Reference</span>
          <input v-model="filters.merchantReference" type="text" placeholder="order-001" />
        </label>

        <label>
          <span>Public ID</span>
          <input v-model="filters.publicId" type="text" placeholder="piq_xxx" />
        </label>

        <label>
          <span>Page Size</span>
          <select v-model.number="filters.pageSize">
            <option :value="10">10</option>
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>
      </div>

      <div class="actions">
        <button class="button primary" @click="applyFilters">Apply</button>
        <button class="button" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="listError" class="error-box">
      {{ listError.message }}
    </div>

    <div v-if="redriveMessage" class="success-box">
      {{ redriveMessage }}
    </div>

    <div v-if="redriveError" class="error-box">
      {{ redriveError }}
    </div>

    <div class="layout">
      <div class="card">
        <div class="table-header">
          <h2>Deliveries</h2>
          <span>{{ listPending ? "Loading..." : `${pagination.total} records` }}</span>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Event</th>
                <th>Merchant Reference</th>
                <th>Attempt</th>
                <th>Response</th>
                <th>Created</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in rows"
                :key="item.id"
                @click="selected = item"
                :class="{ selected: selected?.id === item.id }"
              >
                <td>
                  <span :class="badgeClass(item.status)">{{ item.status }}</span>
                </td>
                <td>
                  <div>{{ item.eventType }}</div>
                  <div class="mono small">{{ item.id }}</div>
                </td>
                <td>
                  <div>{{ item.paymentIntent?.merchantReference || "-" }}</div>
                  <div class="mono small">{{ item.paymentIntent?.publicId || "-" }}</div>
                </td>
                <td>{{ item.attemptNumber }}</td>
                <td>
                  <div>{{ displayResponseText(item) }}</div>
                  <div class="small muted">{{ displayErrorText(item) }}</div>
                </td>
                <td>{{ formatDate(item.createdAt) }}</td>
                <td class="mono small">
                  {{ item.targetUrlSnapshot || item.webhookEndpoint?.url || "-" }}
                </td>
              </tr>

              <tr v-if="!listPending && rows.length === 0">
                <td colspan="7" class="empty">No deliveries found</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination">
          <button class="button" :disabled="filters.page <= 1" @click="prevPage">
            Previous
          </button>
          <span>Page {{ pagination.page }} / {{ pagination.totalPages }}</span>
          <button
            class="button"
            :disabled="filters.page >= pagination.totalPages"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>

      <div class="card">
        <div class="detail-header">
          <h2>Delivery Detail</h2>
          <button
            class="button primary"
            :disabled="!canRedrive(selected) || redrivePending"
            @click="retrySelected"
          >
            {{ redrivePending ? "Queueing..." : "Retry Selected" }}
          </button>
        </div>

        <div v-if="!selected" class="empty">
          Select a delivery row to inspect detail
        </div>

        <div v-else class="detail">
          <div class="section-title">Overview</div>
          <div class="detail-grid">
            <div>
              <div class="field-label">ID</div>
              <div class="mono">{{ selected.id }}</div>
            </div>
            <div>
              <div class="field-label">Status</div>
              <div><span :class="badgeClass(selected.status)">{{ selected.status }}</span></div>
            </div>
            <div>
              <div class="field-label">Event Type</div>
              <div>{{ selected.eventType }}</div>
            </div>
            <div>
              <div class="field-label">Attempt Number</div>
              <div>{{ selected.attemptNumber }}</div>
            </div>
            <div>
              <div class="field-label">Created At</div>
              <div>{{ formatDate(selected.createdAt) }}</div>
            </div>
            <div>
              <div class="field-label">Delivered At</div>
              <div>{{ formatDate(selected.deliveredAt) }}</div>
            </div>
            <div>
              <div class="field-label">Next Attempt At</div>
              <div>{{ formatDate(selected.nextAttemptAt) }}</div>
            </div>
            <div>
              <div class="field-label">Last Error</div>
              <div>{{ selected.status === "DELIVERED" ? "-" : selected.errorMessage || "-" }}</div>
            </div>
          </div>

          <div class="section-title">Payment</div>
          <div class="detail-grid">
            <div>
              <div class="field-label">Public ID</div>
              <div class="mono">{{ selected.paymentIntent?.publicId || "-" }}</div>
            </div>
            <div>
              <div class="field-label">Merchant Reference</div>
              <div>{{ selected.paymentIntent?.merchantReference || "-" }}</div>
            </div>
            <div>
              <div class="field-label">Merchant Order ID</div>
              <div>{{ selected.paymentIntent?.merchantOrderId || "-" }}</div>
            </div>
            <div>
              <div class="field-label">Payment Status</div>
              <div>{{ selected.paymentIntent?.status || "-" }}</div>
            </div>
            <div>
              <div class="field-label">Provider Reference</div>
              <div class="mono">{{ selected.paymentIntent?.providerReference || "-" }}</div>
            </div>
            <div>
              <div class="field-label">Provider Transaction ID</div>
              <div class="mono">{{ selected.paymentIntent?.providerTransactionId || "-" }}</div>
            </div>
          </div>

          <div class="section-title">Request Body</div>
          <pre>{{ prettyJson(selected.requestBody) }}</pre>

          <div class="section-title">Response Body</div>
          <pre>{{ selected.responseBody || "-" }}</pre>

          <div class="section-title">Request Headers</div>
          <pre>{{ prettyJson(selected.requestHeaders) }}</pre>

          <div class="section-title">Response Headers</div>
          <pre>{{ prettyJson(selected.responseHeaders) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  padding: 24px;
  display: grid;
  gap: 20px;
}
.header,
.table-header,
.actions,
.pagination,
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.card {
  border: 1px solid #ddd;
  border-radius: 14px;
  padding: 16px;
  background: #fff;
}
.label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}
.value {
  font-size: 28px;
  font-weight: 700;
}
.success {
  color: #15803d;
}
.warning {
  color: #b45309;
}
.danger {
  color: #b91c1c;
}
.filters-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
label {
  display: grid;
  gap: 6px;
}
input,
select,
button {
  font: inherit;
}
input,
select {
  border: 1px solid #ccc;
  border-radius: 10px;
  padding: 10px 12px;
}
.button {
  border: 1px solid #ccc;
  background: #fff;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
}
.button.primary {
  background: #111827;
  color: white;
  border-color: #111827;
}
.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.layout {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 20px;
}
.table-wrap {
  overflow: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 12px 10px;
  border-bottom: 1px solid #eee;
  text-align: left;
  vertical-align: top;
}
tbody tr {
  cursor: pointer;
}
tbody tr.selected,
tbody tr:hover {
  background: #f8fafc;
}
.badge {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  background: #eef2f7;
}
.delivered {
  background: #dcfce7;
  color: #166534;
}
.retrying {
  background: #fef3c7;
  color: #92400e;
}
.dead {
  background: #fee2e2;
  color: #991b1b;
}
.processing {
  background: #dbeafe;
  color: #1d4ed8;
}
.pending {
  background: #e0e7ff;
  color: #4338ca;
}
.error-box {
  border: 1px solid #fecaca;
  background: #fff1f2;
  color: #b42318;
  border-radius: 10px;
  padding: 12px 14px;
}
.success-box {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
  border-radius: 10px;
  padding: 12px 14px;
}
.empty {
  color: #666;
  padding: 16px 0;
}
.detail {
  display: grid;
  gap: 12px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}
.field-label,
.section-title {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}
.section-title {
  font-weight: 700;
  font-size: 14px;
  color: #111827;
  margin-top: 4px;
}
pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #eee;
  border-radius: 10px;
  background: #f8fafc;
  padding: 12px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.small {
  font-size: 12px;
}
.muted {
  color: #666;
}
@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .layout {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 900px) {
  .filters-grid,
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>