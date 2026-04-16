<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">

    <!-- Breadcrumb + back -->
    <div class="flex items-center gap-2 mb-5">
      <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="`/admin/tenants/${tenantId}`" />
      <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-neutral-400">
        <NuxtLink to="/admin/tenants" class="hover:text-amber-500 transition-colors">Tenants</NuxtLink>
        <span>/</span>
        <NuxtLink :to="`/admin/tenants/${tenantId}`" class="hover:text-amber-500 transition-colors">{{ tenantName }}</NuxtLink>
        <span>/</span>
        <span class="text-gray-800 dark:text-neutral-200 font-medium">Merchants</span>
      </div>
    </div>

    <!-- ═══ Merchant Tabs (one per merchant) ═══ -->
    <div v-if="allMerchants.length > 0" class="flex items-end gap-0 border-b border-gray-200 dark:border-neutral-800 mb-6 overflow-x-auto">
      <button
        v-for="m in allMerchants"
        :key="m.id"
        class="px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors"
        :class="m.id === merchantId
          ? 'border-amber-500 text-amber-400 font-semibold'
          : 'border-transparent text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:hover:text-neutral-200 hover:border-gray-300 dark:border-neutral-600'"
        @click="navigateTo(`/admin/tenants/${tenantId}/merchants/${m.id}`)"
      >
        {{ m.name }}
      </button>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="text-center py-24 text-sm text-gray-600 dark:text-neutral-400">Loading…</div>

    <template v-else-if="merchant">

      <!-- ═══ Merchant Header ═══ -->
      <div class="flex items-start justify-between flex-wrap gap-3 mb-5">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl font-semibold text-gray-800 dark:text-neutral-200">{{ merchant.name }}</h2>

            <!-- Status toggle group -->
            <div class="flex rounded-md overflow-hidden border border-gray-200 dark:border-neutral-700 text-xs">
              <button
                class="px-3 py-1 transition-colors"
                :class="merchant.status === 'ACTIVE'
                  ? 'bg-green-500 text-white font-semibold'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-200'"
                :disabled="toggling || merchant.status === 'ACTIVE'"
                @click="setMerchantStatus('ACTIVE')"
              >Active</button>
              <button
                class="px-3 py-1 transition-colors border-l border-gray-200 dark:border-neutral-700"
                :class="merchant.status !== 'ACTIVE'
                  ? 'bg-red-500 text-white font-semibold'
                  : 'bg-gray-100 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400 hover:text-gray-800 dark:text-neutral-200'"
                :disabled="toggling || merchant.status !== 'ACTIVE'"
                @click="setMerchantStatus('DISABLED')"
              >Disabled</button>
            </div>

            <!-- ENV badge -->
            <UBadge
              :label="merchant.environment"
              :color="merchant.environment === 'LIVE' ? 'success' : 'warning'"
              variant="soft"
              size="sm"
            />
          </div>
          <div class="font-mono text-xs text-gray-500 dark:text-neutral-500">{{ merchant.code }}</div>
        </div>

        <!-- Mini stats -->
        <div class="flex items-center gap-5">
          <div class="text-center">
            <div class="text-lg font-bold text-gray-800 dark:text-neutral-200">{{ merchant._count?.apiKeys ?? 0 }}</div>
            <div class="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Keys</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-800 dark:text-neutral-200">{{ merchant._count?.paymentIntents ?? 0 }}</div>
            <div class="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Payments</div>
          </div>
          <div class="text-center">
            <div class="text-lg font-bold text-gray-800 dark:text-neutral-200">{{ merchant._count?.webhookEndpoints ?? 0 }}</div>
            <div class="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wide">Webhooks</div>
          </div>
        </div>
      </div>

      <!-- ═══ Callback Base URL Card ═══ -->
      <UCard class="mb-4">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-link-2" class="w-4 h-4 text-amber-500" />
            <span class="text-sm font-semibold text-gray-800 dark:text-neutral-200">Callback Base URL</span>
            <span class="text-xs text-gray-500 dark:text-neutral-500">(POST on payment status change)</span>
          </div>
          <UButton
            v-if="!editingCallback"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            @click="startEditCallback"
          />
        </div>

        <!-- View mode -->
        <template v-if="!editingCallback">
          <div
            v-if="merchant.callbackBaseUrl"
            class="flex items-center gap-2 font-mono text-sm text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 dark:bg-neutral-800/60 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2"
          >
            <span class="flex-1 break-all">{{ merchant.callbackBaseUrl }}</span>
            <UButton icon="i-lucide-copy" color="neutral" variant="ghost" size="xs" @click="copyText(merchant.callbackBaseUrl)" />
          </div>
          <p v-else class="text-sm text-gray-500 dark:text-neutral-500 italic">
            Not configured — add a URL to receive payment event callbacks
          </p>
        </template>

        <!-- Edit mode -->
        <div v-else class="flex flex-col gap-2">
          <UInput v-model="callbackUrlForm" placeholder="https://your-server.com/payment/callback" autofocus />
          <div class="flex items-center gap-2 flex-wrap">
            <UButton label="Save" color="warning" variant="soft" size="sm" :loading="savingCallback" @click="saveCallback" />
            <UButton label="Cancel" color="neutral" variant="outline" size="sm" @click="editingCallback = false" />
            <UButton
              v-if="merchant.callbackBaseUrl"
              label="Remove URL"
              color="error"
              variant="ghost"
              size="sm"
              :loading="savingCallback"
              @click="removeCallback"
            />
          </div>
          <p v-if="callbackError" class="text-xs text-red-400">{{ callbackError }}</p>
        </div>
      </UCard>

      <!-- ═══ Route Assignments Card ═══ -->
      <UCard :ui="{ body: 'p-0' }" class="mb-4">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-route" class="w-4 h-4 text-amber-500" />
              <span class="text-sm font-semibold text-gray-800 dark:text-neutral-200">Route Assignments</span>
            </div>
            <UButton label="+ Add" color="warning" variant="soft" size="xs" @click="openAddAssignment" />
          </div>
        </template>

        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Method</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Route</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Biller</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Ref1</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Ref2 Mode</th>
                <th class="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="a in routeAssignments"
                :key="a.id"
                class="border-b border-gray-100 dark:border-neutral-800/50 last:border-0"
              >
                <td class="px-4 py-2.5">
                  <UBadge :label="a.paymentMethodType" color="neutral" variant="soft" size="sm" />
                </td>
                <td class="px-4 py-2.5 text-sm text-gray-800 dark:text-neutral-200">
                  {{ a.paymentRoute?.code ?? '—' }}
                </td>
                <td class="px-4 py-2.5 text-sm text-gray-600 dark:text-neutral-400">
                  {{ a.paymentRoute?.billerProfile?.displayName ?? '—' }}
                </td>
                <td class="px-4 py-2.5 font-mono text-xs text-gray-500 dark:text-neutral-500">
                  {{ (a.paymentRoute?.billerProfile?.config as any)?.promptpay?.ref1 ?? '—' }}
                </td>
                <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-neutral-500">
                  {{ (a.paymentRoute?.billerProfile?.config as any)?.promptpay?.ref2Mode ?? '—' }}
                </td>
                <td class="px-4 py-2.5 text-right">
                  <UButton
                    icon="i-lucide-x"
                    color="error"
                    variant="ghost"
                    size="xs"
                    :loading="deletingAssignment === a.id"
                    @click="deleteAssignment(a.id)"
                  />
                </td>
              </tr>
              <tr v-if="!routeAssignments.length">
                <td colspan="6" class="text-center py-8 text-sm text-gray-500 dark:text-neutral-500">Using tenant default routes</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- ═══ API Keys + Payments Cards ═══ -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <!-- API Keys Card -->
        <UCard :ui="{ body: 'p-0' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-key" class="w-4 h-4 text-amber-500" />
                <span class="text-sm font-semibold text-gray-800 dark:text-neutral-200">API Keys</span>
              </div>
              <UButton label="+ Generate" color="warning" variant="soft" size="xs" @click="openGenerateKey" />
            </div>
          </template>

          <!-- New key reveal banner -->
          <div v-if="newKey" class="mx-4 mt-3 mb-1 bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-3">
            <div class="text-sm font-semibold text-amber-400 mb-2">⚠ Save this key — shown once only</div>
            <code class="font-mono text-sm text-amber-300 break-all select-all block mb-4">{{ newKey }}</code>
            <UButton
              size="sm"
              color="warning"
              variant="outline"
              :icon="copiedId === 'newKey' ? 'i-lucide-check' : 'i-lucide-copy'"
              label="Copy Key"
              @click="copyText(newKey, 'newKey')"
            />
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-200 dark:border-neutral-800">
                  <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Name</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Prefix</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Env</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Status</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Last Used</th>
                  <th class="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="k in merchant.apiKeys"
                  :key="k.id"
                  class="border-b border-gray-100 dark:border-neutral-800/50 last:border-0"
                  :class="k.status === 'REVOKED' ? 'opacity-40' : ''"
                >
                  <td class="px-4 py-2.5 text-sm font-medium text-gray-800 dark:text-neutral-200">{{ k.name }}</td>
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-xs text-gray-600 dark:text-neutral-400">{{ k.keyPrefix }}…</span>
                    <span class="ml-1.5 text-xs text-gray-400 dark:text-neutral-600">(prefix only)</span>
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <UBadge :label="k.environment" :color="k.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <UBadge
                      :label="k.status"
                      :color="k.status === 'ACTIVE' ? 'success' : k.status === 'REVOKED' ? 'error' : 'neutral'"
                      variant="soft"
                      size="sm"
                    />
                  </td>
                  <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-neutral-500">{{ k.lastUsedAt ? fmtDate(k.lastUsedAt) : '—' }}</td>
                  <td class="px-4 py-2.5 text-right">
                    <UButton
                      v-if="k.status === 'ACTIVE'"
                      icon="i-lucide-ban"
                      color="error"
                      variant="ghost"
                      size="xs"
                      title="Revoke"
                      :loading="revoking === k.id"
                      @click="revokeKey(k.id)"
                    />
                  </td>
                </tr>
                <tr v-if="!merchant.apiKeys?.length">
                  <td colspan="6" class="text-center py-8 text-sm text-gray-500 dark:text-neutral-500">No API keys yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

        <!-- Payments Card -->
        <UCard :ui="{ body: 'p-0' }">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-banknote" class="w-4 h-4 text-amber-500" />
              <span class="text-sm font-semibold text-gray-800 dark:text-neutral-200">Recent Payments</span>
              <span class="text-xs text-gray-500 dark:text-neutral-500">{{ merchant._count?.paymentIntents ?? 0 }} total</span>
            </div>
          </template>
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="border-b border-gray-200 dark:border-neutral-800">
                  <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Public ID</th>
                  <th class="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Status</th>
                  <th class="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Amount</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Method</th>
                  <th class="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Created</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="p in merchant.paymentIntents"
                  :key="p.id"
                  class="border-b border-gray-100 dark:border-neutral-800/50 last:border-0 hover:bg-gray-100/80 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors"
                  @click="navigateTo(`/admin/payments/${p.publicId}`)"
                >
                  <td class="px-4 py-2.5 font-mono text-xs text-gray-600 dark:text-neutral-400">{{ p.publicId }}</td>
                  <td class="px-4 py-2.5 text-center">
                    <UBadge :label="p.status" :color="paymentColor(p.status)" variant="soft" size="sm" />
                  </td>
                  <td class="px-4 py-2.5 text-right text-sm font-medium text-gray-800 dark:text-neutral-200">
                    {{ Number(p.amount).toLocaleString() }} {{ p.currency }}
                  </td>
                  <td class="px-4 py-2.5 text-xs text-gray-600 dark:text-neutral-400">{{ p.paymentMethodType }}</td>
                  <td class="px-4 py-2.5 text-xs text-gray-500 dark:text-neutral-500">{{ fmtDate(p.createdAt) }}</td>
                </tr>
                <tr v-if="!merchant.paymentIntents?.length">
                  <td colspan="5" class="text-center py-8 text-sm text-gray-500 dark:text-neutral-500">No payments yet</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>

      </div>
    </template>

    <!-- ═══ Generate Key Modal ═══ -->
    <div
      v-if="keyModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="keyModal = false"
    >
      <UCard class="w-full max-w-sm" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-200">Generate API Key</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="keyModal = false" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitGenerateKey">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Key Name</label>
            <UInput v-model="keyForm.name" placeholder="e.g. Production Key" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Environment</label>
            <USelect
              v-model="keyForm.environment"
              :items="[{ label: 'TEST', value: 'TEST' }, { label: 'LIVE', value: 'LIVE' }]"
              value-key="value"
              label-key="label"
            />
          </div>
          <div v-if="keyFormError" class="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">
            {{ keyFormError }}
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="keyModal = false" />
            <UButton
              type="submit"
              :label="generatingKey ? 'Generating…' : 'Generate'"
              color="warning"
              variant="soft"
              :disabled="generatingKey"
            />
          </div>
        </form>
      </UCard>
    </div>

    <!-- ═══ Add Route Assignment Modal ═══ -->
    <div
      v-if="assignmentModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="assignmentModal = false"
    >
      <UCard class="w-full max-w-lg" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-200">Add Route Assignment</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="assignmentModal = false" />
        </div>
        <form class="px-6 py-5 flex flex-col gap-4" @submit.prevent="submitAssignment">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Payment Route</label>
            <!-- Description ของ route ที่เลือก แสดงด้านบน dropdown -->
            <div v-if="selectedRoute" class="flex flex-col gap-1 px-3 py-2.5 rounded-md bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-sm">
              <div class="flex items-center gap-2">
                <span class="w-16 text-gray-500 dark:text-neutral-400">Method</span>
                <span class="font-medium text-gray-800 dark:text-neutral-200">{{ selectedRoute.paymentMethodType }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-16 text-gray-500 dark:text-neutral-400">Biller</span>
                <span class="font-medium text-gray-800 dark:text-neutral-200">{{ selectedRoute.billerProfile?.displayName ?? selectedRoute.billerProfileId }}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="w-16 text-gray-500 dark:text-neutral-400">Env</span>
                <UBadge :label="selectedRoute.environment" :color="selectedRoute.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="xs" />
              </div>
            </div>
            <p v-else class="text-sm text-gray-400 dark:text-neutral-500">เลือก Route เพื่อดูรายละเอียด</p>
            <USelect
              v-model="assignmentForm.paymentRouteId"
              :items="routeOptions"
              value-key="value"
              label-key="label"
              :selected-icon="''"
              size="lg"
              required
            />
          </div>
          <div v-if="assignmentError" class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
            {{ assignmentError }}
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="assignmentModal = false" />
            <UButton
              type="submit"
              :label="savingAssignment ? 'Saving…' : 'Save'"
              color="warning"
              variant="soft"
              :disabled="savingAssignment || !assignmentForm.paymentRouteId"
            />
          </div>
        </form>
      </UCard>
    </div>

  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth' })

const route = useRoute()
const tenantId = route.params.id as string
const merchantId = route.params.merchantId as string

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

// Tenant name for breadcrumb
const { data: tenantData } = await useFetch(`/api/admin/tenants/${tenantId}`)
const tenantName = computed(() => (tenantData.value as any)?.name ?? '…')

// All merchants — for the tab bar
const { data: merchantsData } = await useFetch(`/api/admin/tenants/${tenantId}/merchants`)
const allMerchants = computed(() => (merchantsData.value as any)?.items ?? [])

// Current merchant full detail
const { data, pending, refresh } = await useFetch(
  `/api/admin/tenants/${tenantId}/merchants/${merchantId}`
)
const merchant = computed(() => data.value as any)

// Route Assignments (also included in merchant data, but we maintain separate reactive list)
const routeAssignments = computed(() => (merchant.value as any)?.merchantRouteAssignments ?? [])

// Available routes for assignment modal
const { data: routesData } = await useFetch(`/api/admin/tenants/${tenantId}/routes`)
const allRoutes = computed(() => (routesData.value as any)?.items ?? [])
const routeOptions = computed(() =>
  allRoutes.value.map((r: any) => ({
    label: r.code,
    value: r.id,
  }))
)

// Selected route full object for description panel
const selectedRoute = computed(() => {
  if (!assignmentForm.paymentRouteId) return null
  return allRoutes.value.find((r: any) => r.id === assignmentForm.paymentRouteId) ?? null
})

// Auto-derive paymentMethodType from selected route
const selectedRouteMethod = computed(() => selectedRoute.value?.paymentMethodType ?? null)

// ═══ Status toggle ═══
const toggling = ref(false)
async function setMerchantStatus(status: string) {
  toggling.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/merchants/${merchantId}`, {
      method: 'PATCH',
      body: { status },
    })
    await refresh()
  } finally { toggling.value = false }
}

// ═══ Callback URL CRUD ═══
const editingCallback = ref(false)
const callbackUrlForm = ref('')
const savingCallback = ref(false)
const callbackError = ref('')

function startEditCallback() {
  callbackUrlForm.value = merchant.value?.callbackBaseUrl ?? ''
  callbackError.value = ''
  editingCallback.value = true
}

async function saveCallback() {
  savingCallback.value = true
  callbackError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/merchants/${merchantId}`, {
      method: 'PATCH',
      body: { callbackBaseUrl: callbackUrlForm.value.trim() || null },
    })
    await refresh()
    editingCallback.value = false
  } catch (e: any) {
    callbackError.value = e?.data?.message ?? 'Failed to save'
  } finally { savingCallback.value = false }
}

