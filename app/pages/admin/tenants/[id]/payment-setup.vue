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
            <span class="text-gray-800 dark:text-neutral-200 font-medium">Payment Setup</span>
          </div>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Payment Setup</h1>
        <p class="text-sm text-gray-500 dark:text-neutral-400 mt-1">Biller Profiles และ Payment Routes ของ tenant นี้</p>
      </div>
    </div>

    <!-- Setup Flow Guide -->
    <div class="flex flex-wrap items-center gap-2 mb-6 px-4 py-3 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg text-sm">
      <span class="text-gray-500 dark:text-neutral-500 text-xs font-semibold uppercase tracking-wide mr-1">Setup Flow</span>
      <span class="flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">1</span>
        <span class="font-medium text-gray-800 dark:text-neutral-200">สร้าง Biller</span>
        <span class="text-gray-400 dark:text-neutral-600 text-xs">— บัญชีรับเงิน (MaeMaNee, KShop, SCB API ฯลฯ)</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-gray-400 dark:text-neutral-600 flex-shrink-0" />
      <span class="flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">2</span>
        <span class="font-medium text-gray-800 dark:text-neutral-200">สร้าง Route</span>
        <span class="text-gray-400 dark:text-neutral-600 text-xs">— ผูก Biller + Payment Method เข้าด้วยกัน</span>
      </span>
      <UIcon name="i-lucide-chevron-right" class="w-4 h-4 text-gray-400 dark:text-neutral-600 flex-shrink-0" />
      <span class="flex items-center gap-1.5">
        <span class="w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold flex-shrink-0">3</span>
        <span class="font-medium text-gray-800 dark:text-neutral-200">Assign Route ให้ Merchant</span>
        <span class="text-gray-400 dark:text-neutral-600 text-xs">— ทำในหน้า Merchant แต่ละตัว</span>
      </span>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SECTION 1: BILLERS -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-building-2" class="w-5 h-5 text-amber-500" />
          <h2 class="text-lg font-semibold text-gray-800 dark:text-neutral-200">Biller Profiles</h2>
          <span class="text-sm text-gray-500 dark:text-neutral-500">{{ billerItems.length }} biller{{ billerItems.length !== 1 ? 's' : '' }}</span>
        </div>
        <UButton label="+ New Biller" color="warning" variant="soft" size="sm" @click="openCreateBiller" />
      </div>

      <UCard :ui="{ body: 'p-0' }">
        <div v-if="billerPending" class="text-center py-10 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Biller</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Provider</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Mode</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Account / Proxy</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Status</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Env</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in billerItems" :key="b.id"
                class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-white dark:hover:bg-neutral-800/50 transition-colors">
                <td class="px-4 py-3">
                  <div class="text-sm font-medium text-gray-800 dark:text-neutral-200">{{ b.displayName }}</div>
                  <div class="text-xs text-gray-500 dark:text-neutral-500 font-sans mt-0.5">{{ b.code }}</div>
                </td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ b.providerCode }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ providerMode(b.providerCode) }}</td>
                <td class="px-4 py-3">
                  <template v-if="(b.config as any)?.promptpay">
                    <span class="text-sm text-gray-700 dark:text-neutral-300">{{ (b.config as any).promptpay.proxyType }}</span>
                    <span class="text-sm text-gray-400 dark:text-neutral-500"> · </span>
                    <span class="text-sm text-gray-600 dark:text-neutral-400 font-sans">{{ (b.config as any).promptpay.billerId ?? '—' }}</span>
                  </template>
                  <span v-else class="text-sm text-gray-400 dark:text-neutral-600">—</span>
                </td>
                <td class="px-4 py-3 text-center">
                  <UBadge :label="b.status" :color="b.status === 'ACTIVE' ? 'success' : 'neutral'" variant="soft" size="sm" />
                </td>
                <td class="px-4 py-3 text-center">
                  <UBadge :label="b.environment" :color="b.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
                </td>
                <td class="px-4 py-3 text-right">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" @click="openEditBiller(b)" />
                </td>
              </tr>
              <tr v-if="!billerItems.length">
                <td colspan="7" class="text-center py-10 text-sm text-gray-500 dark:text-neutral-400">ยังไม่มี Biller — กด "+ New Biller" เพื่อเพิ่ม</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- SECTION 2: ROUTES -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div>
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-route" class="w-5 h-5 text-amber-500" />
          <h2 class="text-lg font-semibold text-gray-800 dark:text-neutral-200">Payment Routes</h2>
          <span class="text-sm text-gray-500 dark:text-neutral-500">{{ routeItems.length }} route{{ routeItems.length !== 1 ? 's' : '' }}</span>
        </div>
        <UButton label="+ New Route" color="warning" variant="soft" size="sm" @click="openCreateRoute" />
      </div>

      <UCard :ui="{ body: 'p-0' }">
        <div v-if="routePending" class="text-center py-10 text-sm text-gray-500 dark:text-neutral-400">Loading…</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Code</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Method</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Provider</th>
                <th class="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Biller</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Default</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Priority</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Status</th>
                <th class="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Env</th>
                <th class="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in routeItems" :key="r.id"
                class="border-b border-gray-100 dark:border-neutral-800 last:border-0 hover:bg-white dark:hover:bg-neutral-800/50 transition-colors">
                <td class="px-4 py-3 font-sans text-sm font-medium text-gray-800 dark:text-neutral-200">{{ r.code }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.paymentMethodType }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.providerCode }}</td>
                <td class="px-4 py-3 text-sm text-gray-700 dark:text-neutral-300">{{ r.billerProfile?.displayName ?? '—' }}</td>
                <td class="px-4 py-3 text-center">
                  <UBadge v-if="r.isDefault" label="DEFAULT" color="warning" variant="soft" size="sm" />
                  <span v-else class="text-sm text-gray-400 dark:text-neutral-600">—</span>
                </td>
                <td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-neutral-300">{{ r.priority }}</td>
                <td class="px-4 py-3 text-center">
                  <UBadge :label="r.status" :color="r.status === 'ACTIVE' ? 'success' : 'neutral'" variant="soft" size="sm" />
                </td>
                <td class="px-4 py-3 text-center">
                  <UBadge :label="r.environment" :color="r.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm" />
                </td>
                <td class="px-4 py-3 text-right">
                  <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="sm" @click="openEditRoute(r)" />
                </td>
              </tr>
              <tr v-if="!routeItems.length">
                <td colspan="9" class="text-center py-10 text-sm text-gray-500 dark:text-neutral-400">ยังไม่มี Route — สร้าง Biller ก่อน แล้วค่อยสร้าง Route</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- BILLER MODAL -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-if="billerModal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" @click.self="billerModal.open = false">
      <UCard class="w-full max-w-6xl max-h-[96vh] overflow-y-auto" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-200">
              {{ billerModal.mode === 'create' ? 'New Biller Profile' : 'Edit Biller Profile' }}
            </h2>
            <UBadge v-if="billerModal.mode === 'edit'" :label="providerMode(billerModal.biller?.providerCode ?? '')" :color="providerModeColor(billerModal.biller?.providerCode ?? '')" variant="soft" size="sm" />
          </div>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="billerModal.open = false" />
        </div>
        <form class="px-6 py-5 flex flex-col gap-6" @submit.prevent="submitBiller">
          <!-- Row 1: Name + Code -->
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Display Name</label>
              <UInput v-model="billerForm.displayName" placeholder="e.g. MaeMaNee TEST" required />
            </div>
            <div class="flex flex-col gap-1.5">
              <template v-if="billerModal.mode === 'create'">
                <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Code <span class="text-gray-400 dark:text-neutral-500 font-normal">(lowercase · immutable)</span></label>
                <UInput v-model="billerForm.code" placeholder="e.g. maemane-test" pattern="[a-z0-9_-]+" required />
              </template>
              <template v-else>
                <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Code</label>
                <div class="font-sans text-sm text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">{{ billerModal.biller?.code }}</div>
              </template>
            </div>
          </div>
          <!-- Row 2: Provider + Env + Priority + Status -->
          <div class="grid grid-cols-6 gap-4">
            <div class="col-span-3 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Provider</label>
              <template v-if="billerModal.mode === 'create'">
                <USelect v-model="billerForm.providerCode" :items="billerProviderOptions" value-key="value" label-key="label" :selected-icon="''" size="lg" required />
                <p v-if="selectedBillerProvider?.description" class="text-sm text-gray-500 dark:text-neutral-400">{{ selectedBillerProvider.description }}</p>
              </template>
              <div v-else class="font-sans text-sm text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">{{ billerModal.biller?.providerCode }}</div>
            </div>
            <div class="col-span-1 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Env</label>
              <USelect v-if="billerModal.mode === 'create'" v-model="billerForm.environment" :items="envOptions" value-key="value" label-key="label" :selected-icon="''" required />
              <div v-else class="font-sans text-sm text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">{{ billerModal.biller?.environment }}</div>
            </div>
            <div class="col-span-1 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Priority</label>
              <UInput v-model="billerForm.priority" type="number" min="1" max="999" placeholder="100" />
            </div>
            <div v-if="billerModal.mode === 'edit'" class="col-span-1 flex flex-col gap-1.5">
              <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Status</label>
              <USelect v-model="billerForm.status" :items="statusOptions" value-key="value" label-key="label" :selected-icon="''" />
            </div>
          </div>
          <!-- Left + Right columns -->
          <div class="grid grid-cols-2 gap-6">
            <!-- API Gateway Config -->
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-plug-zap" class="w-4 h-4" :class="isApiGateway(billerCurrentProvider) ? 'text-blue-400' : 'text-gray-300 dark:text-neutral-600'" />
                <span class="text-sm font-semibold uppercase tracking-wide" :class="isApiGateway(billerCurrentProvider) ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400 dark:text-neutral-600'">API Gateway Config</span>
                <span v-if="!isApiGateway(billerCurrentProvider)" class="text-sm text-gray-400 dark:text-neutral-600">(ไม่ใช้)</span>
              </div>
              <div class="flex flex-col gap-3" :class="!isApiGateway(billerCurrentProvider) ? 'opacity-25 pointer-events-none select-none' : ''">
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Biller ID <span class="text-gray-400 dark:text-neutral-500 font-normal">(จาก provider)</span></label>
                  <UInput v-model="billerForm.billerId" placeholder="e.g. 123456789" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Merchant ID at Provider</label>
                  <UInput v-model="billerForm.merchantIdAtProvider" placeholder="e.g. MERCHANT001" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Credentials Ref <span class="text-gray-400 dark:text-neutral-500 font-normal">(vault key)</span></label>
                  <UInput v-model="billerForm.credentialsRef" placeholder="e.g. scb-live-creds-v1" />
                </div>
              </div>
            </div>
            <!-- Thai QR Config -->
            <div class="flex flex-col gap-4">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-qr-code" class="w-4 h-4" :class="isDirectQR(billerCurrentProvider) ? 'text-amber-500' : 'text-gray-300 dark:text-neutral-600'" />
                <span class="text-sm font-semibold uppercase tracking-wide" :class="isDirectQR(billerCurrentProvider) ? 'text-amber-500' : 'text-gray-400 dark:text-neutral-600'">Thai QR / Bill Payment Config</span>
                <span v-if="!isDirectQR(billerCurrentProvider)" class="text-sm text-gray-400 dark:text-neutral-600">(ไม่ใช้)</span>
              </div>
              <div class="flex flex-col gap-3" :class="!isDirectQR(billerCurrentProvider) ? 'opacity-25 pointer-events-none select-none' : ''">
                <!-- QR Auto-fill -->
                <div class="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-lg px-4 py-3 flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium text-gray-800 dark:text-neutral-200">ตั้งค่าจาก QR อัตโนมัติ</span>
                    <div class="flex items-center gap-2">
                      <UButton icon="i-lucide-image-up" label="Upload QR" color="warning" variant="soft" size="xs" :loading="qrDecoding" :disabled="!isDirectQR(billerCurrentProvider)" @click="qrFileInput?.click()" />
                      <UButton :icon="showQRPaste ? 'i-lucide-chevron-up' : 'i-lucide-clipboard-paste'" :label="showQRPaste ? 'ซ่อน' : 'วาง QR Text'" color="neutral" variant="ghost" size="xs" :disabled="!isDirectQR(billerCurrentProvider)" @click="showQRPaste = !showQRPaste" />
                    </div>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-neutral-500">Upload ภาพ QR หรือวาง QR string แล้วระบบจะดึงค่าให้อัตโนมัติ</p>
                  <div v-if="showQRPaste" class="flex flex-col gap-2 pt-1">
                    <textarea v-model="qrPasteText" rows="3" placeholder="วาง QR string ตรงนี้…" class="w-full font-sans text-xs bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-amber-500" />
                    <UButton label="Decode & Fill" icon="i-lucide-scan" color="warning" variant="soft" size="xs" :disabled="!qrPasteText.trim()" @click="parseAndFillQR(qrPasteText)" />
                  </div>
                  <p v-if="qrError" class="text-xs text-red-500 dark:text-red-400">{{ qrError }}</p>
                  <p v-if="qrSuccess" class="text-xs text-green-600 dark:text-green-400">✅ {{ qrSuccess }}</p>
                  <input ref="qrFileInput" type="file" accept="image/*" class="hidden" @change="onQRFileSelected" />
                </div>
                <!-- Proxy Type -->
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Proxy Type</label>
                  <USelect v-model="billerForm.config.proxyType" :items="proxyTypeOptions" value-key="value" label-key="label" :selected-icon="''" size="lg" placeholder="Select proxy type…" />
                  <p v-if="selectedProxyTypeOption?.description" class="text-sm text-gray-500 dark:text-neutral-400">{{ selectedProxyTypeOption.description }}</p>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">
                    {{ billerForm.config.proxyType === 'BILL_PAYMENT' ? 'Bill Payment ID' : 'PromptPay Biller ID' }}
                    <span class="text-gray-400 dark:text-neutral-500 font-normal">(15 หลัก)</span>
                  </label>
                  <UInput v-model="billerForm.config.billerId" placeholder="e.g. 010753600010286" maxlength="15" />
                </div>
                <template v-if="billerForm.config.proxyType === 'BILL_PAYMENT'">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                      <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref1 Value</label>
                      <UInput v-model="billerForm.config.ref1" placeholder="e.g. 014000003906609" />
                      <p class="text-xs text-gray-500 dark:text-neutral-500">terminal / merchant code</p>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref1 Mode</label>
                      <USelect v-model="billerForm.config.ref1Mode" :items="ref1ModeOptions" value-key="value" label-key="label" :selected-icon="''" size="lg" placeholder="Select…" />
                      <p v-if="selectedRef1ModeOption?.description" class="text-xs text-gray-500 dark:text-neutral-400">{{ selectedRef1ModeOption.description }}</p>
                    </div>
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref2 Mode</label>
                    <USelect v-model="billerForm.config.ref2Mode" :items="ref2ModeOptions" value-key="value" label-key="label" :selected-icon="''" size="lg" placeholder="Select…" />
                    <p v-if="selectedRef2ModeOption?.description" class="text-sm text-gray-500 dark:text-neutral-400">{{ selectedRef2ModeOption.description }}</p>
                  </div>
                  <div v-if="billerForm.config.ref2Mode === 'fixed'" class="flex flex-col gap-1.5">
                    <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Ref2 Fixed Value</label>
                    <UInput v-model="billerForm.config.ref2Fixed" placeholder="fixed ref2 value" />
                  </div>
                </template>
                <div v-if="billerForm.config.proxyType && billerForm.config.billerId" class="bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2.5 text-xs font-sans text-gray-600 dark:text-neutral-400 space-y-0.5">
                  <div><span class="text-gray-400 dark:text-neutral-500">proxyType:</span> <span class="text-amber-600 dark:text-amber-400">{{ billerForm.config.proxyType }}</span></div>
                  <div><span class="text-gray-400 dark:text-neutral-500">billerId:</span> {{ billerForm.config.billerId }}</div>
                  <div v-if="billerForm.config.ref1"><span class="text-gray-400 dark:text-neutral-500">ref1:</span> {{ billerForm.config.ref1 }} <span class="text-gray-400 dark:text-neutral-500">({{ billerForm.config.ref1Mode || 'fixed' }})</span></div>
                  <div v-if="billerForm.config.ref2Mode"><span class="text-gray-400 dark:text-neutral-500">ref2:</span> <span class="text-green-600 dark:text-green-400">{{ billerForm.config.ref2Mode }}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div v-if="billerFormError" class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{{ billerFormError }}</div>
          <div class="flex justify-end gap-2 pt-1 border-t border-gray-200 dark:border-neutral-800">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="billerModal.open = false" />
            <UButton type="submit" :label="billerSubmitting ? 'Saving…' : billerModal.mode === 'create' ? 'Create' : 'Save'" color="warning" variant="soft" :disabled="billerSubmitting" />
          </div>
        </form>
      </UCard>
    </div>

    <!-- ══════════════════════════════════════════════════════════ -->
    <!-- ROUTE MODAL -->
    <!-- ══════════════════════════════════════════════════════════ -->
    <div v-if="routeModal.open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" @click.self="routeModal.open = false">
      <UCard class="w-full max-w-md" :ui="{ body: 'p-0' }">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-neutral-800">
          <h2 class="text-base font-semibold text-gray-800 dark:text-neutral-200">
            {{ routeModal.mode === 'create' ? 'New Payment Route' : 'Edit Payment Route' }}
          </h2>
          <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="sm" @click="routeModal.open = false" />
        </div>
        <form class="px-5 py-5 flex flex-col gap-4" @submit.prevent="submitRoute">
          <div v-if="routeModal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Code <span class="text-gray-400 dark:text-neutral-500 font-normal">(immutable)</span></label>
            <UInput v-model="routeForm.code" placeholder="e.g. maemane-promptpay-test" pattern="[a-z0-9_-]+" required />
          </div>
          <div v-else class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Code</label>
            <div class="font-sans text-sm text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-md px-3 py-2">{{ routeModal.route?.code }}</div>
          </div>
          <div v-if="routeModal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Payment Method</label>
            <USelect v-model="routeForm.paymentMethodType" :items="methodOptions" value-key="value" label-key="label" :selected-icon="''" required />
          </div>
          <div v-if="routeModal.mode === 'create'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Environment</label>
            <USelect v-model="routeForm.environment" :items="envOptions" value-key="value" label-key="label" :selected-icon="''" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Biller</label>
            <USelect v-model="routeForm.billerProfileId" :items="billerOptions" value-key="value" label-key="label" :selected-icon="''" required />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Priority <span class="text-gray-400 dark:text-neutral-500 font-normal">(ต่ำ = สูง)</span></label>
            <UInput v-model="routeForm.priority" type="number" min="1" max="999" placeholder="100" />
          </div>
          <div class="flex items-center gap-2">
            <input id="isDefault" v-model="routeForm.isDefault" type="checkbox" class="w-4 h-4 rounded border-gray-300 text-amber-500" />
            <label for="isDefault" class="text-sm text-gray-700 dark:text-neutral-300">Set as default route for this method</label>
          </div>
          <div v-if="routeModal.mode === 'edit'" class="flex flex-col gap-1.5">
            <label class="text-sm font-medium text-gray-800 dark:text-neutral-200">Status</label>
            <USelect v-model="routeForm.status" :items="statusOptions" value-key="value" label-key="label" :selected-icon="''" />
          </div>
          <div v-if="routeFormError" class="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md px-3 py-2">{{ routeFormError }}</div>
          <div class="flex justify-end gap-2 pt-1">
            <UButton type="button" label="Cancel" color="neutral" variant="outline" @click="routeModal.open = false" />
            <UButton type="submit" :label="routeSubmitting ? 'Saving…' : routeModal.mode === 'create' ? 'Create' : 'Save'" color="warning" variant="soft" :disabled="routeSubmitting" />
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

