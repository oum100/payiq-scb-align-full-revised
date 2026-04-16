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
            <span class="text-gray-900 dark:text-white font-medium">API Keys</span>
          </div>
        </div>
        <div class="flex items-center gap-3 mt-1">
          <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">API Keys</h1>
          <div class="flex items-center gap-2">
            <!-- Total -->
            <span class="text-sm text-gray-500 dark:text-neutral-400">{{ items.length }} total</span>
            <span class="text-gray-300 dark:text-neutral-700">·</span>
            <!-- Active -->
            <span class="flex items-center gap-1 text-sm">
              <span class="w-2 h-2 rounded-full bg-green-500"></span>
              <span class="text-gray-700 dark:text-neutral-300">{{ activeItems.length }} active</span>
            </span>
            <span class="text-gray-300 dark:text-neutral-700">·</span>
            <!-- Revoked -->
            <span class="flex items-center gap-1 text-sm">
              <span class="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500/70"></span>
              <span class="text-gray-500 dark:text-neutral-500">{{ revokedItems.length }} revoked</span>
            </span>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          :label="showRevoked ? 'Hide Revoked' : 'Show Revoked'"
          :icon="showRevoked ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          color="neutral"
          variant="outline"
          size="sm"
          @click="showRevoked = !showRevoked"
        />
        <UButton
          v-if="showRevoked"
          :label="oldRevokedCount > 0 ? `Purge > 2yr (${oldRevokedCount})` : 'Purge > 2yr'"
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          size="sm"
          :loading="purging"
          :disabled="oldRevokedCount === 0"
          @click="purgeOldRevoked"
        />
        <UButton label="+ Generate Key" color="warning" variant="soft" @click="openCreate" />
      </div>
    </div>

    <!-- New key reveal banner -->
    <UAlert v-if="newKey" color="warning" variant="soft" class="mb-4" icon="i-lucide-key">
      <template #title>Save this key — it won't be shown again</template>
      <template #description>
        <code class="font-mono text-sm break-all select-all block mb-3">{{ newKey }}</code>
        <UButton
          size="sm"
          color="warning"
          variant="outline"
          :icon="copiedId === 'newKey' ? 'i-lucide-check' : 'i-lucide-copy'"
          @click="copyText(newKey, 'newKey')"
        >Copy Key</UButton>
      </template>
    </UAlert>

    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Merchant</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                API Key <span class="normal-case font-normal text-gray-500 dark:text-neutral-400">(prefix only)</span>
              </th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Status</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Last Used</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Created At</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Env</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="k in visibleItems" :key="k.id"
              class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors"
              :class="k.status === 'REVOKED' ? 'opacity-50' : ''">
              <td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-neutral-100">{{ k.name }}</td>
              <td class="px-4 py-3 text-sm text-gray-600 dark:text-neutral-300">{{ k.merchant?.name ?? '—' }}</td>
              <td class="px-4 py-3">
                <span class="font-mono text-sm text-gray-700 dark:text-neutral-300">{{ k.keyPrefix }}…</span>
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="k.status" :color="keyStatusColor(k.status)" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ k.lastUsedAt ? fmtDate(k.lastUsedAt) : '—' }}</td>
              <td class="px-4 py-3 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDate(k.createdAt) }}</td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="k.environment" :color="k.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  v-if="k.status === 'ACTIVE'"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="sm"
                  title="Revoke key"
                  :loading="revoking === k.id"
                  @click="revokeKey(k.id)"
                />
              </td>
            </tr>
            <tr v-if="!visibleItems.length">
              <td colspan="8" class="text-center py-12 text-sm text-gray-500 dark:text-neutral-500">
                {{ showRevoked ? 'No API keys' : 'No active keys — click "Show Revoked" to see revoked keys' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Generate Key Modal -->
    <div v-if="modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="modal = false">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">Generate API Key</h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="modal = false" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitCreate">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Key Name</label>
            <UInput v-model="form.name" placeholder="e.g. Production Key" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Merchant</label>
            <USelect v-model="form.merchantId" :items="merchantOptions" value-key="value" label-key="label" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-700 dark:text-neutral-200">Environment</label>
            <USelect v-model="form.environment" :items="[{ label: 'TEST', value: 'TEST' }, { label: 'LIVE', value: 'LIVE' }]" value-key="value" label-key="label" />
          </div>
          <div v-if="formError" class="text-sm text-red-500 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{{ formError }}</div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="modal = false" />
            <UButton type="submit" :label="submitting ? 'Generating…' : 'Generate'" color="warning" variant="soft" :disabled="submitting" />
          </div>
        </form>
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

const { data, pending, refresh } = await useFetch(`/api/admin/tenants/${tenantId}/api-keys`)
const items = computed(() => (data.value as any)?.items ?? [])

const showRevoked = ref(false)
const activeItems  = computed(() => items.value.filter((k: any) => k.status !== 'REVOKED'))
const revokedItems = computed(() => items.value.filter((k: any) => k.status === 'REVOKED'))
const visibleItems = computed(() => showRevoked.value ? items.value : activeItems.value)

const twoYearsAgo = computed(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 2); return d })
const oldRevokedCount = computed(() =>
  revokedItems.value.filter((k: any) => new Date(k.createdAt) < twoYearsAgo.value).length
)

