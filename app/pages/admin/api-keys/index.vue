<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        API Keys
      </h1>
      <UButton
        icon="i-heroicons-plus"
        color="amber"
        variant="solid"
        size="sm"
        @click="showCreate = true"
      >
        New API Key
      </UButton>
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-400 text-sm">
        Loading…
      </div>
      <div v-else-if="!items.length" class="flex items-center justify-center py-16 text-gray-500 dark:text-neutral-400 text-sm">
        No API keys found
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Prefix</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Environment</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Scopes</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Merchant</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Last used</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-neutral-200">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="k in items"
              :key="k.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-400">{{ k.keyPrefix }}</td>
              <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{{ k.name }}</td>
              <td class="px-4 py-3">
                <UBadge :color="k.status === 'ACTIVE' ? 'green' : 'neutral'" variant="subtle" size="xs">{{ k.status }}</UBadge>
              </td>
              <td class="px-4 py-3">
                <UBadge :color="k.environment === 'LIVE' ? 'green' : 'blue'" variant="subtle" size="xs">{{ k.environment }}</UBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  <UBadge v-for="sc in k.scopes" :key="sc" color="blue" variant="subtle" size="xs">{{ sc }}</UBadge>
                </div>
              </td>
              <td class="px-4 py-3 text-gray-500 dark:text-neutral-400 text-xs">{{ k.merchantAccount?.name ?? "Tenant-level" }}</td>
              <td class="px-4 py-3 text-gray-500 dark:text-neutral-400 text-xs">{{ k.lastUsedAt ? fmtDate(k.lastUsedAt) : "Never" }}</td>
              <td class="px-4 py-3">
                <UButton
                  v-if="k.status === 'ACTIVE'"
                  color="red"
                  variant="subtle"
                  size="xs"
                  @click="revoke(k.id)"
                >
                  Revoke
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Create modal -->
    <div
      v-if="showCreate"
      class="fixed inset-0 z-50 flex items-center justify-center p-5 bg-black/50"
      @click.self="showCreate = false"
    >
      <UCard class="w-full max-w-md" :ui="{ body: 'p-7' }">
        <template #header>
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Create API Key</h2>
        </template>

        <div class="space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Name</label>
            <UInput v-model="form.name" placeholder="e.g. Production key" class="w-full" />
          </div>

          <!-- Environment -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-1">Environment</label>
            <USelect
              v-model="form.environment"
              :options="[{ label: 'TEST', value: 'TEST' }, { label: 'LIVE', value: 'LIVE' }]"
              class="w-full"
            />
          </div>

          <!-- Scopes -->
          <div>
            <label class="block text-xs font-medium text-gray-500 dark:text-neutral-400 mb-2">Scopes</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="s in ALL_SCOPES"
                :key="s"
                class="flex items-center gap-2 text-xs text-gray-700 dark:text-neutral-200 cursor-pointer select-none"
              >
                <input type="checkbox" :value="s" v-model="form.scopes" class="rounded" />
                {{ s }}
              </label>
            </div>
          </div>

          <!-- New key banner -->
          <div
            v-if="createdKey"
            class="rounded-lg border border-amber-400/30 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2"
          >
            <p class="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Copy this key — it won't be shown again
            </p>
            <code class="block font-mono text-xs text-gray-800 dark:text-neutral-200 break-all">{{ createdKey }}</code>
            <UButton size="xs" color="amber" variant="outline" @click="copy(createdKey)">
              {{ copied ? "Copied!" : "Copy" }}
            </UButton>
          </div>
        </div>

        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" @click="closeCreate">Close</UButton>
            <UButton
              v-if="!createdKey"
              color="amber"
              variant="solid"
              :disabled="!form.name || !form.scopes.length || creating"
              :loading="creating"
              @click="createKey"
            >
              Create
            </UButton>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const ALL_SCOPES = ["payments:create", "payments:read", "api_keys:manage", "webhooks:manage"]

const showCreate = ref(false)
const creating = ref(false)
const createdKey = ref("")
const copied = ref(false)
const form = reactive({ name: "", scopes: [] as string[], environment: "TEST" })

const { data, pending, refresh } = await useFetch("/api/v1/api-keys")
const items = computed(() => (data.value as any)?.items ?? [])

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
}

async function createKey() {
  if (!form.name || !form.scopes.length) return
  creating.value = true
  try {
    const res = await $fetch<any>("/api/v1/api-keys", {
      method: "POST",
      body: { name: form.name, scopes: form.scopes, environment: form.environment },
    })
    createdKey.value = res.fullKey
    await refresh()
  } catch (e: any) {
    alert(e?.data?.message ?? "Failed to create key")
  } finally {
    creating.value = false
  }
}

async function revoke(id: string) {
  if (!confirm("Revoke this API key? This cannot be undone.")) return
  await $fetch(`/api/v1/api-keys/${id}/revoke`, { method: "POST" })
  await refresh()
}

function closeCreate() {
  showCreate.value = false
  createdKey.value = ""
  copied.value = false
  form.name = ""
  form.scopes = []
  form.environment = "TEST"
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>