// ── Tenant name ──
const { data: tenantData } = await useFetch<{ name: string }>(`/api/admin/tenants/${tenantId}`)
const tenantName = computed(() => tenantData.value?.name ?? tenantId)

// ── Types ──
type BillerRow = {
  id: string; code: string; displayName: string; providerCode: string
  environment: string; billerId: string | null; merchantIdAtProvider: string | null
  credentialsRef: string | null; status: string; priority: number; createdAt: string
  config: Record<string, any> | null
}
type RouteRow = {
  id: string; code: string; paymentMethodType: string; providerCode: string
  environment: string; currency: string; isDefault: boolean; priority: number
  status: string; createdAt: string
  billerProfile: { id: string; code: string; displayName: string } | null
}

// ── Data fetches ──
const { data: billerData, pending: billerPending, refresh: billerRefresh } = await useFetch<{ items: BillerRow[] }>(`/api/admin/tenants/${tenantId}/billers`)
const billerItems = computed(() => billerData.value?.items ?? [])

const { data: routeData, pending: routePending, refresh: routeRefresh } = await useFetch<{ items: RouteRow[] }>(`/api/admin/tenants/${tenantId}/routes`)
const routeItems = computed(() => routeData.value?.items ?? [])

const billerOptions = computed(() =>
  billerItems.value.map(b => ({ label: b.displayName, value: b.id }))
)