const { data: merchantsData } = await useFetch(`/api/admin/tenants/${tenantId}/merchants`)
const merchantOptions = computed(() =>
  ((merchantsData.value as any)?.items ?? []).map((m: any) => ({ label: `${m.name} (${m.environment})`, value: m.id }))
)

function keyStatusColor(s: string): 'success' | 'error' | 'warning' | 'neutral' {
  if (s === 'ACTIVE') return 'success'
  if (s === 'REVOKED') return 'error'
  if (s === 'SUSPENDED') return 'warning'
  return 'neutral'
}

const purging = ref(false)

async function purgeOldRevoked() {
  if (!confirm(`ลบ revoked keys ที่เก่ากว่า 2 ปี จำนวน ${oldRevokedCount.value} รายการ?\nไม่สามารถย้อนกลับได้`)) return
  purging.value = true
  try {
    const res = await $fetch<{ deleted: number }>(`/api/admin/tenants/${tenantId}/api-keys/purge-revoked`, { method: 'DELETE' })
    toast.add({ title: `Purged ${res.deleted} key${res.deleted !== 1 ? 's' : ''}`, color: 'success', timeout: 3000, icon: 'i-lucide-trash-2' })
    await refresh()
  } catch (e: any) {
    toast.add({ title: 'Purge failed', description: e?.data?.message ?? e?.message, color: 'error', timeout: 3000 })
  } finally { purging.value = false }
}

const modal = ref(false)
const form = reactive({ name: '', merchantId: '', environment: 'TEST' })
const submitting = ref(false)
const formError = ref('')
const newKey = ref<string | null>(null)
const revoking = ref<string | null>(null)

function openCreate() {
  form.name = ''; form.merchantId = merchantOptions.value[0]?.value ?? ''; form.environment = 'TEST'
  formError.value = ''; newKey.value = null; modal.value = true
}

async function submitCreate() {
  formError.value = ''; submitting.value = true
  try {
    const res = await $fetch<{ fullKey: string }>(`/api/admin/tenants/${tenantId}/api-keys`, {
      method: 'POST',
      body: { merchantId: form.merchantId, name: form.name, environment: form.environment },
    })
    newKey.value = res.fullKey
    await refresh(); modal.value = false
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}

async function revokeKey(id: string) {
  revoking.value = id
  try {
    await $fetch(`/api/admin/tenants/${tenantId}/api-keys/${id}`, { method: 'DELETE' })
    await refresh()
  } finally { revoking.value = null }
}

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
