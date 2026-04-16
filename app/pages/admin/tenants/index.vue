<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">
    <!-- Page header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Tenants</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">
          {{ items.length }} tenant{{ items.length !== 1 ? 's' : '' }} registered
        </p>
      </div>
      <UButton label="+ New Tenant" color="warning" variant="soft" @click="openCreate" />
    </div>

    <!-- Table card -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-gray-500 dark:text-neutral-400 text-sm">
        Loading…
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Name / Code</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Status</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Users</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Merchants</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Billers</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Routes</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                API Keys</th>
              <th
                class="px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Payments</th>
              <th
                class="px-4 py-3 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in items" :key="t.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors cursor-pointer"
              @click="navigateTo(`/admin/tenants/${t.id}`)">
              <td class="px-4 py-3">
                <div class="font-medium text-gray-900 dark:text-white text-sm">{{ t.name }}</div>
                <div class="font-sans text-sm text-gray-400 dark:text-neutral-500 mt-0.5">{{ t.code }}</div>
              </td>
              <td class="px-4 py-3 flex items-center justify-center">
                <UBadge :label="t.status" :color="statusColor(t.status)" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-200">{{ t._count?.tenantUsers ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-200">{{ t._count?.merchants ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-200">{{ t._count?.billerProfiles ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-200">{{ t._count?.paymentRoutes ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-200">{{ t._count?.apiKeys ?? 0 }}</td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-200">{{ t._count?.paymentIntents ?? 0 }}</td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDateTime(t.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" title="Edit" @click.stop="openEdit(t)" />
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" title="Delete" @click.stop="confirmDelete(t)" />
                </div>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="10" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">
                No tenants yet — create one to get started
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Delete Confirm -->
    <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="deleteTarget = null">
      <UCard class="w-full max-w-sm" :ui="{ body: 'p-0' }">
        <div class="px-5 py-5 flex flex-col gap-4">
          <p class="text-sm text-gray-700 dark:text-neutral-300">Delete tenant <strong>{{ deleteTarget.name }}</strong>? This will permanently delete all merchants, billers, routes, users, and payments.</p>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteTarget = null" />
            <UButton label="Delete" color="error" variant="soft" :loading="deleting" @click="doDelete" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="modal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="closeModal">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <!-- Modal header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ modal.mode === 'create' ? 'New Tenant' : 'Edit Tenant' }}
          </h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeModal" />
        </div>

        <!-- Modal body -->
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitModal">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Name</label>
            <UInput v-model="form.name" placeholder="e.g. Acme Corp" required />
          </div>

          <div v-if="modal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">
              Code
              <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(lowercase · unique · immutable)</span>
            </label>
            <UInput v-model="form.code" placeholder="e.g. acme" pattern="[a-z0-9_-]+" required />
          </div>

          <div v-else class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Code</label>
            <div
              class="font-sans text-sm text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">
              {{ modal.tenant?.code }}
            </div>
          </div>

          <div v-if="modal.mode === 'edit'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Status</label>
            <USelect v-model="form.status" :options="[
              { label: 'ACTIVE', value: 'ACTIVE' },
              { label: 'SUSPENDED', value: 'SUSPENDED' },
              { label: 'DISABLED', value: 'DISABLED' },
            ]" />
          </div>

          <div v-if="formError"
            class="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
            {{ formError }}
          </div>

          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="closeModal" />
            <UButton type="submit" :label="submitting ? 'Saving…' : modal.mode === 'create' ? 'Create' : 'Save'"
              color="warning" variant="soft" :disabled="submitting" />
          </div>
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'
definePageMeta({ layout: 'admin', middleware: 'admin-auth' })

const { $t, $getLocale } = useI18n()
function fmtDateTime(iso: string | null | undefined) {
  return fmtDateTimeFn(iso, $getLocale())
}

type TenantRow = {
  id: string; code: string; name: string; status: string; createdAt: string
  _count: { tenantUsers: number; merchants: number; billerProfiles: number; paymentRoutes: number; apiKeys: number; paymentIntents: number }
}

const { data, pending, refresh } = await useFetch<{ items: TenantRow[] }>('/api/admin/tenants')
const items = computed(() => data.value?.items ?? [])

function statusColor(s: string): 'success' | 'warning' | 'neutral' {
  if (s === 'ACTIVE') return 'success'
  if (s === 'SUSPENDED') return 'warning'
  return 'neutral'
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

const deleteTarget = ref<TenantRow | null>(null)
const deleting = ref(false)
function confirmDelete(t: TenantRow) { deleteTarget.value = t }
async function doDelete() {
  deleting.value = true
  try {
    await $fetch(`/api/admin/tenants/${deleteTarget.value!.id}`, { method: 'DELETE' })
    await refresh(); deleteTarget.value = null
  } finally { deleting.value = false }
}

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
