import {
  fetchSiata30DayRain,
  fetchSiataRainLayer,
  getUrraoSensor,
  parseMm,
  URRAO_MUNICIPALITY,
  type Siata30DayRainResponse,
  type SiataRainLayerResponse,
} from "./siata-fetch"

export { URRAO_MUNICIPALITY }

export type RainfallMonthlyPoint = {
  month: number
  label: string
  shortLabel: string
  rainMm: number
}

export type RainfallDailyPoint = {
  date: string
  label: string
  shortLabel: string
  rainMm: number
}

export type RainfallData = {
  location: { municipality: string; region: string; stationName?: string }
  current: { rainMm5m: number; updatedAt: string } | null
  monthly: RainfallMonthlyPoint[]
  daily: RainfallDailyPoint[]
}

const MONTH_LABELS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const

const MONTH_SHORT_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

function getAttributeValue(
  attrs: Record<string, { valor_alfanumerico?: string }> | undefined,
  key: string
): string | null {
  const value = attrs?.[key]?.valor_alfanumerico
  return value ?? null
}

const MONTH_KEY_MAP: Record<string, number> = {
  P_ACUM_ENERO: 1,
  P_ACUM_FEBRERO: 2,
  P_ACUM_MARZO: 3,
  P_ACUM_ABRIL: 4,
  P_ACUM_MAYO: 5,
  P_ACUM_JUNIO: 6,
  P_ACUM_JULIO: 7,
  P_ACUM_AGOSTO: 8,
  P_ACUM_SEPTIEMBRE: 9,
  P_ACUM_OCTUBRE: 10,
  P_ACUM_NOVIEMBRE: 11,
  P_ACUM_DICIEMBRE: 12,
}

function formatDailyLabel(dateIso: string): { label: string; shortLabel: string } {
  const date = new Date(`${dateIso}T12:00:00`)
  const month = date.toLocaleDateString("es-CO", { month: "long" })
  const monthLabel = month.charAt(0).toUpperCase() + month.slice(1)
  const shortMonth = date.toLocaleDateString("es-CO", { month: "short" })
  return {
    label: `${date.getDate()} ${monthLabel}`,
    shortLabel: `${date.getDate()} ${shortMonth}`,
  }
}

export function parseMonthlySeries(
  serieMensual: Record<string, { valor_alfanumerico?: string }> | undefined
): RainfallMonthlyPoint[] {
  if (!serieMensual) return []

  return Object.entries(serieMensual)
    .filter(([key]) => key.startsWith("P_ACUM_"))
    .map(([key, value]) => {
      const month = MONTH_KEY_MAP[key] ?? 0
      const monthIndex = month > 0 ? month - 1 : 0
      return {
        month: month > 0 ? month : monthIndex + 1,
        label: MONTH_LABELS[monthIndex] ?? key,
        shortLabel: MONTH_SHORT_LABELS[monthIndex] ?? key,
        rainMm: parseMm(value.valor_alfanumerico ?? "0"),
      }
    })
    .sort((a, b) => a.month - b.month)
}

export function parseDaily30DaySeries(
  data: Siata30DayRainResponse
): RainfallDailyPoint[] {
  const times = data.info?.Tiempo ?? []
  const values = data.info?.pluvio_1 ?? []
  if (times.length === 0 || values.length === 0) return []

  const length = Math.min(times.length, values.length)

  return Array.from({ length }, (_, index) => {
    const dateIso = times[index].slice(0, 10)
    const { label, shortLabel } = formatDailyLabel(dateIso)
    return {
      date: dateIso,
      label,
      shortLabel,
      rainMm: values[index] ?? 0,
    }
  })
}

export function parseRainfallData(
  data: SiataRainLayerResponse,
  daily: RainfallDailyPoint[] = [],
  stationName?: string
): RainfallData | null {
  const sensor = getUrraoSensor(data)
  if (!sensor?.atributos) {
    if (daily.length === 0) return null

    return {
      location: {
        municipality: URRAO_MUNICIPALITY,
        region: "Antioquia",
        stationName,
      },
      current: null,
      monthly: [],
      daily,
    }
  }

  const descripcion = sensor.atributos.descripcion
  const rainRaw = getAttributeValue(descripcion, "D_5_m")
  const updatedAtRaw = getAttributeValue(
    descripcion,
    "fecha_ultima_actualizacion"
  )

  const monthly = parseMonthlySeries(sensor.atributos.serie_mensual)

  const current =
    rainRaw && updatedAtRaw
      ? {
          rainMm5m: parseMm(rainRaw),
          updatedAt: updatedAtRaw,
        }
      : null

  if (!current && monthly.length === 0 && daily.length === 0) return null

  return {
    location: {
      municipality: URRAO_MUNICIPALITY,
      region: "Antioquia",
      stationName,
    },
    current,
    monthly,
    daily,
  }
}

export function getCurrentMonthAccumulation(
  monthly: RainfallMonthlyPoint[]
): number | null {
  if (monthly.length === 0) return null
  const currentMonth = new Date().getMonth() + 1
  const point = monthly.find((entry) => entry.month === currentMonth)
  return point?.rainMm ?? monthly[monthly.length - 1]?.rainMm ?? null
}

export function getLast30DaysTotal(daily: RainfallDailyPoint[]): number {
  return daily.reduce((sum, point) => sum + point.rainMm, 0)
}

export function getCurrentMonthFromDaily(daily: RainfallDailyPoint[]): number {
  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()

  return daily
    .filter((point) => {
      const date = new Date(`${point.date}T12:00:00`)
      return date.getMonth() === month && date.getFullYear() === year
    })
    .reduce((sum, point) => sum + point.rainMm, 0)
}

export type DaysWithoutRainSummary = {
  days: number
  lastRainDate: string | null
  lastRainMm: number | null
  lastRainLabel: string | null
}

export function getDaysWithoutRain(
  daily: RainfallDailyPoint[]
): DaysWithoutRainSummary {
  if (daily.length === 0) {
    return {
      days: 0,
      lastRainDate: null,
      lastRainMm: null,
      lastRainLabel: null,
    }
  }

  const sorted = [...daily].sort((a, b) => b.date.localeCompare(a.date))
  let days = 0

  for (const point of sorted) {
    if (point.rainMm > 0) {
      return {
        days,
        lastRainDate: point.date,
        lastRainMm: point.rainMm,
        lastRainLabel: point.label,
      }
    }
    days++
  }

  return {
    days: sorted.length,
    lastRainDate: null,
    lastRainMm: null,
    lastRainLabel: null,
  }
}

export function getRainyDaysCount(daily: RainfallDailyPoint[]): number {
  return daily.filter((point) => point.rainMm > 0).length
}

export async function getRainfallData(): Promise<RainfallData | null> {
  const [layerResult, daily30Result] = await Promise.allSettled([
    fetchSiataRainLayer(),
    fetchSiata30DayRain(),
  ])

  const dailyResponse =
    daily30Result.status === "fulfilled" ? daily30Result.value : null
  const daily = dailyResponse ? parseDaily30DaySeries(dailyResponse) : []
  const stationName = dailyResponse?.info?.NombreEstacion

  if (layerResult.status === "fulfilled" && layerResult.value) {
    return parseRainfallData(layerResult.value, daily, stationName)
  }

  if (daily.length === 0) return null

  return {
    location: {
      municipality: dailyResponse?.info?.Ciudad ?? URRAO_MUNICIPALITY,
      region: "Antioquia",
      stationName,
    },
    current: null,
    monthly: [],
    daily,
  }
}
