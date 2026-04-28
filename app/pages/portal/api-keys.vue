<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
        {{ $t('portal.apiKeys.title') }}
      </h1>
      <UButton icon="i-lucide-plus" color="amber" @click="showCreate = true">
        {{ $t('portal.apiKeys.createBtn') }}
      </UButton>
    </div>

    <!-- Keys list -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="py-12 text-center text-sm text-gray-500 dark:text-neutral-400">
        {{ $t('portal.apiKeys.loading') }}
      </div>
      <div v-else-if="!data?.items?.length" class="py-12 text-center text-sm text-gray-400 dark:text-neutral-500">
        <UIcon name="i-heroicons-key" class="w-10 h-10 mb-3 opacity-30 mx-auto" />
        <p>{{ $t('portal.apiKeys.empty') }}</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.apiKeys.colName') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.apiKeys.colPrefix') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden md:table-cell">{{ $t('portal.apiKeys.colScopes') }}</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden sm:table-cell">{{ $t('portal.apiKeys.colEnv') }}</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">{{ $t('portal.apiKeys.colStatus') }}</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200 hidden lg:table-cell">{{ $t('portal.apiKeys.colCreated') }}</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-neutral-800">
            <tr
              v-for="k in data.items"
              :key="k.id"
              class="hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <td class="px-4 py-3">
                <span class="text-sm font-medium text-gray-900 dark:text-neutral-100">{{ k.name }}</span>
                <div v-if="k.merchantAccount" class="text-xs text-gray-400 dark:text-neutral-500">{{ k.merchantAccount.name }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="font-mono text-xs text-gray-500 dark:text-neutral-400">{{ k.keyPrefix }}…</span>
              </td>
              <td class="px-4 py-3 hidden md:table-cell">
                <div class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="scope in k.scopes"
                    :key="scope"
                    color="neutral"
                    variant="subtle"
                    size="xs"
                  >{{ scope }}</UBadge>
                </div>
              </td>
              <td class="px-4 py-3 text-center hidden sm:table-cell">
                <UBadge :color="k.environment === 'LIVE' ? 'emerald' : 'amber'" variant="soft" size="xs">
                  {{ k.environment }}
                </UBadge>
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge :color="k.status === 'ACTIVE' ? 'emerald' : 'red'" variant="soft" size="xs">
                  {{ k.status }}
                </UBadge>
              </td>
              <td class="px-4 py-3 hidden lg:table-cell">
                <span class="text-xs text-gray-500 dark:text-neutral-400">{{ fmtDate(k.createdAt) }}</span>
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  v-if="k.status === 'ACTIVE'"
                  color="red"
                  variant="ghost"
                  size="xs"
                  :loading="revoking === k.id"
                  @click="confirmRevoke(k)"
                >
                  {{ $t('portal.apiKeys.revokeBtn') }}
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Create modal -->
    <UModal v-model:open="showCreate" :title="$t('portal.apiKeys.createModal.title')">
      <template #body>
        <div class="space-y-4">
          <UFormField :label="$t('portal.apiKeys.createModal.nameLabel')">
            <UInput v-model="form.name" :placeholder="$t('portal.apiKeys.createModal.namePlaceholder')" class="w-full" />
          </UFormField>
          <UFormField :label="$t('portal.apiKeys.createModal.envLabel')">
            <USelect
              v-model="form.environment"
              :items="[{ value: 'test', label: 'Test' }, { value: 'live', label: 'Live' }]"
              value-key="value"
              label-key="label"
              class="w-full"
            />
          </UFormField>
          <UFormField :label="$t('portal.apiKeys.createModal.scopesLabel')">
            <div class="space-y-1.5">
              <label
                v-for="scope in AVAILABLE_SCOPES"
                :key="scope"
                class="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-200 cursor-pointer"
              >
                <input
                  type="checkbox"
                  :value="scope"
                  v-model="form.scopes"
                  class="rounded border-gray-300 dark:border-neutral-600"
                />
                <span class="font-mono text-xs">{{ scope }}</span>
              </label>
            </div>
          </UFormField>
          <p v-if="createError" class="text-sm text-red-500 dark:text-red-400">{{ createError }}</p>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end">
          <UButton color="neutral" variant="outline" @click="showCreate = false">
            {{ $t('portal.apiKeys.createModal.cancelBtn') }}
          </UButton>
          <UButton
            color="amber"
            :loading="creating"
            :disabled="!form.name || !form.scopes.length"
            @click="doCreate"
          >
            {{ $t('portal.apiKeys.createModal.submitBtn') }}
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Key created modal -->
    <UModal v-model:open="showKeyResult" :title="$t('portal.apiKeys.keyCreated.title')" :closable="false">
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="amber"
            variant="soft"
            icon="i-heroicons-exclamation-triangle"
            :description="$t('portal.apiKeys.keyCreated.warning')"
          />
          <div class="rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 px-4 py-3">
            <p class="font-mono text-sm text-gray-800 dark:text-neutral-100 break-all">{{ newKeyValue }}</p>
          </div>
          <UButton
            block
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            @click="copyKey"
          >
            {{ copied ? '✓ Copied' : $t('portal.apiKeys.keyCreated.copyBtn') }}
          </UButton>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end">
          <UButton color="amber" @click="showKeyResult = false; refresh()">
            {{ $t('portal.apiKeys.keyCreated.doneBtn') }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'portal', middleware: 'portal-auth' })

const { $t } = useI18n()

const AVAILABLE_SCOPES = [
  'payments:create',
  'payments:read',
  'api_keys:manage',
]

const showCreate = ref(false)
const creating = ref(false)
const createError = ref('')
const revoking = ref<string | null>(null)

const showKeyResult = ref(false)
const newKeyValue = ref('')
const copied = ref(false)

const form = reactive({
  name: '',
  environment: 'test' as 'test' | 'live',
  scopes: [] as string[],
})

function fmtDate(date: string | Date) {
  return new Date(date).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

async function copyKey() {
  await navigator.clipboard.writeText(newKeyValue.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function doCreate() {
  if (!form.name || !form.scopes.length) return
  creating.value = true
  createError.value = ''
  try {
    const res = await $fetch<{ fullKey?: string; error?: string; message?: string }>('/api/portal/api-keys', {
      method: 'POST',
      body: { name: form.name, environment: form.environment, scopes: form.scopes },
    })
    if (res.error) {
      createError.value = res.message ?? res.error
      return
    }
    newKeyValue.value = res.fullKey ?? ''
    showCreate.value = false
    showKeyResult.value = true
    form.name = ''
    form.scopes = []
    form.environment = 'test'
  } catch (e: any) {
    createError.value = e?.data?.message ?? 'Error creating key'
  } finally {
    creating.value = false
  }
}

async function confirmRevoke(key: { id: string; name: string }) {
  const ok = confirm($t('portal.apiKeys.confirmRevoke', { name: key.name }))
  if (!ok) return
  revoking.value = key.id
  try {
    await $fetch(`/api/portal/api-keys/${key.id}/revoke`, { method: 'POST' })
    await refresh()
  } finally {
    revoking.value = null
  }
}

const { data, pending, refresh } = await useFetch('/api/portal/api-keys')
</script>