// ── Provider helpers ──
const API_GATEWAY_PROVIDERS = ['SCB', 'KBANK', 'BAY']
const DIRECT_QR_PROVIDERS   = ['THAI_QR']

function isApiGateway(p: string) { return API_GATEWAY_PROVIDERS.includes(p) }
function isDirectQR(p: string)   { return DIRECT_QR_PROVIDERS.includes(p) }
function providerMode(p: string) {
  if (isApiGateway(p)) return 'API Gateway'
  if (isDirectQR(p))   return 'Direct QR'
  if (p === 'E_WALLET') return 'E-Wallet'
  if (p === 'SANDBOX')  return 'Sandbox'
  return 'Other'
}
function providerModeColor(p: string): 'info' | 'warning' | 'success' | 'neutral' {
  if (isApiGateway(p)) return 'info'
  if (isDirectQR(p))   return 'warning'
  if (p === 'E_WALLET') return 'success'
  return 'neutral'
}

// ── Shared options ──
const envOptions    = [{ label: 'TEST', value: 'TEST' }, { label: 'LIVE', value: 'LIVE' }]
const statusOptions = [{ label: 'ACTIVE', value: 'ACTIVE' }, { label: 'INACTIVE', value: 'INACTIVE' }]
const methodOptions = [
  { label: 'PROMPTPAY_QR',      value: 'PROMPTPAY_QR' },
  { label: 'BILL_PAYMENT',      value: 'BILL_PAYMENT' },
  { label: 'BANK_TRANSFER',     value: 'BANK_TRANSFER' },
  { label: 'BANK_TRANSFER_SLIP',value: 'BANK_TRANSFER_SLIP' },
  { label: 'CASH',              value: 'CASH' },
  { label: 'E_WALLET',          value: 'E_WALLET' },
]
const { data: providersData } = await useFetch('/api/admin/providers')
const billerProviderOptions = computed(() =>
  (providersData.value as any)?.providers?.map((p: any) => ({
    label: p.displayName,
    value: p.code,
    description: p.type.replace(/_/g, ' '),
  })) ?? []
)
const proxyTypeOptions = [
  { label: 'BILL_PAYMENT',  value: 'BILL_PAYMENT',  description: 'AID 0112 · มี Ref1/Ref2 · auto-confirm ได้ ✅ (MaeMaNee, KShop)' },
  { label: 'BILLER_ID',     value: 'BILLER_ID',     description: 'AID 0111 · PromptPay static · reconcile ด้วย amount+time' },
  { label: 'MOBILE',        value: 'MOBILE',        description: 'AID 0111 · เบอร์มือถือ' },
  { label: 'TAX_ID',        value: 'TAX_ID',        description: 'AID 0111 · เลขผู้เสียภาษี' },
  { label: 'NATIONAL_ID',   value: 'NATIONAL_ID',   description: 'AID 0111 · เลขบัตรประชาชน' },
]
const ref1ModeOptions = [
  { label: 'fixed',        value: 'fixed',        description: 'ใส่ค่าคงที่ เช่น terminal code' },
  { label: 'merchantCode', value: 'merchantCode', description: 'ดึงจาก merchant.code อัตโนมัติ' },
]
const ref2ModeOptions = [
  { label: 'merchantOrderId', value: 'merchantOrderId', description: 'Dynamic QR — ใช้ Order ID ✅' },
  { label: 'fixed',           value: 'fixed',           description: 'Static QR — merchant encode เอง (IoT/vending)' },
  { label: 'none',            value: 'none',            description: 'ไม่มี Ref2' },
]

