<template>
  <div class="min-h-screen bg-gray-50 dark:bg-neutral-950 p-6">
    <!-- Page header -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Admin Users</h1>
      <UButton label="+ Add Admin" color="warning" variant="soft" @click="showCreate = true" />
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
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Name</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Email</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Status</th>
              <th
                class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Active sessions</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Last login</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Created</th>
              <th
                class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in items" :key="u.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors">
              <td class="px-4 py-3 font-medium text-sm text-gray-900 dark:text-white">{{ u.name ?? '—' }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ u.email }}</td>
              <td class="px-4 py-3">
                <UBadge :label="u.isActive ? 'Active' : 'Inactive'" :color="u.isActive ? 'success' : 'neutral'"
                  variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ u._count?.sessions ?? 0
                }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{{ u.lastLoginAt ?
                fmtDateTime(u.lastLoginAt) : 'Never' }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-400">{{ fmtDateTime(u.createdAt) }}</td>
              <td class="px-4 py-3 whitespace-nowrap">
                <UButton v-if="u.email !== me?.email" :label="u.isActive ? 'Deactivate' : 'Activate'"
                  :color="u.isActive ? 'error' : 'success'" variant="soft" size="xs" @click="toggleActive(u)" />
                <span v-else class="text-xs italic text-gray-400 dark:text-neutral-500">You</span>
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="7" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">
                No admin users
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Create modal -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click.self="closeCreate">
      <UCard class="w-full max-w-md" :ui="{ body: { padding: 'p-0' } }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Add Admin User</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeCreate" />
        </div>
        <div class="px-5 py-5 flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">Email</label>
            <UInput v-model="form.email" type="email" placeholder="admin@company.com" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs font-medium text-gray-700 dark:text-neutral-200">
              Name
              <span class="text-gray-400 dark:text-neutral-500 font-normal ml-1">(optional)</span>
            </label>
            <UInput v-model="form.name" placeholder="Full name" />
          </div>
          <div v-if="createError"
            class="text-xs text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">
            {{ createError }}
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton label="Cancel" color="neutral" variant="outline" @click="closeCreate" />
            <UButton :label="creating ? 'Adding…' : 'Add User'" color="warning" variant="soft"
              :disabled="!form.email || creating" @click="createUser" />
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const { $t, $getLocale } = useI18n()
function fmtDateTime(iso: string | null | undefined) {
  return fmtDateTimeFn(iso, $getLocale())
}

const { admin: me } = useAdmin()
const showCreate = ref(false)
const creating = ref(false)
const createError = ref("")
const form = reactive({ email: "", name: "" })

const { data, pending, refresh } = await useFetch("/api/admin/users")
const items = computed(() => (data.value as any)?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

async function createUser() {
  if (!form.email) return
  creating.value = true; createError.value = ""
  try {
    await $fetch("/api/admin/users", { method: "POST", body: { email: form.email, name: form.name || undefined } })
    await refresh()
    closeCreate()
  } catch (e: any) {
    createError.value = e?.data?.message ?? "Failed to add user"
  } finally {
    creating.value = false
  }
}

async function toggleActive(u: any) {
  const action = u.isActive ? "Deactivate" : "Activate"
  if (!confirm(`${action} ${u.email}?`)) return
  await $fetch(`/api/admin/users/${u.id}`, { method: "PATCH", body: { isActive: !u.isActive } })
  await refresh()
}

function closeCreate() {
  showCreate.value = false; form.email = ""; form.name = ""; createError.value = ""
}
</script>
