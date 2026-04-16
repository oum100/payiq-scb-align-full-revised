<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">
    <div class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="`/admin/tenants/${tenantId}`" />
          <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-neutral-400">
            <NuxtLink :to="`/admin/tenants/${tenantId}`" class="hover:text-amber-500 transition-colors">{{ tenantName }}</NuxtLink>
            <span>/</span>
            <span class="text-gray-700 dark:text-neutral-300">{{ tenantName }}</span>
            <span>/</span>
            <span class="text-gray-900 dark:text-white font-medium">Routes</span>
          </div>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Payment Routes</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">{{ items.length }} route{{ items.length !== 1 ? 's' : '' }} configured</p>
      </div>
      <UButton label="+ New Route" color="warning" variant="soft" @click="openCreate" />
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Code</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Method</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Provider</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Biller</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Currency</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Default</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Priority</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Created</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Env</th>
              <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <td class="px-4 py-3 text-sm text-gray-800 dark:text-neutral-200">{{ r.code }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.paymentMethodType }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.providerCode }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.billerProfile?.displayName ?? '—' }}</td>
              <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.currency }}</td>
              <td class="px-4 py-3 text-center">
                <UBadge v-if="r.isDefault" label="DEFAULT" color="warning" variant="soft" size="sm" />
                <span v-else class="text-xs text-gray-400 dark:text-neutral-600">—</span>
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ r.priority }}</td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="r.status" :color="r.status === 'ACTIVE' ? 'success' : 'neutral'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDate(r.createdAt) }}</td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="r.environment" :color="r.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-right">
                <UButton icon="i-heroicons-pencil-square" color="neutral" variant="ghost" size="sm" @click="openEdit(r)" />
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="11" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">No routes configured yet</td>
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
            {{ modal.mode === 'create' ? 'New Payment Route' : 'Edit Payment Route' }}
          </h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeModal" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitModal">
          <!-- Code (create only) -->
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Code <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(immutable)</span></label>
            <UInput v-model="form.code" placeholder="e.g. scb-promptpay-test" pattern="[a-z0-9_-]+" required />
          </div>
          <div v-else class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Code</label>
            <div class="font-mono text-xs text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">{{ modal.route?.code }}</div>
          </div>
          <!-- Method (create only) -->
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Payment Method</label>
            <USelect v-model="form.paymentMethodType" :items="methodOptions" value-key="value" label-key="label" required />
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
          <!-- Biller Profile -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Biller Profile</label>
            <USelect v-model="form.billerProfileId" :items="billerOptions" value-key="value" label-key="label" required />
          </div>
          <!-- Priority -->
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Priority <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(lower = higher)</span></label>
            <UInput v-model="form.priority" type="number" min="1" max="999" placeholder="100" />
          </div>
          <!-- Is Default -->
          <div class="flex items-center gap-2">
            <input id="isDefault" v-model="form.isDefault" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-amber-500" />
            <label for="isDefault" class="text-xs font-medium text-gray-700 dark:text-neutral-200">Set as default route for this method</label>
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

type BillerOption = { id: string; code: string; displayName: string }
type RouteRow = {
  id: string; code: string; paymentMethodType: string; providerCode: string
  environment: string; currency: string; isDefault: boolean; priority: number
  status: string; createdAt: string
  billerProfile: { id: string; code: string; displayName: string } | null
}

const { data, pending, refresh } = await useFetch<{ items: RouteRow[] }>(`/api/admin/tenants/${tenantId}/routes`)
const items = computed(() => data.value?.items ?? [])

const { data: tenantsData } = await useFetch<{ items: { id: string; name: string }[] }>('/api/admin/tenants')
const tenantName = computed(() => tenantsData.value?.items.find(t => t.id === tenantId)?.name ?? tenantId)

const { data: billersData } = await useFetch<{ items: BillerOption[] }>(`/api/admin/tenants/${tenantId}/billers`)
const billerOptions = computed(() =>
  (billersData.value?.items ?? []).map(b => ({ label: `${b.displayName} (${b.code})`, value: b.id }))
)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const methodOptions = [
  { label: 'PROMPTPAY_QR', value: 'PROMPTPAY_QR' },
  { label: 'DEEPLINK', value: 'DEEPLINK' },
  { label: 'BILL_PAYMENT', value: 'BILL_PAYMENT' },
  { label: 'CARD', value: 'CARD' },
  { label: 'BANK_TRANSFER', value: 'BANK_TRANSFER' },
  { label: 'E_WALLET', value: 'E_WALLET' },
]
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
]

const modal = reactive<{ open: boolean; mode: 'create' | 'edit'; route: RouteRow | null }>({
  open: false, mode: 'create', route: null,
})
const form = reactive({
  code: '', paymentMethodType: 'PROMPTPAY_QR', providerCode: 'SCB',
  environment: 'TEST', billerProfileId: '', priority: '100',
  isDefault: false, status: 'ACTIVE',
})
const submitting = ref(false)
const formError = ref('')

function openCreate() {
  modal.mode = 'create'; modal.route = null
  form.code = ''; form.paymentMethodType = 'PROMPTPAY_QR'; form.providerCode = 'SCB'
  form.environment = 'TEST'; form.billerProfileId = billerOptions.value[0]?.value ?? ''
  form.priority = '100'; form.isDefault = false; form.status = 'ACTIVE'
  formError.value = ''; modal.open = true
}
function openEdit(r: RouteRow) {
  modal.mode = 'edit'; modal.route = r
  form.billerProfileId = r.billerProfile?.id ?? ''
  form.priority = String(r.priority)
  form.isDefault = r.isDefault
  form.status = r.status
  formError.value = ''; modal.open = true
}
function closeModal() { modal.open = false }

async function submitModal() {
  formError.value = ''; submitting.value = true
  try {
    if (modal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/routes`, {
        method: 'POST',
        body: {
          code: form.code, paymentMethodType: form.paymentMethodType,
          providerCode: form.providerCode, environment: form.environment,
          billerProfileId: form.billerProfileId,
          priority: Number(form.priority), isDefault: form.isDefault,
        },
      })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/routes/${modal.route!.id}`, {
        method: 'PATCH',
        body: {
          billerProfileId: form.billerProfileId,
          priority: Number(form.priority),
          isDefault: form.isDefault,
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