// ═══ BILLER MODAL ═══
const billerModal = reactive<{ open: boolean; mode: 'create' | 'edit'; biller: BillerRow | null }>({
  open: false, mode: 'create', biller: null,
})
const billerForm = reactive({
  displayName: '', code: '', providerCode: 'THAI_QR', environment: 'TEST',
  billerId: '', merchantIdAtProvider: '', credentialsRef: '', priority: '100', status: 'ACTIVE',
  config: { proxyType: 'BILL_PAYMENT', billerId: '', ref1: '', ref1Mode: 'fixed', ref2Mode: 'merchantOrderId', ref2Fixed: '' },
})
const billerSubmitting = ref(false)
const billerFormError  = ref('')

const billerCurrentProvider = computed(() =>
  billerModal.mode === 'edit' ? (billerModal.biller?.providerCode ?? '') : billerForm.providerCode
)
const selectedBillerProvider  = computed(() => billerProviderOptions.value.find((o: any) => o.value === billerForm.providerCode))
const selectedProxyTypeOption = computed(() => proxyTypeOptions.find(o => o.value === billerForm.config.proxyType))
const selectedRef1ModeOption  = computed(() => ref1ModeOptions.find(o => o.value === billerForm.config.ref1Mode))
const selectedRef2ModeOption  = computed(() => ref2ModeOptions.find(o => o.value === billerForm.config.ref2Mode))

