import { BOGOTA_TIME_ZONE, getBogotaDateIso } from "@/lib/rain/dates"

function parseBogotaCalendarDate(date: string): Date {
  // Noon Bogotá keeps the calendar day stable when formatting.
  return new Date(`${date}T12:00:00-05:00`)
}

export function toLocalDateIso(date: Date): string {
  return getBogotaDateIso(date)
}

function formatShortDate(date: string): string {
  const d = parseBogotaCalendarDate(date)
  const month = d.toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TIME_ZONE,
    month: "long",
  })
  const monthLabel = month.charAt(0).toUpperCase() + month.slice(1)
  const day = d.toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TIME_ZONE,
    day: "numeric",
  })
  return `${day} ${monthLabel}`
}

function formatDayName(date: string): string {
  const name = parseBogotaCalendarDate(date).toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TIME_ZONE,
    weekday: "long",
  })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getContextDateLabel(date: string): {
  primary: string
  secondary: string
} {
  const todayIso = getBogotaDateIso()
  const yesterdayIso = (() => {
    const [year, month, day] = todayIso.split("-").map(Number)
    return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
  })()

  if (date === todayIso) {
    return { primary: "HOY", secondary: formatDayName(date) }
  }

  if (date === yesterdayIso) {
    return { primary: "Ayer", secondary: formatDayName(date) }
  }

  return {
    primary: formatShortDate(date),
    secondary: formatDayName(date),
  }
}

export function isTodayOrYesterday(primary: string): boolean {
  return primary === "HOY" || primary === "Ayer"
}
