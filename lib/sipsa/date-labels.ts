function parseDate(date: string): Date {
  return new Date(`${date}T12:00:00`)
}

export function toLocalDateIso(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function formatShortDate(date: string): string {
  const d = parseDate(date)
  const month = d.toLocaleDateString("es-CO", { month: "long" })
  const monthLabel = month.charAt(0).toUpperCase() + month.slice(1)
  return `${d.getDate()} ${monthLabel}`
}

function formatDayName(date: string): string {
  const name = parseDate(date).toLocaleDateString("es-CO", { weekday: "long" })
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function getContextDateLabel(date: string): {
  primary: string
  secondary: string
} {
  const todayIso = toLocalDateIso(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayIso = toLocalDateIso(yesterday)

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