function resetBillerConfig() {
  billerForm.config = { proxyType: 'BILL_PAYMENT', billerId: '', ref1: '', ref1Mode: 'fixed', ref2Mode: 'merchantOrderId', ref2Fixed: '' }
}

function openCreateBiller() {
  billerModal.mode = 'create'; billerModal.biller = null
  Object.assign(billerForm, { displayName: '', code: '', providerCode: 'THAI_QR', environment: 'TEST', billerId: '', merchantIdAtProvider: '', credentialsRef: '', priority: '100', status: 'ACTIVE' })
  resetBillerConfig(); billerFormError.value = ''; billerModal.open = true
}
function openEditBiller(b: BillerRow) {
  billerModal.mode = 'edit'; billerModal.biller = b
  Object.assign(billerForm, { displayName: b.displayName, billerId: b.billerId ?? '', merchantIdAtProvider: b.merchantIdAtProvider ?? '', credentialsRef: b.credentialsRef ?? '', priority: String(b.priority), status: b.status })
  resetBillerConfig()
  const pp = b.config?.promptpay as any
  if (pp) { billerForm.config.proxyType = pp.proxyType ?? 'BILL_PAYMENT'; billerForm.config.billerId = pp.billerId ?? ''; billerForm.config.ref1 = pp.ref1 ?? ''; billerForm.config.ref1Mode = pp.ref1Mode ?? 'fixed'; billerForm.config.ref2Mode = pp.ref2Mode ?? 'merchantOrderId'; billerForm.config.ref2Fixed = pp.ref2Fixed ?? '' }
  billerFormError.value = ''; billerModal.open = true
}

