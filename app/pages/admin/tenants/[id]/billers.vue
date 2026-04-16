<template>
  <div class="min-h-screen bg-slate-100 dark:bg-neutral-950 p-6">
    <!-- Breadcrumb + header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" :to="`/admin/tenants/${tenantId}`" />
          <div class="flex items-center gap-1.5 text-sm text-gray-500 dark:text-neutral-500 dark:text-neutral-400">
            <NuxtLink :to="`/admin/tenants/${tenantId}`" class="hover:text-amber-500 transition-colors">{{ tenantName }}</NuxtLink>
            <span>/</span>
            <span class="text-gray-800 dark:text-neutral-200 font-medium">Billers</span>
          </div>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-800 dark:text-neutral-200">Biller Profiles</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-500 mt-1">{{ items.length }} biller{{ items.length !== 1 ? 's' : '' }} configured</p>
      </div>
      <UButton label="+ New Biller" color="warning" variant="soft" @click="openCreate" />
    </div>

    <!-- Table -->
    <UCard :ui="{ body: 'p-0' }">
      <div v-if="pending" class="text-center py-12 text-sm text-gray-600 dark:text-neutral-400">Loading…</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="border-b border-gray-200 dark:border-neutral-800">
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Display Name</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Code</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Provider</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Mode</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Env</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Biller ID</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">PromptPay</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Status</th>
              <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Routes</th>
              <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-neutral-400">Created</th>
              <th class="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in items" :key="b.id"
              class="border-b border-gray-100 dark:border-neutral-800/50 last:border-0 hover:bg-gray-100/80 dark:hover:bg-neutral-800/40 transition-colors">
              <td class="px-4 py-3 font-medium text-gray-800 dark:text-neutral-200">{{ b.displayName }}</td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-500">{{ b.code }}</td>
              <td class="px-4 py-3">
                <UBadge :label="b.providerCode" :color="providerBadgeColor(b.providerCode)" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3">
                <UBadge :label="providerMode(b.providerCode)" :color="providerModeColor(b.providerCode)" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3">
                <UBadge :label="b.environment" :color="b.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 font-mono text-xs text-gray-500 dark:text-neutral-500">{{ b.billerId ?? '—' }}</td>
              <td class="px-4 py-3">
                <div v-if="(b.config as any)?.promptpay" class="flex flex-col gap-0.5">
                  <UBadge :label="(b.config as any).promptpay.proxyType" color="warning" variant="soft" size="xs" />
                  <span class="font-mono text-xs text-gray-500 dark:text-neutral-500">{{ (b.config as any).promptpay.billerId ?? '—' }}</span>
                </div>
                <span v-else class="text-xs text-gray-400 dark:text-neutral-600">—</span>
              </td>
              <td class="px-4 py-3 text-center">
                <UBadge :label="b.status" :color="statusColor(b.status)" variant="soft" size="sm" />
              </td>
              <td class="px-4 py-3 text-center text-gray-700 dark:text-neutral-300">{{ b._count?.paymentRoutes ?? 0 }}</td>
              <td class="px-4 py-3 text-xs text-gray-500 dark:text-neutral-500">{{ fmtDate(b.createdAt) }}</td>
              <td class="px-4 py-3">
                <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(b)" />
              </td>
            </tr>
            <tr v-if="!items.length">
              <td colspan="11" class="text-center py-12 text-gray-500 dark:text-neutral-500">No billers configured yet</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- ═══ Modal — fullscreen-ish landscape ═══ -->
    <div v-if="modal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" @click.self="closeModal">
      <UCard class="w-full max-w-6xl max-h-[96vh] overflow-y-auto" :ui="{ body: 'p-0' }">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-200">
              {{ modal.mode === 'create' ? 'New Biller Profile' : 'Edit Biller Profile' }}
            </h2>
            <UBadge
              v-if="modal.mode === 'edit'"
              :label="providerMode(modal.biller?.providerCode ?? '')"
              :color="providerModeColor(modal.biller?.providerCode ?? '')"
              variant="soft"
              size="sm"
            />
          </div>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="closeModal" />
        </div>

        <form class="px-6 py-5 flex flex-col gap-6" @submit.prevent="submitModal">

          <!-- ── Row 1: Name + Code ── -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Display Name</label>
              <UInput v-model="form.displayName" placeholder="e.g. KBANK PromptPay LIVE" required />
            </div>
            <div class="flex flex-col gap-1.5">
              <template v-if="modal.mode === 'create'">
                <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Code <span class="text-gray-500 dark:text-neutral-500 font-normal">(lowercase · immutable)</span></label>
                <UInput v-model="form.code" placeholder="e.g. kbank-promptpay-live" pattern="[a-z0-9_-]+" required />
              </template>
              <template v-else>
                <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Code</label>
                <div class="font-mono text-sm text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2 h-9 flex items-center">{{ modal.biller?.code }}</div>
              </template>
            </div>
          </div>

          <!-- ── Row 2: Provider (wide) + Environment (short) + Priority + Status ── -->
          <div class="grid grid-cols-6 gap-4">
            <!-- Provider — col-span-3 -->
            <div class="col-span-3 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Provider</label>
              <template v-if="modal.mode === 'create'">
                <USelect
                  v-model="form.providerCode"
                  :items="providerOptions"
                  value-key="value"
                  label-key="label"
                  :selected-icon="''"
                  size="lg"
                  required
                />
                <p v-if="selectedProviderOption?.description" class="text-sm text-gray-600 dark:text-neutral-400 mt-0.5">
                  {{ selectedProviderOption.description }}
                </p>
              </template>
              <div v-else class="font-mono text-sm text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2 h-9 flex items-center">{{ modal.biller?.providerCode }}</div>
            </div>
            <!-- Environment — col-span-1 -->
            <div class="col-span-1 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Env</label>
              <USelect
                v-if="modal.mode === 'create'"
                v-model="form.environment"
                :items="envOptions"
                value-key="value"
                label-key="label"
                :selected-icon="''"
                required
              />
              <div v-else class="font-mono text-sm text-gray-600 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2 h-9 flex items-center">{{ modal.biller?.environment }}</div>
            </div>
            <!-- Priority — col-span-1 -->
            <div class="col-span-1 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Priority <span class="text-gray-500 dark:text-neutral-500 font-normal text-xs">(ต่ำ = สูง)</span></label>
              <UInput v-model="form.priority" type="number" min="1" max="999" placeholder="100" />
            </div>
            <!-- Status — col-span-1 (edit only) -->
            <div v-if="modal.mode === 'edit'" class="col-span-1 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Status</label>
              <USelect v-model="form.status" :items="statusOptions" value-key="value" label-key="label" :selected-icon="''" />
            </div>
          </div>

          <!-- ══════════════════════════════════════════════════════════ -->
          <!-- LEFT + RIGHT columns -->
          <div class="grid grid-cols-2 gap-6">

            <!-- ── LEFT: API Gateway Config (SCB/KBANK/BAY) ── -->
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-plug-zap" class="w-4 h-4" :class="isApiGateway(currentProvider) ? 'text-blue-400' : 'text-gray-400 dark:text-neutral-600'" />
                <span class="text-sm font-semibold uppercase tracking-wide" :class="isApiGateway(currentProvider) ? 'text-blue-400' : 'text-gray-400 dark:text-neutral-600'">
                  API Gateway Config
                </span>
                <span v-if="!isApiGateway(currentProvider)" class="text-sm text-gray-400 dark:text-neutral-600">(ไม่ใช้)</span>
              </div>
              <div class="flex flex-col gap-3" :class="!isApiGateway(currentProvider) ? 'opacity-25 pointer-events-none select-none' : ''">
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Biller ID <span class="text-gray-600 dark:text-neutral-400 font-normal">(จาก provider)</span></label>
                  <UInput v-model="form.billerId" placeholder="e.g. 123456789" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Merchant ID at Provider</label>
                  <UInput v-model="form.merchantIdAtProvider" placeholder="e.g. MERCHANT001" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Credentials Ref <span class="text-gray-600 dark:text-neutral-400 font-normal">(vault key)</span></label>
                  <UInput v-model="form.credentialsRef" placeholder="e.g. scb-live-creds-v1" />
                </div>
              </div>
            </div>

            <!-- ── RIGHT: PromptPay / Bill Payment Config ── -->
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-qr-code" class="w-4 h-4" :class="isDirectQR(currentProvider) ? 'text-amber-400' : 'text-gray-400 dark:text-neutral-600'" />
                <span class="text-sm font-semibold uppercase tracking-wide" :class="isDirectQR(currentProvider) ? 'text-amber-400' : 'text-gray-400 dark:text-neutral-600'">
                  Thai QR / Bill Payment Config
                </span>
                <span v-if="!isDirectQR(currentProvider)" class="text-sm text-gray-400 dark:text-neutral-600">(ไม่ใช้)</span>
              </div>
              <div class="flex flex-col gap-3" :class="!isDirectQR(currentProvider) ? 'opacity-25 pointer-events-none select-none' : ''">

                <!-- QR Auto-fill section -->
                <div class="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-4 py-3 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-800 dark:text-neutral-200">ตั้งค่าจาก QR อัตโนมัติ</span>
                    <div class="flex items-center gap-2">
                      <UButton
                        icon="i-lucide-image-up"
                        label="Upload QR"
                        color="warning"
                        variant="soft"
                        size="xs"
                        :loading="qrDecoding"
                        :disabled="!isDirectQR(currentProvider)"
                        @click="qrFileInput?.click()"
                      />
                      <UButton
                        :icon="showQRPaste ? 'i-lucide-chevron-up' : 'i-lucide-clipboard-paste'"
                        :label="showQRPaste ? 'ซ่อน' : 'วาง QR Text'"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        :disabled="!isDirectQR(currentProvider)"
                        @click="showQRPaste = !showQRPaste"
                      />
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-neutral-500">Upload ภาพ QR (MaeMaNee / KShop) หรือวาง QR string แล้วระบบจะดึงค่าให้อัตโนมัติ</p>
                  <!-- Paste QR text area -->
                  <div v-if="showQRPaste" class="flex flex-col gap-2 pt-1">
                    <textarea
                      v-model="qrPasteText"
                      rows="3"
                      placeholder="วาง QR string ตรงนี้ เช่น 000201010212…"
                      class="w-full font-mono text-xs bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-amber-500"
                    />
                    <UButton
                      label="Decode & Fill"
                      icon="i-lucide-scan"
                      color="warning"
                      variant="soft"
                      size="xs"
                      :disabled="!qrPasteText.trim()"
                      @click="parseAndFillQR(qrPasteText)"
                    />
                  </div>
                  <p v-if="qrError" class="text-xs text-red-400">{{ qrError }}</p>
                  <p v-if="qrSuccess" class="text-xs text-green-400">✅ {{ qrSuccess }}</p>
                  <!-- Hidden file input -->
                  <input
                    ref="qrFileInput"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onQRFileSelected"
                  />
                </div>

                <!-- Proxy Type -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Proxy Type</label>
                  <USelect
                    v-model="form.config.proxyType"
                    :items="proxyTypeOptions"
                    value-key="value"
                    label-key="label"
                    :selected-icon="''"
                    size="lg"
                    placeholder="Select proxy type…"
                  />
                  <p v-if="selectedProxyTypeOption?.description" class="text-sm text-gray-600 dark:text-neutral-400 mt-0.5">
                    {{ selectedProxyTypeOption.description }}
                  </p>
                </div>

                <!-- PromptPay / Bill Payment ID -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">
                    {{ form.config.proxyType === 'BILL_PAYMENT' ? 'Bill Payment ID' : 'PromptPay Biller ID' }}
                    <span class="text-gray-600 dark:text-neutral-400 font-normal">(15 หลัก)</span>
                  </label>
                  <UInput v-model="form.config.billerId" placeholder="e.g. 010753600010286" maxlength="15" />
                </div>

                <!-- Ref1 / Ref2 — only for BILL_PAYMENT -->
                <template v-if="form.config.proxyType === 'BILL_PAYMENT'">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref1 Value</label>
                      <UInput v-model="form.config.ref1" placeholder="e.g. 014000003906609" />
                      <p class="text-xs text-gray-500 dark:text-neutral-500">terminal / merchant code (คงที่)</p>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref1 Mode</label>
                      <USelect
                        v-model="form.config.ref1Mode"
                        :items="ref1ModeOptions"
                        value-key="value"
                        label-key="label"
                        :selected-icon="''"
                        size="lg"
                        placeholder="Select…"
                      />
                      <p v-if="selectedRef1ModeOption?.description" class="text-xs text-gray-600 dark:text-neutral-400">{{ selectedRef1ModeOption.description }}</p>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref2 Mode</label>
                    <USelect
                      v-model="form.config.ref2Mode"
                      :items="ref2ModeOptions"
                      value-key="value"
                      label-key="label"
                      :selected-icon="''"
                      size="lg"
                      placeholder="Select…"
                    />
                    <p v-if="selectedRef2ModeOption?.description" class="text-sm text-gray-600 dark:text-neutral-400">{{ selectedRef2ModeOption.description }}</p>
                  </div>
                  <div v-if="form.config.ref2Mode === 'fixed'" class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref2 Fixed Value</label>
                    <UInput v-model="form.config.ref2Fixed" placeholder="fixed ref2 value" />
                  </div>
                </template>

                <!-- Summary box -->
                <div v-if="form.config.proxyType && form.config.billerId" class="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2.5 text-xs font-mono text-gray-700 dark:text-neutral-300 space-y-0.5">
                  <div><span class="text-gray-500 dark:text-neutral-500">proxyType:</span> <span class="text-amber-400">{{ form.config.proxyType }}</span></div>
                  <div><span class="text-gray-500 dark:text-neutral-500">billerId:</span> {{ form.config.billerId }}</div>
                  <div v-if="form.config.ref1"><span class="text-gray-500 dark:text-neutral-500">ref1:</span> {{ form.config.ref1 }} <span class="text-gray-400 dark:text-neutral-600">({{ form.config.ref1Mode || 'fixed' }})</span></div>
                  <div v-if="form.config.ref2Mode"><span class="text-gray-500 dark:text-neutral-500">ref2:</span> <span class="text-green-400">{{ form.config.ref2Mode }}</span></div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="formError" class="text-sm text-red-400 bg-red-950/40 border border-red-800 rounded-md px-3 py-2">{{ formError }}</div>

          <div class="flex justify-end gap-2 pt-1 border-t border-gray-200 dark:border-neutral-800">
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
  credentialsRef: string | null
  status: string; priority: number; createdAt: string; config: Record<string, any> | null
  _count: { paymentRoutes: number }
}

