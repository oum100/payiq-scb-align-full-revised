<template>
  <div>
    <!-- Page header -->
    <div class="mb-6">
      <UButton icon="i-heroicons-arrow-left" color="neutral" variant="ghost" size="sm" class="mb-3 -ml-1"
        @click="$router.back()">{{ $t('admin.paymentDetail.back') }}</UButton>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold tracking-tight font-mono text-gray-900 dark:text-white">{{ payment?.publicId }}
        </h1>
        <!-- Copy publicId button -->
        <UButton v-if="payment" :icon="copiedId === '__publicId__' ? 'i-lucide-check' : 'i-lucide-copy'"
          :color="copiedId === '__publicId__' ? 'success' : 'neutral'" variant="ghost" size="xs"
          :title="$t('admin.paymentDetail.copy')" @click="copy(payment.publicId, '__publicId__')" />
        <UBadge v-if="payment" :color="statusBadgeColor(payment.status)" variant="subtle"
          class="font-semibold tracking-wide">
          {{ payment.status }}
        </UBadge>
        <UBadge v-if="payment" :color="payment.environment === 'LIVE' ? 'success' : 'warning'" variant="soft" size="sm"
          class="font-bold tracking-wide">{{ payment.environment }}</UBadge>
      </div>
    </div>

    <div v-if="pending" class="py-10 text-center text-sm text-gray-500 dark:text-neutral-400">{{
      $t('admin.paymentDetail.loading') }}</div>
    <div v-else-if="!payment" class="py-10 text-center text-sm text-gray-500 dark:text-neutral-400">{{
      $t('admin.paymentDetail.notFound') }}</div>

    <template v-else>
      <!-- Detail cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">

        <!-- Payment Info -->
        <UCard>
          <template #header>
            <p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{
              $t('admin.paymentDetail.paymentInfo') }}</p>
          </template>
          <dl class="flex flex-col gap-2.5">
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ $t('admin.paymentDetail.amount')
                }}</dt>
              <dd class="text-base font-bold text-gray-900 dark:text-white">฿{{ fmtAmount(payment.amount) }}</dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{
                $t('admin.paymentDetail.currency') }}</dt>
              <dd class="text-sm text-gray-700 dark:text-neutral-200">{{ payment.currency }}</dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ $t('admin.paymentDetail.method')
                }}</dt>
              <dd class="text-sm text-gray-700 dark:text-neutral-200">{{ payment.paymentMethodType ?? '—' }}</dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{
                $t('admin.paymentDetail.provider') }}</dt>
              <dd class="text-sm text-gray-700 dark:text-neutral-200">{{ payment.providerCode ?? '—' }}</dd>
            </div>
            <div v-if="payment.description" class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{
                $t('admin.paymentDetail.description') }}
              </dt>
              <dd class="text-sm text-gray-600 dark:text-neutral-300 text-right break-words max-w-[60%]">{{
                payment.description }}
              </dd>
            </div>
          </dl>
        </UCard>

        <!-- References — with copy buttons -->
        <UCard>
          <template #header>
            <p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{
              $t('admin.paymentDetail.references') }}</p>
          </template>
          <dl class="flex flex-col gap-1.5">
            <div v-for="ref in refItems" :key="ref.key" class="flex justify-between items-center gap-2 group">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ ref.label }}</dt>
              <div class="flex items-center gap-1 min-w-0">
                <dd class="font-sans text-sm text-gray-600 dark:text-neutral-300 text-right break-all truncate">{{
                  ref.value }}
                </dd>
                <UButton v-if="ref.value !== '—'" :icon="copiedId === ref.key ? 'i-lucide-check' : 'i-lucide-copy'"
                  :color="copiedId === ref.key ? 'success' : 'neutral'" variant="ghost" size="xs"
                  class="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  @click="copy(ref.value, ref.key)" />
              </div>
            </div>
          </dl>
        </UCard>

        <!-- Timestamps -->
        <UCard>
          <template #header>
            <p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{
              $t('admin.paymentDetail.timestamps') }}</p>
          </template>
          <dl class="flex flex-col gap-2.5">
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ $t('admin.paymentDetail.created')
                }}</dt>
              <dd class="text-sm text-gray-700 dark:text-neutral-200 text-right">{{ fmtDate(payment.createdAt) }}</dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ $t('admin.paymentDetail.expires')
                }}</dt>
              <dd class="text-sm text-gray-700 dark:text-neutral-200 text-right">{{ payment.expiresAt ?
                fmtDate(payment.expiresAt) : '—' }}</dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{
                $t('admin.paymentDetail.succeeded') }}
              </dt>
              <dd class="text-sm text-green-600 dark:text-green-400 text-right">{{ payment.succeededAt ?
                fmtDate(payment.succeededAt) : '—' }}</dd>
            </div>
            <div class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ $t('admin.paymentDetail.failed')
                }}</dt>
              <dd class="text-sm text-red-500 dark:text-red-400 text-right">{{ payment.failedAt ?
                fmtDate(payment.failedAt) :
                '—' }}</dd>
            </div>
          </dl>
        </UCard>

        <!-- Customer + Merchant -->
        <UCard>
          <template #header>
            <p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{
              $t('admin.paymentDetail.customer') }}</p>
          </template>
          <dl class="flex flex-col gap-2.5">
            <div v-for="field in [
              { label: $t('admin.paymentDetail.name'), value: payment.customerName ?? '—' },
              { label: $t('admin.paymentDetail.email'), value: payment.customerEmail ?? '—' },
              { label: $t('admin.paymentDetail.phone'), value: payment.customerPhone ?? '—' },
              { label: $t('admin.paymentDetail.merchant'), value: payment.merchantAccount?.name ?? '—' },
              { label: $t('admin.paymentDetail.tenant'), value: payment.tenant?.name ?? payment.tenant?.code ?? '—' },
            ]" :key="field.label" class="flex justify-between items-start gap-3">
              <dt class="text-sm text-gray-500 dark:text-neutral-400 flex-shrink-0">{{ field.label }}</dt>
              <dd class="text-sm text-gray-700 dark:text-neutral-200 text-right break-all">{{ field.value }}</dd>
            </div>
          </dl>
        </UCard>
      </div>

      <!-- Provider Callbacks -->
      <UCard v-if="payment.providerCallbacks?.length" class="mb-4" :ui="{ body: 'p-0' }">
        <template #header>
          <p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{
            $t('admin.paymentDetail.providerCallbacks') }}</p>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.providerRef') }}</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.providerTxn') }}</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.signatureValid') }}</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.processStatus') }}</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.receivedAt') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cb in payment.providerCallbacks" :key="cb.id"
                class="border-b border-gray-100 dark:border-neutral-800/60 last:border-0">
                <td class="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-neutral-300">{{ cb.providerReference ??
                  '—'
                  }}</td>
                <td class="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-neutral-300">{{ cb.providerTxnId ?? '—'
                  }}
                </td>
                <td class="px-4 py-2.5">
                  <UBadge :color="cb.signatureValid ? 'success' : 'error'" variant="subtle" size="xs">
                    {{ cb.signatureValid ? '✓ Valid' : '✗ Invalid' }}
                  </UBadge>
                </td>
                <td class="px-4 py-2.5">
                  <UBadge
                    :color="cb.processStatus === 'PROCESSED' ? 'success' : cb.processStatus === 'FAILED' ? 'error' : 'warning'"
                    variant="subtle" size="xs" class="font-semibold">{{ cb.processStatus }}</UBadge>
                </td>
                <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-neutral-400">{{ cb.receivedAt ?
                  fmtDate(cb.receivedAt)
                  : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <!-- Timeline + Detail Panel (unified) -->
      <UCard class="mb-4" :ui="{ body: 'p-0' }">
        <template #header>
          <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{ $t('admin.paymentDetail.eventTimeline') }}</p>
        </template>
        <div class="flex flex-col lg:flex-row" style="min-height: 360px;">

          <!-- Left: Timeline event list -->
          <div class="w-full lg:w-72 xl:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-neutral-800 overflow-y-auto">
            <div
              v-for="(ev, idx) in payment.events"
              :key="ev.id"
              class="flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-neutral-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-800/40 transition-colors"
              :class="selectedEventId === ev.id ? 'bg-primary-50 dark:bg-primary-950/30 border-l-2 border-l-primary-500' : 'border-l-2 border-l-transparent'"
              @click="selectEvent(ev.id)"
            >
              <!-- Dot + connector line -->
              <div class="flex flex-col items-center flex-shrink-0 mt-0.5">
                <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" :class="dotColorClass(ev)" />
                <div v-if="idx < payment.events.length - 1" class="w-px bg-gray-200 dark:bg-neutral-700 mt-1" style="height: 20px;" />
              </div>
              <!-- Event info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-1 mb-0.5">
                  <span class="text-sm font-medium text-gray-800 dark:text-neutral-200 truncate">{{ ev.type }}</span>
                  <UIcon v-if="selectedEventId === ev.id" name="i-lucide-chevron-right" class="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
                </div>
                <div class="flex items-center gap-2 flex-wrap">
                  <UBadge v-if="ev.toStatus" :color="statusBadgeColor(ev.toStatus)" variant="subtle" size="xs" class="font-semibold">{{ ev.toStatus }}</UBadge>
                  <span class="text-xs text-gray-400 dark:text-neutral-500">{{ fmtDate(ev.createdAt) }}</span>
                </div>
              </div>
            </div>
            <p v-if="!payment.events?.length" class="px-4 py-6 text-sm text-gray-400 dark:text-neutral-500 text-center">{{ $t('admin.paymentDetail.noEvents') }}</p>
          </div>

          <!-- Right: Detail panel -->
          <div class="flex-1 min-w-0 overflow-y-auto">
            <!-- No selection placeholder -->
            <div v-if="!selectedEvent" class="flex flex-col items-center justify-center h-full gap-2 py-16 text-gray-400 dark:text-neutral-500">
              <UIcon name="i-lucide-mouse-pointer-click" class="w-8 h-8" />
              <p class="text-sm">{{ $t('admin.paymentDetail.selectEvent') }}</p>
            </div>

            <div v-else class="p-4 flex flex-col gap-4">
              <!-- Event summary -->
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <UIcon :name="eventIcon(selectedEvent.type)" class="w-4 h-4 flex-shrink-0" :class="dotColorClass(selectedEvent).replace('bg-', 'text-')" />
                  <span class="text-sm font-semibold text-gray-800 dark:text-neutral-100">{{ selectedEvent.type }}</span>
                </div>
                <p v-if="selectedEvent.summary" class="text-sm text-gray-500 dark:text-neutral-400 ml-6">{{ selectedEvent.summary }}</p>
                <div v-if="selectedEvent.fromStatus || selectedEvent.toStatus" class="flex items-center gap-2 mt-1.5 ml-6">
                  <UBadge v-if="selectedEvent.fromStatus" :color="statusBadgeColor(selectedEvent.fromStatus)" variant="soft" size="xs">{{ selectedEvent.fromStatus }}</UBadge>
                  <UIcon v-if="selectedEvent.fromStatus && selectedEvent.toStatus" name="i-lucide-arrow-right" class="w-3 h-3 text-gray-400" />
                  <UBadge v-if="selectedEvent.toStatus" :color="statusBadgeColor(selectedEvent.toStatus)" variant="subtle" size="xs" class="font-semibold">{{ selectedEvent.toStatus }}</UBadge>
                </div>
              </div>

              <!-- QR Code (shown for PROVIDER_ACCEPTED / AWAITING_CUSTOMER events) -->
              <div v-if="selectedEventShowsQR && payment.qrPayload" class="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <div class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-700">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{ $t('admin.paymentDetail.qrCode') }}</span>
                  <div class="flex items-center gap-1">
                    <UButton :icon="copiedId === '__qrPayload__' ? 'i-lucide-check' : 'i-lucide-copy'" :color="copiedId === '__qrPayload__' ? 'success' : 'neutral'" variant="ghost" size="xs" :title="$t('admin.paymentDetail.copyQrText')" @click="copy(payment.qrPayload, '__qrPayload__')" />
                    <UButton :icon="downloadingQR ? 'i-lucide-loader-circle' : 'i-lucide-download'" color="neutral" variant="ghost" size="xs" :title="$t('admin.paymentDetail.downloadQr')" :disabled="downloadingQR" @click="downloadQR" />
                  </div>
                </div>
                <div class="p-4 flex flex-col sm:flex-row items-start gap-4">
                  <div class="bg-white rounded-lg p-3 border border-gray-200 dark:border-neutral-600 flex-shrink-0">
                    <img :src="qrImageUrl" alt="PromptPay QR" width="160" height="160" class="rounded" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-500 dark:text-neutral-400 mb-1.5">{{ $t('admin.paymentDetail.qrPayload') }}</p>
                    <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all">{{ payment.qrPayload }}</pre>
                  </div>
                </div>
              </div>

              <!-- Provider Attempt detail (req/res) -->
              <div v-if="selectedAttempt" class="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <!-- Header -->
                <div class="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-700">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{ attemptTypeLabel }}</span>
                  <UBadge :color="selectedAttempt.status === 'SUCCEEDED' ? 'success' : 'error'" variant="subtle" size="xs" class="font-semibold">{{ selectedAttempt.status }}</UBadge>
                  <span v-if="!isLocalAttempt" class="text-xs text-gray-500 dark:text-neutral-400">HTTP {{ selectedAttempt.httpStatusCode ?? '—' }}</span>
                  <span v-else class="text-xs text-amber-600 dark:text-amber-400 font-medium">⚙ Local — no external API call</span>
                  <span class="text-xs text-gray-400 dark:text-neutral-500 ml-auto">{{ selectedAttempt.sentAt ? fmtDate(selectedAttempt.sentAt) : '—' }}</span>
                </div>

                <!-- LOCAL generation: simplified config + output view -->
                <div v-if="isLocalAttempt" class="p-4 flex flex-col gap-3">
                  <p class="text-sm text-gray-500 dark:text-neutral-400">
                    PromptPay QR payload was generated locally by the PayIQ engine using the tenant's receiving account configuration. No external API call was made.
                  </p>
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div>
                      <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">⚙ QR Config (input)</p>
                      <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedAttempt.requestBody) }}</pre>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">✓ Generated QR (output)</p>
                      <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedAttempt.responseBody) }}</pre>
                    </div>
                  </div>
                </div>

                <!-- EXTERNAL API: full req/res view -->
                <div v-else class="grid grid-cols-1 lg:grid-cols-2">
                  <!-- Request -->
                  <div class="border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-neutral-800">
                    <div class="px-4 py-1.5 border-b border-gray-100 dark:border-neutral-800">
                      <span class="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">↑ Request</span>
                    </div>
                    <div class="p-3 flex flex-col gap-3">
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.requestHeaders') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-40 whitespace-pre-wrap">{{ fmtJson(selectedAttempt.requestHeaders) }}</pre>
                      </div>
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.requestBody') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedAttempt.requestBody) }}</pre>
                      </div>
                    </div>
                  </div>
                  <!-- Response -->
                  <div>
                    <div class="px-4 py-1.5 border-b border-gray-100 dark:border-neutral-800">
                      <span class="text-[11px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">↓ Response</span>
                    </div>
                    <div class="p-3 flex flex-col gap-3">
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.responseHeaders') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-40 whitespace-pre-wrap">{{ fmtJson(selectedAttempt.responseHeaders) }}</pre>
                      </div>
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.responseBody') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedAttempt.responseBody) }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Provider Callback detail (SCB inbound) -->
              <div v-if="selectedCallback" class="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <div class="px-4 py-2 bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-700 flex items-center gap-3">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">Inbound Callback — {{ selectedCallback.providerCode }}</span>
                  <UBadge :color="selectedCallback.signatureValid ? 'success' : 'error'" variant="subtle" size="xs">{{ selectedCallback.signatureValid ? '✓ Signature Valid' : '✗ Invalid Signature' }}</UBadge>
                  <UBadge :color="selectedCallback.processStatus === 'PROCESSED' ? 'success' : 'warning'" variant="soft" size="xs">{{ selectedCallback.processStatus }}</UBadge>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2">
                  <div class="border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-neutral-800">
                    <div class="px-4 py-1.5 border-b border-gray-100 dark:border-neutral-800">
                      <span class="text-[11px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">↓ Callback Received (inbound)</span>
                    </div>
                    <div class="p-3 flex flex-col gap-3">
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Headers</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-40 whitespace-pre-wrap">{{ fmtJson(selectedCallback.headers) }}</pre>
                      </div>
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">Body</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedCallback.body) }}</pre>
                      </div>
                    </div>
                  </div>
                  <div class="p-4 flex flex-col gap-2">
                    <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">References</p>
                    <div v-for="field in [
                      { label: 'Provider Ref', value: selectedCallback.providerReference ?? '—' },
                      { label: 'Provider Txn ID', value: selectedCallback.providerTxnId ?? '—' },
                      { label: 'Received At', value: selectedCallback.receivedAt ? fmtDate(selectedCallback.receivedAt) : '—' },
                      { label: 'Processed At', value: selectedCallback.processedAt ? fmtDate(selectedCallback.processedAt) : '—' },
                    ]" :key="field.label" class="flex flex-col gap-0.5">
                      <span class="text-xs text-gray-500 dark:text-neutral-400">{{ field.label }}</span>
                      <span class="font-mono text-sm text-gray-700 dark:text-neutral-200">{{ field.value }}</span>
                    </div>
                  </div>
                </div>
              </div>


              <!-- Webhook Delivery detail -->
              <div v-if="selectedWebhookDelivery" class="rounded-lg border border-gray-200 dark:border-neutral-700 overflow-hidden">
                <div class="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-neutral-900/60 border-b border-gray-200 dark:border-neutral-700">
                  <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{ $t('admin.paymentDetail.webhookDeliveries') }}</span>
                  <UBadge :color="whkBadgeColor(selectedWebhookDelivery.status)" variant="subtle" size="xs" class="font-semibold">{{ selectedWebhookDelivery.status }}</UBadge>
                  <span class="text-xs text-gray-500 dark:text-neutral-400">HTTP {{ selectedWebhookDelivery.responseStatusCode ?? '—' }}</span>
                  <span class="text-xs text-gray-400 dark:text-neutral-500 ml-auto">
                    {{ selectedWebhookDelivery.deliveredAt ? fmtDate(selectedWebhookDelivery.deliveredAt) : selectedWebhookDelivery.lastErrorAt ? fmtDate(selectedWebhookDelivery.lastErrorAt) : '—' }}
                  </span>
                </div>
                <div v-if="selectedWebhookDelivery.errorMessage" class="px-4 py-2 bg-red-50 dark:bg-red-950/20 border-b border-red-200 dark:border-red-900/40">
                  <span class="text-xs text-red-600 dark:text-red-400">{{ selectedWebhookDelivery.errorMessage }}</span>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2">
                  <!-- Request -->
                  <div class="border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-neutral-800">
                    <div class="px-4 py-1.5 border-b border-gray-100 dark:border-neutral-800">
                      <span class="text-[11px] font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">↑ Request</span>
                    </div>
                    <div class="p-3 flex flex-col gap-3">
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.requestHeaders') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-40 whitespace-pre-wrap">{{ fmtJson(selectedWebhookDelivery.requestHeaders) }}</pre>
                      </div>
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.requestBody') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedWebhookDelivery.requestBody) }}</pre>
                      </div>
                    </div>
                  </div>
                  <!-- Response -->
                  <div>
                    <div class="px-4 py-1.5 border-b border-gray-100 dark:border-neutral-800">
                      <span class="text-[11px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400">↓ Response</span>
                    </div>
                    <div class="p-3 flex flex-col gap-3">
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.responseHeaders') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-40 whitespace-pre-wrap">{{ fmtJson(selectedWebhookDelivery.responseHeaders) }}</pre>
                      </div>
                      <div>
                        <p class="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1">{{ $t('admin.paymentDetail.responseBody') }}</p>
                        <pre class="font-mono text-xs text-gray-700 dark:text-neutral-300 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-3 py-2 overflow-auto max-h-48 whitespace-pre-wrap">{{ fmtJson(selectedWebhookDelivery.responseBody) }}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Webhook Deliveries -->
      <UCard v-if="payment.webhookDeliveries?.length" :ui="{ body: 'p-0' }">
        <template #header>
          <p class="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">{{
            $t('admin.paymentDetail.webhookDeliveries') }}</p>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">
            <thead>
              <tr class="border-b border-gray-200 dark:border-neutral-800">
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  Event</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  Status</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.attempts') }}</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.endpoint') }}</th>
                <th
                  class="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-200">
                  {{ $t('admin.paymentDetail.created') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in payment.webhookDeliveries" :key="w.id"
                class="border-b border-gray-100 dark:border-neutral-800/60 last:border-0">
                <td class="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-neutral-300">{{ w.eventType }}</td>
                <td class="px-4 py-2.5">
                  <UBadge :color="whkBadgeColor(w.status)" variant="subtle" size="xs" class="font-semibold">{{ w.status
                    }}
                  </UBadge>
                </td>
                <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-neutral-400">{{ w.attemptNumber }}</td>
                <td class="px-4 py-2.5 font-mono text-sm text-gray-600 dark:text-neutral-300">{{ w.webhookEndpoint?.code
                  ??
                  '—' }}</td>
                <td class="px-4 py-2.5 text-sm text-gray-500 dark:text-neutral-400">{{ fmtDate(w.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin-auth" })

const route = useRoute()
const { $getLocale, $t } = useI18n()
const { data, pending } = await useFetch(`/api/admin/payments/${route.params.publicId}`)
const payment = computed(() => data.value as any)

import { fmtDateTime as fmtDateTimeFn } from '~/utils/fmtDate'
function fmtDate(iso: string) { return fmtDateTimeFn(iso, $getLocale()) }

function fmtAmount(v: string) {
  return Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── References list (for copy-able card) ────────────────────────────────────
const refItems = computed(() => [
  { key: 'publicId', label: $t('admin.paymentDetail.publicId'), value: payment.value?.publicId ?? '—' },
  { key: 'orderId', label: $t('admin.paymentDetail.orderId'), value: payment.value?.merchantOrderId ?? '—' },
  { key: 'merchantRef', label: $t('admin.paymentDetail.merchantRef'), value: payment.value?.merchantReference ?? '—' },
  { key: 'providerTxn', label: $t('admin.paymentDetail.providerTxn'), value: payment.value?.providerTransactionId ?? '—' },
  { key: 'providerRef', label: $t('admin.paymentDetail.providerRef'), value: payment.value?.providerReference ?? '—' },
])

// ─── Timeline selection ───────────────────────────────────────────────────────
const selectedEventId = ref<string>('')
const selectedEvent = computed(() => payment.value?.events?.find((e: any) => e.id === selectedEventId.value) ?? null)
function selectEvent(id: string) { selectedEventId.value = selectedEventId.value === id ? '' : id }

// Events that show QR in detail panel (QR was generated at this step)
const QR_EVENTS = new Set(['PROVIDER_ACCEPTED', 'AWAITING_CUSTOMER'])
const selectedEventShowsQR = computed(() => selectedEvent.value && QR_EVENTS.has(selectedEvent.value.type))

// Match selected event → providerAttempt (context-aware per flow)
const selectedAttempt = computed(() => {
  if (!selectedEvent.value || !payment.value) return null
  const attempts: any[] = payment.value?.providerAttempts ?? []
  const t = selectedEvent.value.type
  const isSlipBased = payment.value.paymentMethodType === 'BANK_TRANSFER_SLIP'

  // QR creation step — SCB uses CREATE_QR, THAI_QR uses CREATE_PAYMENT
  if (['PROVIDER_REQUESTED', 'PROVIDER_ACCEPTED'].includes(t))
    return attempts.find(a => ['CREATE_QR', 'CREATE_PAYMENT'].includes(a.type)) ?? null

  // Slip events — always show the VERIFY_SLIP attempt
  if (['SLIP_SUBMITTED', 'SLIP_VERIFIED', 'SLIP_REJECTED'].includes(t))
    return attempts.find(a => a.type === 'VERIFY_SLIP') ?? null

  // Payment outcome — SCB shows INQUIRY, THAI_QR slip shows VERIFY_SLIP
  if (['PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'PROCESSING'].includes(t)) {
    if (isSlipBased) return attempts.find(a => a.type === 'VERIFY_SLIP') ?? null
    return attempts.find(a => a.type === 'INQUIRY') ?? null
  }
  return null
})

// True when the attempt is a local operation (no external API call)
const isLocalAttempt = computed(() => selectedAttempt.value?.type === 'CREATE_PAYMENT')

// Human-readable label for the attempt panel header
const attemptTypeLabel = computed(() => {
  const type = selectedAttempt.value?.type
  const pc   = selectedAttempt.value?.providerCode ?? payment.value?.providerCode ?? ''
  const labels: Record<string, string> = {
    CREATE_QR:      `QR Creation — ${pc} API`,
    CREATE_PAYMENT: 'QR Generated Locally (PayIQ Engine)',
    VERIFY_SLIP:    `Slip Verification — ${pc}`,
    INQUIRY:        `Payment Inquiry — ${pc} API`,
    REFUND:         `Refund — ${pc}`,
    CANCEL:         `Cancel — ${pc}`,
  }
  return type ? (labels[type] ?? type) : ''
})

// Match selected event → providerCallback
const selectedCallback = computed(() => {
  if (!selectedEvent.value) return null
  if (selectedEvent.value.type === 'PROVIDER_CALLBACK_RECEIVED')
    return payment.value?.providerCallbacks?.[0] ?? null
  return null
})

// Match selected event → webhookDelivery
const WEBHOOK_EVENT_TYPES = new Set(['WEBHOOK_QUEUED', 'WEBHOOK_DELIVERED', 'WEBHOOK_FAILED'])
const selectedWebhookDelivery = computed(() => {
  if (!selectedEvent.value) return null
  if (!WEBHOOK_EVENT_TYPES.has(selectedEvent.value.type)) return null
  return payment.value?.webhookDeliveries?.[0] ?? null
})

// Timeline dot colors
function dotColorClass(ev: any): string {
  const c = timelineColor(ev.toStatus, ev.type)
  return { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500', neutral: 'bg-gray-400 dark:bg-neutral-500' }[c] ?? 'bg-gray-400'
}

// ─── JSON pretty-print ────────────────────────────────────────────────────────
function fmtJson(v: any): string {
  if (v === null || v === undefined) return '—'
  try { return JSON.stringify(v, null, 2) }
  catch { return String(v) }
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────
const copiedId = ref('')
async function copy(text: string, id: string) {
  if (!text || text === '—') return
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    setTimeout(() => { copiedId.value = '' }, 1800)
  } catch { }
}

// ─── QR helpers ───────────────────────────────────────────────────────────────
const qrImageUrl = computed(() => {
  if (!payment.value?.qrPayload) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payment.value.qrPayload)}&bgcolor=ffffff&color=000000`
})

const downloadingQR = ref(false)
async function downloadQR() {
  if (!payment.value?.qrPayload) return
  downloadingQR.value = true
  try {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(payment.value.qrPayload)}&bgcolor=ffffff&color=000000`
    const res = await fetch(url)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `qr-${payment.value.publicId}.png`
    a.click()
    URL.revokeObjectURL(blobUrl)
  } finally {
    downloadingQR.value = false
  }
}

// ─── Status badge colors ──────────────────────────────────────────────────────
const STATUS_BADGE_COLORS: Record<string, string> = {
  SUCCEEDED: "success",
  FAILED: "error",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  AWAITING_CUSTOMER: "warning",
  PROCESSING: "info",
  CREATED: "neutral",
  ROUTING: "neutral",
  PENDING_PROVIDER: "warning",
  REVERSED: "warning",
  REFUNDED: "info",
}
function statusBadgeColor(s: string): any { return STATUS_BADGE_COLORS[s] ?? "neutral" }

// ─── Timeline dot colors ──────────────────────────────────────────────────────
const TIMELINE_COLORS: Record<string, string> = {
  SUCCEEDED: "success",
  FAILED: "error",
  EXPIRED: "error",
  CANCELLED: "error",
  REVERSED: "error",
  REFUNDED: "warning",
  AWAITING_CUSTOMER: "warning",
  PENDING_PROVIDER: "warning",
  PROCESSING: "info",
  CREATED: "info",
  ROUTING: "info",
}
function timelineColor(toStatus?: string, eventType?: string): string {
  if (toStatus && TIMELINE_COLORS[toStatus]) return TIMELINE_COLORS[toStatus]
  if (eventType?.includes("SUCCEEDED") || eventType?.includes("COMPLETED") || eventType === "SLIP_VERIFIED") return "success"
  if (eventType?.includes("FAILED") || eventType?.includes("ERROR") || eventType?.includes("EXPIRED") || eventType?.includes("CANCELLED") || eventType?.includes("REVERSED") || eventType === "SLIP_REJECTED") return "error"
  if (eventType?.includes("REFUNDED")) return "warning"
  if (eventType === "SLIP_SUBMITTED") return "info"
  return "neutral"
}

function whkBadgeColor(s: string): any {
  return s === "DELIVERED" ? "success" : s === "DEAD" ? "error" : s === "RETRYING" ? "warning" : "neutral"
}

// ─── Timeline icon map ────────────────────────────────────────────────────────
function eventIcon(type: string): string {
  const icons: Record<string, string> = {
    PAYMENT_CREATED: "lucide-cross",
    ROUTE_RESOLVED: "lucide-route",
    PROVIDER_REQUESTED: "i-lucide-send",
    PROVIDER_ACCEPTED: "lucide-check-check",
    ROUTING_STARTED: "lucide-route",
    ROUTING_COMPLETED: "lucide-arrow-left-right",
    PROVIDER_REQUEST_SENT: "i-lucide-send",
    PROVIDER_RESPONSE_RECEIVED: "i-lucide-download",
    PROVIDER_CALLBACK_RECEIVED: "i-lucide-phone-incoming",
    STATUS_CHANGED: "i-lucide-refresh-cw",
    PAYMENT_SUCCEEDED: "lucide-banknote-arrow-up",
    PAYMENT_FAILED: "lucide-banknote-x",
    PAYMENT_EXPIRED: "i-lucide-clock",
    PAYMENT_CANCELLED: "i-lucide-ban",
    PAYMENT_REVERSED: "i-lucide-rotate-ccw",
    PAYMENT_REFUNDED: "lucide-banknote-arrow-down",
    WEBHOOK_SENT: "i-lucide-webhook",
    WEBHOOK_QUEUED: "lucide-list-end",
    WEBHOOK_DELIVERED: "lucide-square-check-big",
    WEBHOOK_FAILED: "i-lucide-webhook",
    SLIP_SUBMITTED: "i-lucide-upload",
    SLIP_VERIFIED: "i-lucide-shield-check",
    SLIP_REJECTED: "i-lucide-shield-x",
    ERROR: "lucide-x",
  }
  return icons[type] ?? "lucide-circle-question-mark  "
}

</script>