function buildBillerConfig() {
  if (!isDirectQR(billerCurrentProvider.value)) return null
  const c = billerForm.config
  if (!c.proxyType && !c.billerId) return null
  const pp: Record<string, string> = {}
  if (c.proxyType) pp.proxyType = c.proxyType
  if (c.billerId)  pp.billerId  = c.billerId
  if (c.ref1)      pp.ref1      = c.ref1
  if (c.ref1Mode)  pp.ref1Mode  = c.ref1Mode
  if (c.ref2Mode)  pp.ref2Mode  = c.ref2Mode
  if (c.ref2Mode === 'fixed' && c.ref2Fixed) pp.ref2Fixed = c.ref2Fixed
  return { promptpay: pp }
}

async function submitBiller() {
  billerFormError.value = ''; billerSubmitting.value = true
  try {
    if (billerModal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/billers`, { method: 'POST', body: { code: billerForm.code, displayName: billerForm.displayName, providerCode: billerForm.providerCode, environment: billerForm.environment, billerId: billerForm.billerId || null, merchantIdAtProvider: billerForm.merchantIdAtProvider || null, credentialsRef: billerForm.credentialsRef || null, priority: Number(billerForm.priority), config: buildBillerConfig() } })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/billers/${billerModal.biller!.id}`, { method: 'PATCH', body: { displayName: billerForm.displayName, billerId: billerForm.billerId || null, merchantIdAtProvider: billerForm.merchantIdAtProvider || null, credentialsRef: billerForm.credentialsRef || null, priority: Number(billerForm.priority), status: billerForm.status, config: buildBillerConfig() } })
    }
    await billerRefresh(); billerModal.open = false
  } catch (e: any) {
    billerFormError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { billerSubmitting.value = false }
}

