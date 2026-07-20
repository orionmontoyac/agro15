import { createClient } from "@/lib/supabase/server"

import { addDaysToIsoDate, getBogotaDateIso } from "./dates"
import { URRAO_STATION_CODE } from "./geoportal-rain"

export type RainDailyDbRow = {
  rainDate: string
  rainMm: number
  rainMmPluvio1: number
  rainMmPluvio2: number
}

export type RainStationDbRow = {
  stationCode: string
  stationName: string
  city: string | null
  latitude: number | null
  longitude: number | null
  subcuenca: string | null
}

type DbDailyRow = {
  rain_date: string
  rain_mm_avg: number
  rain_mm_pluvio_1: number
  rain_mm_pluvio_2: number
}

function sumRainForDays(rows: DbDailyRow[], days: number): number {
  // Never include future Bogotá calendar days (SIATA sometimes opens tomorrow).
  const bogotaToday = getBogotaDateIso()
  let endIso: string | null = null
  for (const row of rows) {
    if (row.rain_date > bogotaToday) continue
    if (endIso == null || row.rain_date > endIso) endIso = row.rain_date
  }
  if (endIso == null) return 0

  const cutoffIso = addDaysToIsoDate(endIso, -days + 1)

  return rows
    .filter((row) => row.rain_date >= cutoffIso && row.rain_date <= endIso)
    .reduce((sum, row) => sum + Number(row.rain_mm_avg), 0)
}

export function computePeriodsFromDailyRows(rows: DbDailyRow[]) {
  if (rows.length === 0) return null

  return {
    rainMm24h: sumRainForDays(rows, 1),
    rainMm72h: sumRainForDays(rows, 3),
    rainMm30d: sumRainForDays(rows, 30),
  }
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

export function computeMonthlyFromDailyRows(rows: DbDailyRow[]) {
  const byMonth = new Map<number, number>()

  for (const row of rows) {
    const month = Number(row.rain_date.split("-")[1])
    if (month < 1 || month > 12) continue
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(row.rain_mm_avg))
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, rainMm]) => ({
      month,
      label: MONTH_LABELS[month - 1] ?? String(month),
      shortLabel: MONTH_SHORT_LABELS[month - 1] ?? String(month),
      rainMm,
    }))
}

type DbMonthlyRow = {
  month: number
  rain_mm: number
}

export type RainfallMonthlyDbPoint = {
  month: number
  label: string
  shortLabel: string
  rainMm: number
}

export function mapMonthlyRows(rows: DbMonthlyRow[]): RainfallMonthlyDbPoint[] {
  return rows
    .sort((a, b) => a.month - b.month)
    .map((row) => ({
      month: row.month,
      label: MONTH_LABELS[row.month - 1] ?? String(row.month),
      shortLabel: MONTH_SHORT_LABELS[row.month - 1] ?? String(row.month),
      rainMm: Number(row.rain_mm),
    }))
}

export function mapDailyRows(rows: DbDailyRow[]): RainDailyDbRow[] {
  const bogotaToday = getBogotaDateIso()
  return rows
    .filter((row) => row.rain_date <= bogotaToday)
    .map((row) => ({
      rainDate: row.rain_date,
      rainMm: Number(row.rain_mm_avg),
      rainMmPluvio1: Number(row.rain_mm_pluvio_1),
      rainMmPluvio2: Number(row.rain_mm_pluvio_2),
    }))
}

export async function getRainDailyFromDb(
  stationCode: string = URRAO_STATION_CODE
): Promise<{
  station: RainStationDbRow | null
  daily: RainDailyDbRow[]
}> {
  const supabase = await createClient()

  const [{ data: stationData }, { data: dailyData }] = await Promise.all([
    supabase
      .from("siata_rain_stations")
      .select(
        "station_code, station_name, city, latitude, longitude, subcuenca"
      )
      .eq("station_code", stationCode)
      .maybeSingle(),
    supabase
      .from("siata_rain_daily")
      .select("rain_date, rain_mm_avg, rain_mm_pluvio_1, rain_mm_pluvio_2")
      .eq("station_code", stationCode)
      .order("rain_date", { ascending: true }),
  ])

  const station = stationData
    ? {
        stationCode: stationData.station_code,
        stationName: stationData.station_name,
        city: stationData.city,
        latitude: stationData.latitude,
        longitude: stationData.longitude,
        subcuenca: stationData.subcuenca,
      }
    : null

  const daily = mapDailyRows((dailyData ?? []) as DbDailyRow[])

  return { station, daily }
}

export async function getRainMonthlyFromDb(
  stationCode: string = URRAO_STATION_CODE,
  calendarYear: number = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
    }).format(new Date())
  )
): Promise<RainfallMonthlyDbPoint[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from("siata_rain_monthly")
    .select("month, rain_mm")
    .eq("station_code", stationCode)
    .eq("calendar_year", calendarYear)
    .order("month", { ascending: true })

  return mapMonthlyRows((data ?? []) as DbMonthlyRow[])
}