async function removeCallback() {
  savingCallback.value = true
  callbackError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/merchants/${merchantId}`, {
      method: 'PATCH',
      body: { callbackBaseUrl: null },
    })
    await refresh()
    editingCallback.value = false
  } catch (e: any) {
    callbackError.value = e?.data?.message ?? 'Failed to remove'
  } finally { savingCallback.value = false }
}

// ═══ Route Assignments ═══
const assignmentModal = ref(false)
const assignmentForm = reactive({ paymentRouteId: '' })
const savingAssignment = ref(false)
const assignmentError = ref('')
const deletingAssignment = ref<string | null>(null)

function openAddAssignment() {
  assignmentForm.paymentRouteId = ''
  assignmentError.value = ''
  assignmentModal.value = true
}

async function submitAssignment() {
  savingAssignment.value = true
  assignmentError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/merchants/${merchantId}/route-assignments`, {
      method: 'POST',
      body: {
        paymentRouteId: assignmentForm.paymentRouteId,
        paymentMethodType: selectedRouteMethod.value,
      },
    })
    await refresh()
    assignmentModal.value = false
  } catch (e: any) {
    assignmentError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { savingAssignment.value = false }
}

async function deleteAssignment(id: string) {
  deletingAssignment.value = id
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/merchants/${merchantId}/route-assignments/${id}`, {
      method: 'DELETE',
    })
    await refresh()
  } finally { deletingAssignment.value = null }
}

// ═══ API Keys ═══
const keyModal = ref(false)
const keyForm = reactive({ name: '', environment: 'TEST' })
const generatingKey = ref(false)
const keyFormError = ref('')
const newKey = ref<string | null>(null)
const revoking = ref<string | null>(null)

function openGenerateKey() {
  keyForm.name = ''
  keyForm.environment = merchant.value?.environment ?? 'TEST'
  keyFormError.value = ''
  newKey.value = null
  keyModal.value = true
}

async function submitGenerateKey() {
  generatingKey.value = true
  keyFormError.value = ''
  try {
    const res = await $fetch<{ fullKey: string }>(`/api/admin/tenants/${tenantId}/api-keys`, {
      method: 'POST',
      body: { merchantId, name: keyForm.name, environment: keyForm.environment },
    })
    newKey.value = res.fullKey
    await refresh()
    keyModal.value = false
  } catch (e: any) {
    keyFormError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { generatingKey.value = false }
}

async function revokeKey(id: string) {
  revoking.value = id
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/api-keys/${id}`, { method: 'DELETE' })
    await refresh()
  } finally { revoking.value = null }
}

// ═══ Payments ═══
function paymentColor(s: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (s === 'SUCCEEDED') return 'success'
  if (s === 'FAILED' || s === 'EXPIRED') return 'error'
  if (s === 'AWAITING_CUSTOMER' || s === 'PROCESSING' || s === 'PENDING_PROVIDER') return 'warning'
  return 'neutral'
}

// ═══ Utils ═══
const copiedId = ref<string | null>(null)
const toast = useToast()

function copyText(text: string | null | undefined, id = 'default') {
  if (!text || !process.client) return
  navigator.clipboard.writeText(text).then(() => {
    copiedId.value = id
    toast.add({ title: 'Copied!', color: 'success', timeout: 2000, icon: 'i-lucide-check' })
    setTimeout(() => { if (copiedId.value === id) copiedId.value = null }, 2000)
  }).catch(() => {
    toast.add({ title: 'Copy failed', description: 'ไม่สามารถ copy ได้', color: 'error', timeout: 3000 })
  })
}
</script>
