/** Calendar date helpers in America/Bogota (SIATA / SIPSA / Colombia). */

export const BOGOTA_TIME_ZONE = "America/Bogota"

export function getBogotaDateIso(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA_TIME_ZONE,
  }).format(date)
}

export function getBogotaYear(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: BOGOTA_TIME_ZONE,
      year: "numeric",
    }).format(date)
  )
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return shifted.toISOString().slice(0, 10)
}

/** True when isoDate is on or before today's calendar date in Bogotá. */
export function isOnOrBeforeBogotaToday(isoDate: string): boolean {
  return isoDate <= getBogotaDateIso()
}

/**
 * Parse a SIATA/Geoportal `Tiempo` value as a Bogotá calendar date.
 * Values are typically `YYYY-MM-DD HH:MM:SS` without timezone; treat the date
 * part as America/Bogota (not UTC).
 */
export function parseBogotaCalendarDate(value: string): string | null {
  const datePart = value.trim().split(/\s+/)[0]
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  return datePart
}

export function formatBogotaDayLabel(
  isoDate: string,
  options: { compact?: boolean } = {}
): string {
  // Noon Bogotá avoids DST/edge issues when formatting calendar dates.
  const date = new Date(`${isoDate}T12:00:00-05:00`)
  if (options.compact) {
    return date.toLocaleDateString("es-CO", {
      timeZone: BOGOTA_TIME_ZONE,
      day: "numeric",
    })
  }
  return date.toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TIME_ZONE,
    day: "numeric",
    month: "short",
  })
}
