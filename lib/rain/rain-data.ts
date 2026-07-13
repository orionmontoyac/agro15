import {
  fetchSiataRainLayer,
  getUrraoSensor,
  parseMm,
  URRAO_MUNICIPALITY,
  type SiataRainLayerResponse,
} from "./siata-fetch"
import { URRAO_STATION_CODE } from "./geoportal-rain"
import { addDaysToIsoDate, getBogotaDateIso } from "./dates"
import {
  computeMonthlyFromDailyRows,
  computePeriodsFromDailyRows,
  getRainDailyFromDb,
  getRainMonthlyFromDb,
} from "./rain-db"

export { URRAO_MUNICIPALITY, URRAO_STATION_CODE }

export type RainfallMonthlyPoint = {
  month: number
  label: string
  shortLabel: string
  rainMm: number
}

export type RainfallDailyPoint = {
  date: string
  rainMm: number
}

export type RainfallPeriods = {
  rainMm24h: number
  rainMm72h: number
  rainMm30d: number
}

export type RainfallData = {
  location: { municipality: string; region: string; stationCode?: string }
  current: { rainMm5m: number; updatedAt: string } | null
  periods: RainfallPeriods | null
  monthly: RainfallMonthlyPoint[]
  daily: RainfallDailyPoint[]
  dataSource: "db" | "layer" | "mixed"
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

export function buildFullYearMonthlySeries(
  points: RainfallMonthlyPoint[]
): RainfallMonthlyPoint[] {
  const byMonth = new Map(points.map((point) => [point.month, point.rainMm]))

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    return {
      month,
      label: MONTH_LABELS[index] ?? String(month),
      shortLabel: MONTH_SHORT_LABELS[index] ?? String(month),
      rainMm: byMonth.get(month) ?? 0,
    }
  })
}

function parsePeriodsFromLayer(
  descripcion: Record<string, { valor_alfanumerico?: string }> | undefined
): RainfallPeriods | null {
  const rain24h = getAttributeValue(descripcion, "D_24_H")
  const rain72h = getAttributeValue(descripcion, "D_72_H")
  const rain30d = getAttributeValue(descripcion, "D_30_D")

  if (!rain24h && !rain72h && !rain30d) return null

  return {
    rainMm24h: parseMm(rain24h ?? "0"),
    rainMm72h: parseMm(rain72h ?? "0"),
    rainMm30d: parseMm(rain30d ?? "0"),
  }
}

function parseCurrentFromLayer(
  descripcion: Record<string, { valor_alfanumerico?: string }> | undefined
): { rainMm5m: number; updatedAt: string } | null {
  const rainRaw = getAttributeValue(descripcion, "D_5_m")
  const updatedAtRaw = getAttributeValue(
    descripcion,
    "fecha_ultima_actualizacion"
  )

  if (!rainRaw || !updatedAtRaw) return null

  return {
    rainMm5m: parseMm(rainRaw),
    updatedAt: updatedAtRaw,
  }
}