// ── QR decode ──
const qrFileInput = ref<HTMLInputElement | null>(null)
const qrDecoding  = ref(false)
const qrError     = ref('')
const qrSuccess   = ref('')
const showQRPaste = ref(false)
const qrPasteText = ref('')

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
  qrError.value = ''; qrSuccess.value = ''
  const root = parseEMVTLV(qrText.trim())
  let found = false
  for (const [tag, val] of Object.entries(root)) {
    const n = parseInt(tag, 10)
    if (n >= 26 && n <= 51) {
      const sub = parseEMVTLV(val)
      const aid = sub['00'] ?? ''
      if (aid === 'A000000677010112') {
        billerForm.config.proxyType = 'BILL_PAYMENT'; billerForm.config.billerId = sub['01'] ?? ''; billerForm.config.ref1 = sub['02'] ?? ''; billerForm.config.ref1Mode = 'fixed'; billerForm.config.ref2Mode = 'merchantOrderId'
        found = true; qrSuccess.value = `Bill Payment · billerId: ${billerForm.config.billerId} · ref1: ${billerForm.config.ref1}`; break
      } else if (aid === 'A000000677010111') {
        const proxy = sub['01'] ?? ''
        billerForm.config.proxyType = proxy.length === 15 ? 'BILLER_ID' : proxy.length >= 9 && proxy.length <= 10 ? 'MOBILE' : proxy.length === 13 ? 'NATIONAL_ID' : 'BILLER_ID'
        billerForm.config.billerId = proxy; found = true; qrSuccess.value = `PromptPay · ${billerForm.config.proxyType} · ${proxy}`; break
      }
    }
  }
  if (!found) qrError.value = 'ไม่พบข้อมูล PromptPay/Bill Payment ใน QR'
}
async function onQRFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  qrError.value = ''; qrSuccess.value = ''; qrDecoding.value = true
  ;(event.target as HTMLInputElement).value = ''
  try {
    if (!('BarcodeDetector' in window)) { qrError.value = 'Browser นี้ไม่รองรับ BarcodeDetector — ลอง Chrome/Edge หรือวาง QR text แทน'; return }
    const bitmap = await createImageBitmap(file)
    const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
    const barcodes: any[] = await detector.detect(bitmap)
    if (!barcodes.length) { qrError.value = 'ไม่พบ QR Code ในภาพ'; return }
    parseAndFillQR(barcodes[0].rawValue)
  } catch (e: any) { qrError.value = e?.message ?? 'เกิดข้อผิดพลาด' } finally { qrDecoding.value = false }
}