const { data, pending, refresh } = await useFetch<{ items: BillerRow[] }>(`/api/admin/tenants/${tenantId}/billers`)
const items = computed(() => data.value?.items ?? [])

const { data: tenantData } = await useFetch<{ name: string }>(`/api/admin/tenants/${tenantId}`)
const tenantName = computed(() => tenantData.value?.name ?? tenantId)

const API_GATEWAY_PROVIDERS = ['SCB', 'KBANK', 'BAY']
const DIRECT_QR_PROVIDERS   = ['THAI_QR']
const EWALLET_PROVIDERS     = ['E_WALLET']

function isApiGateway(provider: string) { return API_GATEWAY_PROVIDERS.includes(provider) }
function isDirectQR(provider: string)   { return DIRECT_QR_PROVIDERS.includes(provider) }
function isEWallet(provider: string)    { return EWALLET_PROVIDERS.includes(provider) }

function providerMode(provider: string) {
  if (isApiGateway(provider)) return 'API Gateway'
  if (isDirectQR(provider)) return 'Direct QR'
  if (isEWallet(provider)) return 'E-Wallet'
  if (provider === 'SANDBOX') return 'Sandbox'
  return 'Other'
}
function providerModeColor(provider: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (isApiGateway(provider)) return 'info'
  if (isDirectQR(provider)) return 'warning'
  if (isEWallet(provider)) return 'success'
  return 'neutral'
}
function providerBadgeColor(p: string): 'info' | 'success' | 'warning' | 'neutral' {
  if (p === 'SCB') return 'info'
  if (p === 'KBANK') return 'success'
  if (p === 'PROMPTPAY' || p === 'THAI_QR') return 'warning'
  return 'neutral'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function statusColor(s: string): 'success' | 'warning' | 'neutral' {
  if (s === 'ACTIVE') return 'success'
  if (s === 'INACTIVE') return 'warning'
  return 'neutral'
}

// ── Options with clean labels + description field ──
const providerOptions = [
  { label: 'SCB',      value: 'SCB',      description: 'API Gateway — SCB Open API' },
  { label: 'KBANK',    value: 'KBANK',    description: 'API Gateway — KBANK Easy API' },
  { label: 'BAY',      value: 'BAY',      description: 'API Gateway — Krungsri (Bay)' },
  { label: 'THAI_QR',  value: 'THAI_QR',  description: 'Direct QR — สร้าง Thai QR เอง (Bill Payment + PromptPay)' },
  { label: 'E_WALLET', value: 'E_WALLET', description: 'E-Wallet — TrueMoney, Rabbit LINE Pay ฯลฯ' },
  { label: 'SANDBOX',  value: 'SANDBOX',  description: 'ทดสอบ — จำลองการจ่ายเงิน ไม่ผ่านระบบจริง' },
]
const envOptions = [
  { label: 'TEST', value: 'TEST' },
  { label: 'LIVE', value: 'LIVE' },
]
const statusOptions = [
  { label: 'ACTIVE',   value: 'ACTIVE' },
  { label: 'INACTIVE', value: 'INACTIVE' },
  { label: 'DISABLED', value: 'DISABLED' },
]
const proxyTypeOptions = [
  { label: 'BILL_PAYMENT',  value: 'BILL_PAYMENT',  description: 'AID 0112 · มี Ref1/Ref2 · auto-confirm ได้ ✅ (MaeMaNee, KShop)' },
  { label: 'BILLER_ID',     value: 'BILLER_ID',     description: 'AID 0111 · PromptPay static · reconcile ด้วย amount+time' },
  { label: 'MOBILE',        value: 'MOBILE',         description: 'AID 0111 · เบอร์มือถือ · reconcile ด้วย amount+time' },
  { label: 'TAX_ID',        value: 'TAX_ID',        description: 'AID 0111 · เลขผู้เสียภาษี · reconcile ด้วย amount+time' },
  { label: 'NATIONAL_ID',   value: 'NATIONAL_ID',   description: 'AID 0111 · เลขบัตรประชาชน · reconcile ด้วย amount+time' },
]
const ref1ModeOptions = [
  { label: 'fixed',        value: 'fixed',        description: 'ใส่ค่าคงที่ เช่น terminal code หรือ merchant code' },
  { label: 'merchantCode', value: 'merchantCode', description: 'ดึงจาก merchant.code โดยอัตโนมัติ' },
]
const ref2ModeOptions = [
  { label: 'merchantOrderId', value: 'merchantOrderId', description: 'Dynamic QR — ใช้ Order ID ✅ (e-commerce / kiosk)' },
  { label: 'fixed',           value: 'fixed',           description: 'Static QR — merchant encode string เอง (IoT / vending)' },
  { label: 'none',            value: 'none',            description: 'ไม่มี Ref2' },
]

// ── Modal state ──
const modal = reactive<{ open: boolean; mode: 'create' | 'edit'; biller: BillerRow | null }>({
  open: false, mode: 'create', biller: null,
})
const form = reactive({
  displayName: '',
  code: '',
  providerCode: 'THAI_QR',
  environment: 'TEST',
  billerId: '',
  merchantIdAtProvider: '',
  credentialsRef: '',
  priority: '100',
  status: 'ACTIVE',
  config: {
    proxyType: 'BILL_PAYMENT',
    billerId: '',
    ref1: '',
    ref1Mode: 'fixed',
    ref2Mode: 'merchantOrderId',
    ref2Fixed: '',
  },
})
const submitting = ref(false)
const formError = ref('')

const currentProvider = computed(() =>
  modal.mode === 'edit' ? (modal.biller?.providerCode ?? '') : form.providerCode
)

// Computed selected option descriptions
const selectedProviderOption   = computed(() => providerOptions.find(o => o.value === form.providerCode))
const selectedProxyTypeOption  = computed(() => proxyTypeOptions.find(o => o.value === form.config.proxyType))
const selectedRef1ModeOption   = computed(() => ref1ModeOptions.find(o => o.value === form.config.ref1Mode))
const selectedRef2ModeOption   = computed(() => ref2ModeOptions.find(o => o.value === form.config.ref2Mode))

// ── QR Auto-fill ──
const qrFileInput  = ref<HTMLInputElement | null>(null)
const qrDecoding   = ref(false)
const qrError      = ref('')
const qrSuccess    = ref('')
const showQRPaste  = ref(false)
const qrPasteText  = ref('')

function parseEMVTLV(data: string): Record<string, string> {
  const tags: Record<string, string> = {}
  let i = 0
  while (i + 4 <= data.length) {
    const tag = data.substring(i, i + 2); i += 2
    const len = parseInt(data.substring(i, i + 2), 10); i += 2
    if (isNaN(len) || i + len > data.length) break
    tags[tag] = data.substring(i, i + len); i += len
  }
  return tags
}

function parseAndFillQR(qrText: string) {
  qrError.value = ''
  qrSuccess.value = ''
  const clean = qrText.trim()
  if (!clean) return

  const root = parseEMVTLV(clean)
  let found = false

  for (const [tag, val] of Object.entries(root)) {
    const tagNum = parseInt(tag, 10)
    if (tagNum >= 26 && tagNum <= 51) {
      const sub = parseEMVTLV(val)
      const aid = sub['00'] ?? ''

      if (aid === 'A000000677010112') {
        // Bill Payment (MaeMaNee, KShop)
        form.config.proxyType  = 'BILL_PAYMENT'
        form.config.billerId   = sub['01'] ?? ''
        form.config.ref1       = sub['02'] ?? ''
        form.config.ref1Mode   = 'fixed'
        form.config.ref2Mode   = 'merchantOrderId'
        found = true
        qrSuccess.value = `Bill Payment · billerId: ${form.config.billerId} · ref1: ${form.config.ref1}`
        break
      } else if (aid === 'A000000677010111') {
        // PromptPay
        const proxy = sub['01'] ?? ''
        if (proxy.startsWith('00') && proxy.length === 15) {
          form.config.proxyType = 'BILLER_ID'
        } else if (proxy.length === 10 || proxy.length === 9) {
          form.config.proxyType = 'MOBILE'
        } else if (proxy.length === 13) {
          form.config.proxyType = 'NATIONAL_ID'
        } else {
          form.config.proxyType = 'BILLER_ID'
        }
        form.config.billerId = proxy
        found = true
        qrSuccess.value = `PromptPay · ${form.config.proxyType} · ${proxy}`
        break
      }
    }
  }

  if (!found) {
    qrError.value = 'ไม่พบข้อมูล PromptPay/Bill Payment ใน QR — ตรวจสอบว่าเป็น Thai QR standard'
  }
}

async function onQRFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  qrError.value = ''
  qrSuccess.value = ''
  qrDecoding.value = true
  ;(event.target as HTMLInputElement).value = ''

  try {
    if (!('BarcodeDetector' in window)) {
      qrError.value = 'Browser นี้ไม่รองรับ BarcodeDetector — ลอง Chrome/Edge หรือวาง QR text แทน'
      return
    }
    const bitmap = await createImageBitmap(file)
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
    const barcodes: any[] = await detector.detect(bitmap)
    if (!barcodes.length) {
      qrError.value = 'ไม่พบ QR Code ในภาพ — ลองภาพที่ชัดกว่านี้ หรือวาง QR text แทน'
      return
    }
    parseAndFillQR(barcodes[0].rawValue)
  } catch (e: any) {
    qrError.value = e?.message ?? 'เกิดข้อผิดพลาดในการอ่าน QR'
  } finally {
    qrDecoding.value = false
  }
}

