import {
  fetchGeoportalRain30d,
  parseGeoportalRainResponse,
  URRAO_STATION_CODE,
  type GeoportalRainDailyRow,
  type GeoportalStationMetadata,
} from "../../lib/rain/geoportal-rain"
import {
  fetchSiataRainLayer,
  getUrraoSensor,
  parseSiataLayerMonthlyRows,
} from "../../lib/rain/siata-fetch"

type EdgeEnv = {
  SUPABASE_URL?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  CRON_SECRET?: string
}

function getEnv(): EdgeEnv {
  return {
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    CRON_SECRET: Deno.env.get("CRON_SECRET"),
  }
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function assertEnv(env: EdgeEnv): asserts env is Required<
  Pick<EdgeEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">
> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
}

function supabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal",
  }
}

async function upsertStation(
  supabaseUrl: string,
  serviceRoleKey: string,
  station: GeoportalStationMetadata
) {
  const body = {
    station_code: station.stationCode,
    station_name: station.stationName,
    city: station.city,
    latitude: station.latitude,
    longitude: station.longitude,
    subcuenca: station.subcuenca,
    updated_at: new Date().toISOString(),
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/siata_rain_stations`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Station upsert failed: ${response.status} ${text}`)
  }
}

async function upsertMonthlyRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  stationCode: string,
  calendarYear: number
) {
  const layer = await fetchSiataRainLayer()
  const sensor = layer ? getUrraoSensor(layer) : null
  if (!sensor) return 0

  const fetchedAt = new Date().toISOString()
  const rows = parseSiataLayerMonthlyRows(sensor, calendarYear)
    .filter((row) => row.stationCode === stationCode)
    .map((row) => ({
      station_code: row.stationCode,
      calendar_year: row.calendarYear,
      month: row.month,
      rain_mm: row.rainMm,
      fetched_at: fetchedAt,
    }))

  if (rows.length === 0) return 0

  const response = await fetch(`${supabaseUrl}/rest/v1/siata_rain_monthly`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Monthly upsert failed: ${response.status} ${text}`)
  }

  return rows.length
}

async function upsertDailyRows(
  supabaseUrl: string,
  serviceRoleKey: string,
  stationCode: string,
  daily: GeoportalRainDailyRow[]
) {
  const fetchedAt = new Date().toISOString()
  const rows = daily.map((row) => ({
    station_code: stationCode,
    rain_date: row.rainDate,
    rain_mm_pluvio_1: row.rainMmPluvio1,
    rain_mm_pluvio_2: row.rainMmPluvio2,
    rain_mm_avg: row.rainMmAvg,
    acum_pluvio_1: row.acumPluvio1,
    acum_pluvio_2: row.acumPluvio2,
    data_coverage_pct: row.dataCoveragePct,
    fetched_at: fetchedAt,
  }))

  const response = await fetch(`${supabaseUrl}/rest/v1/siata_rain_daily`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Daily upsert failed: ${response.status} ${text}`)
  }
}

export default async (request: Request): Promise<Response> => {
  if (request.method !== "POST" && request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
  }

  const env = getEnv()

  if (env.CRON_SECRET) {
    const auth = request.headers.get("Authorization")
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      return unauthorized()
    }
  }

  try {
    assertEnv(env)

    const url = new URL(request.url)
    const stationCode = url.searchParams.get("station") ?? URRAO_STATION_CODE

    const raw = await fetchGeoportalRain30d(stationCode)
    const { station, daily } = parseGeoportalRainResponse(raw, stationCode)

    if (daily.length === 0) {
      throw new Error(`No daily rows parsed for station ${stationCode}`)
    }

    await upsertStation(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, station)
    await upsertDailyRows(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      station.stationCode,
      daily
    )

    const calendarYear = new Date().getFullYear()
    let monthlyRowsUpserted = 0

    try {
      monthlyRowsUpserted = await upsertMonthlyRows(
        env.SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        station.stationCode,
        calendarYear
      )
    } catch (monthlyError) {
      const message =
        monthlyError instanceof Error
          ? monthlyError.message
          : "Monthly sync failed"
      console.warn(`SIATA monthly sync warning: ${message}`)
    }

    const dates = daily.map((row) => row.rainDate).sort()

    return jsonResponse({
      ok: true,
      rowsUpserted: daily.length,
      monthlyRowsUpserted,
      calendarYear,
      stationCode: station.stationCode,
      stationName: station.stationName,
      dateRange: {
        from: dates[0] ?? null,
        to: dates[dates.length - 1] ?? null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return jsonResponse({ ok: false, error: message }, 500)
  }
}
