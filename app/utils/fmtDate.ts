/**
 * fmtDate utility — มาตรฐานวันที่ทั้งโปรเจ็ค
 *
 * Thai:    "14 มิ.ย. 2568 14:30:25"  (th-TH, พุทธศักราช)
 * English: "14 Jun 2025 14:30:25"    (en-GB)
 *
 * ใช้: fmtDateTime(iso, locale)
 * locale มาจาก $getLocale() ของ nuxt-i18n-micro → "th" หรือ "en"
 */
export function fmtDateTime(iso: string | Date | null | undefined, locale: string = 'en'): string {
  if (!iso) return '—'
  const l = locale === 'th' ? 'th-TH' : 'en-GB'
  return new Date(iso).toLocaleString(l, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** แสดงแค่วันที่ ไม่มีเวลา */
export function fmtDate(iso: string | Date | null | undefined, locale: string = 'en'): string {
  if (!iso) return '—'
  const l = locale === 'th' ? 'th-TH' : 'en-GB'
  return new Date(iso).toLocaleDateString(l, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