// ── CRUD helpers ──
function resetConfig() {
  form.config.proxyType  = 'BILL_PAYMENT'
  form.config.billerId   = ''
  form.config.ref1       = ''
  form.config.ref1Mode   = 'fixed'
  form.config.ref2Mode   = 'merchantOrderId'
  form.config.ref2Fixed  = ''
}

function resetQRState() {
  qrError.value = ''
  qrSuccess.value = ''
  showQRPaste.value = false
  qrPasteText.value = ''
}

function openCreate() {
  modal.mode = 'create'; modal.biller = null
  form.displayName = ''; form.code = ''
  form.providerCode = 'THAI_QR'; form.environment = 'TEST'
  form.billerId = ''; form.merchantIdAtProvider = ''; form.credentialsRef = ''
  form.priority = '100'; form.status = 'ACTIVE'
  resetConfig(); resetQRState()
  formError.value = ''; modal.open = true
}

function openEdit(b: BillerRow) {
  modal.mode = 'edit'; modal.biller = b
  form.displayName = b.displayName
  form.billerId = b.billerId ?? ''
  form.merchantIdAtProvider = b.merchantIdAtProvider ?? ''
  form.credentialsRef = b.credentialsRef ?? ''
  form.priority = String(b.priority)
  form.status = b.status
  resetConfig(); resetQRState()
  const pp = b.config?.promptpay as any
  if (pp) {
    form.config.proxyType  = pp.proxyType  ?? 'BILL_PAYMENT'
    form.config.billerId   = pp.billerId   ?? ''
    form.config.ref1       = pp.ref1       ?? ''
    form.config.ref1Mode   = pp.ref1Mode   ?? 'fixed'
    form.config.ref2Mode   = pp.ref2Mode   ?? 'merchantOrderId'
    form.config.ref2Fixed  = pp.ref2Fixed  ?? ''
  }
  formError.value = ''; modal.open = true
}

