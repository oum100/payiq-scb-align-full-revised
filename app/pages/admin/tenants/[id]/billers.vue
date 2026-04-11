<template>
  <div class="min-h-screen bg-gray-50 dark:bg-neutral-950 p-6">
    <!-- Breadcrumb + header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-neutral-400 mb-1">
          <NuxtLink to="/admin/tenants" class="hover:text-amber-500 transition-colors">Tenants</NuxtLink>
          <span>/</span>
          <span class="text-gray-700 dark:text-neutral-300">{{ tenantName }}</span>
          <span>/</span>
          <span class="text-gray-900 dark:text-white font-medium">Billers</span>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Biller Profiles</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">{{ items.length }} biller{{ items.length !== 1 ? 's' : '' }} configured</p>
      </div>
      <UButton label="+ New Biller" color="warning" variant="soft" @click="openCreate" />
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Display Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Code</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Provider</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Env</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Biller ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Merchant ID</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Status</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Priority</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Routes</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in items" :key="b.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <td class="px-4 py-3 font-medium text-sm text-gray-900 dark:text-white">{{ b.displayName }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ b.code }}</td>
              <td class="px-4 py-3">
                <UBadge :label="b.providerCode" :color="b.providerCode === 'SCB' ? 'info' : 'neutral'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3">
                <UBadge :label="b.environment" :color="b.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ b.billerId ?? '—' }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ b.merchantIdAtProvider ?? '—' }}</td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="b.status" :color="statusColor(b.status)" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ b.priority }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ b._count?.paymentRoutes ?? 0 }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{{ fmtDate(b.createdAt) }}</td>
              <td class="px-4 py-3">
                <UButton icon="i-heroicons-pencil-square" color="neutral" variant="ghost" size="xs" @click="openEdit(b)" />
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="11" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">No billers configured yet</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Modal -->
    <div v-if="modal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="closeModal">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ modal.mode === 'create' ? 'New Biller Profile' : 'Edit Biller Profile' }}
          </h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeModal" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitModal">
          <!-- Display Name -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Display Name</label>
            <UInput v-model="form.displayName" placeholder="e.g. SCB PromptPay TEST" required />
          </div>
          <!-- Code (create only) -->
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Code <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(lowercase · immutable)</span></label>
            <UInput v-model="form.code" placeholder="e.g. scb-test" pattern="[a-z0-9_-]+" required />
          </div>
          <div v-else class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Code</label>
            <div class="font-mono text-xs text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">{{ modal.biller?.code }}</div>
          </div>
          <!-- Provider (create only) -->
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Provider</label>
            <USelect v-model="form.providerCode" :items="providerOptions" value-key="value" label-key="label" required />
          </div>
          <!-- Environment (create only) -->
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Environment</label>
            <USelect v-model="form.environment" :items="envOptions" value-key="value" label-key="label" required />
          </div>
          <!-- Biller ID -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Biller ID <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(from provider)</span></label>
            <UInput v-model="form.billerId" placeholder="e.g. 123456789" />
          </div>
          <!-- Merchant ID at Provider -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Merchant ID at Provider</label>
            <UInput v-model="form.merchantIdAtProvider" placeholder="e.g. MERCHANT001" />
          </div>
          <!-- Priority -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Priority <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(lower = higher priority)</span></label>
            <UInput v-model="form.priority" type="number" min="1" max="999" placeholder="100" />
          </div>
          <!-- Status (edit only) -->
          <div v-if="modal.mode === 'edit'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Status</label>
            <USelect v-model="form.status" :items="statusOptions" value-key="value" label-key="label" />
          </div>

          <div v-if="formError" class="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{{ formError }}</div>

          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="closeModal" />
            <UButton type="submit" :label="submitting ? 'Saving…' : modal.mode === 'create' ? 'Create' : 'Save'" color="warning" variant="soft" :disabled="submitting" />
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

type BillerRow = {
  id: string; code: string; displayName: string; providerCode: string
  environment: string; billerId: string | null; merchantIdAtProvider: string | null
  status: string; priority: number; createdAt: string
  _count: { paymentRoutes: number }
}

// Fetch biller list
const { data, pending, refresh } = await useFetch<{ items: BillerRow[] }>(`/api/admin/tenants/${tenantId}/billers`)
const items = computed(() => data.value?.items ?? [])

// Fetch tenant name for breadcrumb
const { data: tenantsData } = await useFetch<{ items: { id: string; name: string }[] }>('/api/admin/tenants')
const tenantName = computed(() => tenantsData.value?.items.find(t => t.id === tenantId)?.name ?? tenantId)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function statusColor(s: string): 'success' | 'warning' | 'neutral' {
  if (s === 'ACTIVE') return 'success'
  if (s === 'INACTIVE') return 'warning'
  return 'neutral'
}

const providerOptions = [
  { label: 'SCB', value: 'SCB' },
  { label: 'KBANK', value: 'KBANK' },
  { label: 'PROMPTPAY', value: 'PROMPTPAY' },
  { label: 'INTERNAL', value: 'INTERNAL' },
]
const envOptions = [
  { label: 'TEST', value: 'TEST' },
  { label: 'LIVE', value: 'LIVE' },
]
const statusOptions = [
  { label: 'ACTIVE', value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
  { label: 'DISABLED', value: 'DISABLED' },
]

const modal = reactive<{ open: boolean; mode: 'create' | 'edit'; biller: BillerRow | null }>({
  open: false, mode: 'create', biller: null,
})
const form = reactive({ displayName: '', code: '', providerCode: 'SCB', environment: 'TEST', billerId: '', merchantIdAtProvider: '', priority: '100', status: 'ACTIVE' })
const submitting = ref(false)
const formError = ref('')

function openCreate() {
  modal.mode = 'create'; modal.biller = null
  form.displayName = ''; form.code = ''; form.providerCode = 'SCB'; form.environment = 'TEST'
  form.billerId = ''; form.merchantIdAtProvider = ''; form.priority = '100'; form.status = 'ACTIVE'
  formError.value = ''; modal.open = true
}
function openEdit(b: BillerRow) {
  modal.mode = 'edit'; modal.biller = b
  form.displayName = b.displayName
  form.billerId = b.billerId ?? ''
  form.merchantIdAtProvider = b.merchantIdAtProvider ?? ''
  form.priority = String(b.priority)
  form.status = b.status
  formError.value = ''; modal.open = true
}
function closeModal() { modal.open = false }

async function submitModal() {
  formError.value = ''; submitting.value = true
  try {
    if (modal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/billers`, {
        method: 'POST',
        body: {
          code: form.code, displayName: form.displayName,
          providerCode: form.providerCode, environment: form.environment,
          billerId: form.billerId || null,
          merchantIdAtProvider: form.merchantIdAtProvider || null,
          priority: Number(form.priority),
        },
      })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/billers/${modal.biller!.id}`, {
        method: 'PATCH',
        body: {
          displayName: form.displayName,
          billerId: form.billerId || null,
          merchantIdAtProvider: form.merchantIdAtProvider || null,
          priority: Number(form.priority),
          status: form.status,
        },
      })
    }
    await refresh(); closeModal()
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}
</script>