export function parseRainfallDataFromLayer(
  data: SiataRainLayerResponse
): RainfallData | null {
  const sensor = getUrraoSensor(data)
  if (!sensor?.atributos) return null

  const descripcion = sensor.atributos.descripcion
  const stationCode = getAttributeValue(descripcion, "Codigo") ?? undefined
  const monthly = buildFullYearMonthlySeries(
    parseMonthlySeries(sensor.atributos.serie_mensual)
  )
  const periods = parsePeriodsFromLayer(descripcion)
  const current = parseCurrentFromLayer(descripcion)

  if (!current && monthly.length === 0 && !periods) return null

  return {
    location: {
      municipality: URRAO_MUNICIPALITY,
      region: "Antioquia",
      stationCode,
    },
    current,
    periods,
    monthly,
    daily: [],
    dataSource: "layer",
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

export function getRecentRainStatus(periods: RainfallPeriods | null): string {
  if (!periods) return "Datos de periodo no disponibles"

  if (periods.rainMm24h > 0) {
    return "Lluvia registrada en las últimas 72 horas"
  }

  if (periods.rainMm72h > 0) {
    return "Sin lluvia en las últimas 24 horas"
  }

  return "Sin lluvia en al menos 3 días"
}

export function computeDaysWithoutRain(
  daily: RainfallDailyPoint[],
  currentRainMm5m?: number | null
): number | null {
  if (currentRainMm5m != null && currentRainMm5m > 0) return 0

  const byDate = new Map(daily.map((row) => [row.date, row.rainMm]))
  if (byDate.size === 0) return null

  const bogotaToday = getBogotaDateIso()
  // SIATA may already open the next calendar-day bucket (UTC/ahead of Bogotá).
  // Start from the latest observation so recent rain on that tip is not ignored.
  let latestDataDate = bogotaToday
  for (const date of byDate.keys()) {
    if (date > latestDataDate) latestDataDate = date
  }

  let count = 0
  let dateIso = latestDataDate

  while (count < 366) {
    const rain = byDate.get(dateIso)
    const isTipDay = dateIso >= bogotaToday

    if (isTipDay) {
      if (rain !== undefined && rain > 0) break
      // Skip ahead-of-Bogotá empty/zero buckets without counting them as dry.
      if (dateIso > bogotaToday) {
        dateIso = addDaysToIsoDate(dateIso, -1)
        continue
      }
      // Bogotá today with missing or zero rain still counts as a dry day.
      count++
    } else {
      if (rain === undefined) break
      if (rain > 0) break
      count++
    }

    dateIso = addDaysToIsoDate(dateIso, -1)
  }

  return count
}

export function formatDaysWithoutRainLabel(days: number | null): string {
  if (days === null) return "Requiere historial diario sincronizado"
  if (days === 0) return "Lluvia registrada recientemente"
  if (days === 1) return "1 día consecutivo sin lluvia"
  return `${days} días consecutivos sin lluvia`
}

async function fetchLiveSiataLayerContext(): Promise<{
  current: RainfallData["current"]
  stationCode?: string
  monthly: RainfallMonthlyPoint[]
}> {
  try {
    const layer = await fetchSiataRainLayer()
    if (!layer) return { current: null, monthly: [] }

    const sensor = getUrraoSensor(layer)
    const descripcion = sensor?.atributos?.descripcion
    const current = parseCurrentFromLayer(descripcion)
    const stationCode = getAttributeValue(descripcion, "Codigo") ?? undefined
    const monthly = buildFullYearMonthlySeries(
      parseMonthlySeries(sensor?.atributos?.serie_mensual)
    )

    return { current, stationCode, monthly }
  } catch {
    return { current: null, monthly: [] }
  }
}

function resolveMonthlySeries(
  layerMonthly: RainfallMonthlyPoint[],
  dbMonthly: RainfallMonthlyPoint[],
  dailyRows: {
    rain_date: string
    rain_mm_avg: number
    rain_mm_pluvio_1: number
    rain_mm_pluvio_2: number
  }[]
): RainfallMonthlyPoint[] {
  if (layerMonthly.length === 12) return layerMonthly

  if (dbMonthly.length > 0) {
    return buildFullYearMonthlySeries(dbMonthly)
  }

  return buildFullYearMonthlySeries(computeMonthlyFromDailyRows(dailyRows))
}

export async function getRainfallData(): Promise<RainfallData | null> {
  const calendarYear = new Date().getFullYear()
  const [{ station, daily: dbDaily }, dbMonthly] = await Promise.all([
    getRainDailyFromDb(URRAO_STATION_CODE),
    getRainMonthlyFromDb(URRAO_STATION_CODE, calendarYear),
  ])
  const live = await fetchLiveSiataLayerContext()

  if (dbDaily.length > 0) {
    const dbRows = dbDaily.map((row) => ({
      rain_date: row.rainDate,
      rain_mm_avg: row.rainMm,
      rain_mm_pluvio_1: row.rainMmPluvio1,
      rain_mm_pluvio_2: row.rainMmPluvio2,
    }))

    const periods = computePeriodsFromDailyRows(dbRows)
    const monthly = resolveMonthlySeries(live.monthly, dbMonthly, dbRows)
    const daily: RainfallDailyPoint[] = dbDaily.map((row) => ({
      date: row.rainDate,
      rainMm: row.rainMm,
    }))

    return {
      location: {
        municipality: station?.city ?? URRAO_MUNICIPALITY,
        region: "Antioquia",
        stationCode: station?.stationCode ?? URRAO_STATION_CODE,
      },
      current: live.current,
      periods,
      monthly,
      daily,
      dataSource: live.current ? "mixed" : "db",
    }
  }

  try {
    const layer = await fetchSiataRainLayer()
    if (!layer) return null
    return parseRainfallDataFromLayer(layer)
  } catch {
    return null
  }
}