function closeModal() { modal.open = false }

function buildConfigPayload() {
  const pp = form.config
  if (!isDirectQR(currentProvider.value)) return null
  if (!pp.proxyType && !pp.billerId) return null
  const promptpay: Record<string, string> = {}
  if (pp.proxyType) promptpay.proxyType = pp.proxyType
  if (pp.billerId) promptpay.billerId = pp.billerId
  if (pp.ref1) promptpay.ref1 = pp.ref1
  if (pp.ref1Mode) promptpay.ref1Mode = pp.ref1Mode
  if (pp.ref2Mode) promptpay.ref2Mode = pp.ref2Mode
  if (pp.ref2Mode === 'fixed' && pp.ref2Fixed) promptpay.ref2Fixed = pp.ref2Fixed
  return { promptpay }
}

async function submitModal() {
  formError.value = ''; submitting.value = true
  try {
    const configPayload = buildConfigPayload()
    if (modal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/billers`, {
        method: 'POST',
        body: {
          code: form.code, displayName: form.displayName,
          providerCode: form.providerCode, environment: form.environment,
          billerId: form.billerId || null,
          merchantIdAtProvider: form.merchantIdAtProvider || null,
          credentialsRef: form.credentialsRef || null,
          priority: Number(form.priority),
          config: configPayload,
        },
      })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/billers/${modal.biller!.id}`, {
        method: 'PATCH',
        body: {
          displayName: form.displayName,
          billerId: form.billerId || null,
          merchantIdAtProvider: form.merchantIdAtProvider || null,
          credentialsRef: form.credentialsRef || null,
          priority: Number(form.priority),
          status: form.status,
          config: configPayload,
        },
      })
    }
    await refresh(); closeModal()
  } catch (e: any) {
    formError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { submitting.value = false }
}
</script>