// ═══ ROUTE MODAL ═══
const routeModal = reactive<{ open: boolean; mode: 'create' | 'edit'; route: RouteRow | null }>({
  open: false, mode: 'create', route: null,
})
const routeForm = reactive({
  code: '', paymentMethodType: 'PROMPTPAY_QR', environment: 'TEST',
  billerProfileId: '', priority: '100', isDefault: false, status: 'ACTIVE',
})
const routeSubmitting = ref(false)
const routeFormError  = ref('')

function openCreateRoute() {
  routeModal.mode = 'create'; routeModal.route = null
  Object.assign(routeForm, { code: '', paymentMethodType: 'PROMPTPAY_QR', environment: 'TEST', billerProfileId: billerOptions.value[0]?.value ?? '', priority: '100', isDefault: false, status: 'ACTIVE' })
  routeFormError.value = ''; routeModal.open = true
}
function openEditRoute(r: RouteRow) {
  routeModal.mode = 'edit'; routeModal.route = r
  Object.assign(routeForm, { billerProfileId: r.billerProfile?.id ?? '', priority: String(r.priority), isDefault: r.isDefault, status: r.status })
  routeFormError.value = ''; routeModal.open = true
}

async function submitRoute() {
  routeFormError.value = ''; routeSubmitting.value = true
  try {
    if (routeModal.mode === 'create') {
      await $fetch(`/api/admin/tenants/${tenantId}/routes`, { method: 'POST', body: { code: routeForm.code, paymentMethodType: routeForm.paymentMethodType, providerCode: billerItems.value.find(b => b.id === routeForm.billerProfileId)?.providerCode ?? 'THAI_QR', environment: routeForm.environment, billerProfileId: routeForm.billerProfileId, priority: Number(routeForm.priority), isDefault: routeForm.isDefault } })
    } else {
      await $fetch(`/api/admin/tenants/${tenantId}/routes/${routeModal.route!.id}`, { method: 'PATCH', body: { billerProfileId: routeForm.billerProfileId, priority: Number(routeForm.priority), isDefault: routeForm.isDefault, status: routeForm.status } })
    }
    await routeRefresh(); routeModal.open = false
  } catch (e: any) {
    routeFormError.value = e?.data?.message ?? e?.message ?? 'Something went wrong'
  } finally { routeSubmitting.value = false }
}
</script>
