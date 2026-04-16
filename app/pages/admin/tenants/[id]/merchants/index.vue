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
            <span class="text-gray-900 dark:text-white font-medium">Merchants</span>
          </div>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Merchants</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">{{ items.length }} merchant{{ items.length !== 1 ? 's' : '' }}</p>
      </div>
      <UButton label="+ New Merchant" color="warning" variant="soft" @click="openCreate" />
    </div>

    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Name / Code</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Env</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Status</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">API Keys</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Payments</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Callback URL</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in items" :key="m.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
              @click="navigateTo(`/admin/tenants/${tenantId}/merchants/${m.id}`)">
              <td class="px-4 py-3">
                <div class="font-medium text-sm text-gray-900 dark:text-white">{{ m.name }}</div>
                <div class="font-mono text-xs text-gray-400 dark:text-neutral-500">{{ m.code }}</div>
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="m.environment" :color="m.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="m.status" :color="m.status === 'ACTIVE' ? 'success' : 'neutral'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ m._count?.apiKeys ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ m._count?.paymentIntents ?? 0 }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-400 dark:text-neutral-500 truncate max-w-[200px]">{{ m.callbackBaseUrl ?? '—' }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{{ fmtDate(m.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click.stop="openEdit(m)" />
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click.stop="confirmDelete(m)" />
                </div>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="8" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">No merchants yet</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Create / Edit Modal -->
    <div v-if="modal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="closeModal">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{{ modal.mode === 'create' ? 'New Merchant' : 'Edit Merchant' }}</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeModal" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitModal">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Name</label>
            <UInput v-model="form.name" placeholder="e.g. Main Store" required />
          </div>
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Code <span class="text-gray-400 font-normal">(lowercase · unique)</span></label>
            <UInput v-model="form.code" placeholder="e.g. main-store" pattern="[a-z0-9_-]+" required />
          </div>
          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Environment</label>
            <USelect v-model="form.environment" :items="[{ label: 'TEST', value: 'TEST' }, { label: 'LIVE', value: 'LIVE' }]" value-key="value" label-key="label" />
          </div>
          <div v-if="modal.mode === 'edit'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Status</label>
            <USelect v-model="form.status" :items="[{ label: 'ACTIVE', value: 'ACTIVE' }, { label: 'SUSPENDED', value: 'SUSPENDED' }, { label: 'DISABLED', value: 'DISABLED' }]" value-key="value" label-key="label" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Callback URL <span class="text-gray-400 font-normal">(optional)</span></label>
            <UInput v-model="form.callbackBaseUrl" placeholder="https://example.com/webhook" />
          </div>
          <div v-if="formError" class="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{{ formError }}</div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="closeModal" />
            <UButton type="submit" :label="submitting ? 'Saving…' : modal.mode === 'create' ? 'Create' : 'Save'" color="warning" variant="soft" :disabled="submitting" />
          </div>
        </form>
      </UCard>
    </div>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="deleteTarget = null">
      <UCard class="w-full max-w-sm" :ui="{ body: 'p-0' }">
        <div class="px-5 py-5 flex flex-col gap-4">
          <p class="text-sm text-gray-700 dark:text-neutral-300">Delete merchant <strong>{{ deleteTarget.name }}</strong>? This will also delete all associated API keys and payments.</p>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteTarget = null" />
            <UButton label="Delete" color="error" variant="soft" :loading="deleting" @click="doDelete" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'
definePageMeta({ layout: 'admin', middleware: 'admin-auth' })

const { $getLocale } = useI18n()
const route = useRoute()
const tenantId = route.params.id as string

function fmtDate(iso: string) { return fmtDateTimeFn(iso, $getLocale()) }

const { data: tenantData } = await useFetch(`/api/admin/tenants/${tenantId}`)
const tenantName = computed(() => (tenantData.value as any)?.name ?? '…')

const { data, pending, refresh } = await useFetch(`/api/admin/tenants/${tenantId}/merchants`)
const items = computed(() => (data.value as any)?.items ?? [])

type MerchantRow = { id: string; code: string; name: string; status: string; environment: string; callbackBaseUrl: string | null; createdAt: string; _count: { apiKeys: number; paymentIntents: number } }

const modal = reactive<{ open: boolean; mode: 'create' | 'edit'; merchant: MerchantRow | null }>({ open: false, mode: 'create', merchant: null })
const form = reactive({ name: '', code: '', environment: 'TEST', status: 'ACTIVE', callbackBaseUrl: '' })
const submitting = ref(false)
const formError = ref('')

function openCreate() {
  modal.mode = 'create'; modal.merchant = null
  form.name = ''; form.code = ''; form.environment = 'TEST'; form.callbackBaseUrl = ''
  formError.value = ''; modal.open = true
}
function openEdit(m: MerchantRow) {
  modal.mode = 'edit'; modal.merchant = m
  form.name = m.name; form.status = m.status; form.callbackBaseUrl = m.callbackBaseUrl ?? ''
  formError.value = ''; modal.open = true
}
function closeModal() { modal.open = false }

async function submitModal() {
  formError.value = ''; submitting.value = true
  try {
    if (modal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/merchants`, { method: 'POST', body: { code: form.code, name: form.name, environment: form.environment, callbackBaseUrl: form.callbackBaseUrl } })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/merchants/${modal.merchant!.id}`, { method: 'PATCH', body: { name: form.name, status: form.status, callbackBaseUrl: form.callbackBaseUrl } })
    }
    await refresh(); closeModal()
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}

const deleteTarget = ref<MerchantRow | null>(null)
const deleting = ref(false)
function confirmDelete(m: MerchantRow) { deleteTarget.value = m }
async function doDelete() {
  deleting.value = true
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/merchants/${deleteTarget.value!.id}`, { method: 'DELETE' })
    await refresh(); deleteTarget.value = null
  } finally { deleting.value = false }
}
</script>
