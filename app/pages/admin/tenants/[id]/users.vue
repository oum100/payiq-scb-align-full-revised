<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">
    <!-- Breadcrumb + header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="`/admin/tenants/${tenantId}`" />
          <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-neutral-400">
            <NuxtLink :to="`/admin/tenants/${tenantId}`" class="hover:text-amber-500 transition-colors">{{ tenantName }}</NuxtLink>
            <span>/</span>
            <span class="text-gray-700 dark:text-neutral-300">{{ tenant?.name ?? '…' }}</span>
            <span>/</span>
            <span class="text-gray-900 dark:text-white font-medium">Users</span>
          </div>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Portal Users</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">
          {{ users.length }} user{{ users.length !== 1 ? 's' : '' }}
          <span class="font-mono text-xs ml-1">· {{ tenant?.code }}</span>
        </p>
      </div>
      <UButton label="+ Add User" color="warning" variant="soft" @click="openCreate" />
    </div>

    <!-- Table card -->
    <UCard :ui="{ body: { padding: '' } }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">
        Loading…
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Name / Email</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Role</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Last Login</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-sm text-gray-900 dark:text-white">{{ u.name ?? '—' }}</div>
                <div class="font-mono text-xs text-gray-400 dark:text-neutral-500 mt-0.5">{{ u.email }}</div>
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :label="u.role"
                  :color="roleColor(u.role)"
                  variant="soft"
                  size="sm"
                />
              </td>
              <td class="px-4 py-3">
                <UBadge
                  :label="u.isActive ? 'ACTIVE' : 'INACTIVE'"
                  :color="u.isActive ? 'success' : 'neutral'"
                  variant="soft"
                  size="sm"
                />
              </td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">
                {{ u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never' }}
              </td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{{ fmtDate(u.createdAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-1.5">
                  <UButton
                    icon="i-heroicons-pencil-square"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    title="Edit"
                    @click="openEdit(u)"
                  />
                  <UButton
                    :icon="u.isActive ? 'i-heroicons-pause' : 'i-heroicons-play'"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :title="u.isActive ? 'Deactivate' : 'Activate'"
                    @click="toggleActive(u)"
                  />
                  <UButton
                    icon="i-heroicons-trash"
                    color="error"
                    variant="ghost"
                    size="xs"
                    title="Delete"
                    @click="confirmDelete(u)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!users.length">
              <td colspan="6" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">
                No portal users yet — add one to get started
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Create / Edit Modal -->
    <div
      v-if="modal.open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="closeModal"
    >
      <UCard class="w-full max-w-md" :ui="{ body: { padding: 'p-0' } }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ modal.mode === 'create' ? 'Add Portal User' : 'Edit User' }}
          </h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeModal" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitModal">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Email</label>
            <UInput
              v-model="form.email"
              type="email"
              placeholder="user@company.com"
              :disabled="modal.mode === 'edit'"
              required
            />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">
              Name
              <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(optional)</span>
            </label>
            <UInput v-model="form.name" placeholder="Full name" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Role</label>
            <USelect
              v-model="form.role"
              :options="[
                { label: 'OWNER', value: 'OWNER' },
                { label: 'ADMIN', value: 'ADMIN' },
                { label: 'VIEWER', value: 'VIEWER' },
              ]"
            />
          </div>
          <div
            v-if="formError"
            class="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2"
          >
            {{ formError }}
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="closeModal" />
            <UButton
              type="submit"
              :label="submitting ? 'Saving…' : modal.mode === 'create' ? 'Add User' : 'Save'"
              color="warning"
              variant="soft"
              :disabled="submitting"
            />
          </div>
        </form>
      </UCard>
    </div>

    <!-- Delete confirm modal -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="deleteTarget = null"
    >
      <UCard class="w-full max-w-sm" :ui="{ body: { padding: 'p-0' } }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Delete User</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="deleteTarget = null" />
        </div>
        <div class="px-5 py-5 flex flex-col gap-4">
          <p class="text-sm text-gray-700 dark:text-neutral-200 leading-relaxed">
            Remove <strong class="text-gray-900 dark:text-white font-semibold">{{ deleteTarget.email }}</strong> from this tenant?
            This will also delete all their sessions and magic links.
          </p>
          <div
            v-if="formError"
            class="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2"
          >
            {{ formError }}
          </div>
          <div class="flex justify-end gap-2">
            <UButton label="Cancel" color="neutral" variant="outline" @click="deleteTarget = null" />
            <UButton
              :label="submitting ? 'Deleting…' : 'Delete'"
              color="error"
              variant="soft"
              :disabled="submitting"
              @click="doDelete"
            />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin-auth' })

const route = useRoute()
const tenantId = route.params.id as string

type UserRow = {
  id: string; email: string; name: string | null; role: string
  isActive: boolean; lastLoginAt: string | null; createdAt: string
}
type TenantInfo = { id: string; name: string; code: string }

const { data, pending, refresh } = await useFetch<{ tenant: TenantInfo; users: UserRow[] }>(
  `/api/admin/tenants/${tenantId}/users`
)
const tenant = computed(() => data.value?.tenant ?? null)
const users = computed(() => data.value?.users ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function roleColor(role: string): 'warning' | 'info' | 'neutral' {
  if (role === 'OWNER') return 'warning'
  if (role === 'ADMIN') return 'info'
  return 'neutral'
}

// Modal state
const modal = reactive<{ open: boolean; mode: 'create' | 'edit'; user: UserRow | null }>({
  open: false, mode: 'create', user: null,
})
const form = reactive({ email: '', name: '', role: 'VIEWER' })
const submitting = ref(false)
const formError = ref('')

function openCreate() {
  modal.mode = 'create'; modal.user = null
  form.email = ''; form.name = ''; form.role = 'VIEWER'
  formError.value = ''; modal.open = true
}
function openEdit(u: UserRow) {
  modal.mode = 'edit'; modal.user = u
  form.email = u.email; form.name = u.name ?? ''; form.role = u.role
  formError.value = ''; modal.open = true
}
function closeModal() { modal.open = false }

async function submitModal() {
  formError.value = ''; submitting.value = true
  try {
    if (modal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/users`, {
        method: 'POST',
        body: { email: form.email, name: form.name || null, role: form.role },
      })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/users/${modal.user!.id}`, {
        method: 'PATCH',
        body: { name: form.name || null, role: form.role },
      })
    }
    await refresh(); closeModal()
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}

// Toggle active / inactive
async function toggleActive(u: UserRow) {
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/users/${u.id}`, {
      method: 'PATCH',
      body: { isActive: !u.isActive },
    })
    await refresh()
  } catch (e: any) {
    alert(e?.data?.message ?? 'Failed to update user')
  }
}

// Delete
const deleteTarget = ref<UserRow | null>(null)
function confirmDelete(u: UserRow) { deleteTarget.value = u; formError.value = '' }
async function doDelete() {
  if (!deleteTarget.value) return
  submitting.value = true; formError.value = ''
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/users/${deleteTarget.value.id}`, { method: 'DELETE' })
    await refresh(); deleteTarget.value = null
  } catch (e: any) {
    formError.value = e?.data?.message ?? 'Failed to delete user'
  } finally { submitting.value = false }
}
</script>
