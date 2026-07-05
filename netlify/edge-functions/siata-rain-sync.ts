import {
  fetchGeoportalRain30d,
  parseGeoportalRainResponse,
  URRAO_STATION_CODE,
  type GeoportalRainDailyRow,
  type GeoportalStationMetadata,
} from "./lib/geoportal-rain.ts"
import {
  fetchSiataRainLayer,
  getUrraoSensor,
  parseSiataLayerMonthlyRows,
} from "./lib/siata-fetch.ts"
import {
  logError,
  logInfo,
  logWarn,
  serializeError,
  timedStep,
} from "./lib/logger.ts"

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
    throw new Error(
      `Station upsert failed: HTTP ${response.status} ${text.slice(0, 300)}`
    )
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
  if (!sensor) {
    logWarn("SIATA layer returned no Urrao sensor", { stationCode, calendarYear })
    return 0
  }

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

  if (rows.length === 0) {
    logWarn("No monthly rows parsed for station", { stationCode, calendarYear })
    return 0
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/siata_rain_monthly`, {
    method: "POST",
    headers: supabaseHeaders(serviceRoleKey),
    body: JSON.stringify(rows),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Monthly upsert failed: HTTP ${response.status} ${text.slice(0, 300)}`
    )
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
    throw new Error(
      `Daily upsert failed: HTTP ${response.status} ${text.slice(0, 300)}`
    )
  }
}

export default async (request: Request): Promise<Response> => {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startedAt = Date.now()

  if (request.method !== "POST" && request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405)
  }

  const env = getEnv()

  if (env.CRON_SECRET) {
    const auth = request.headers.get("Authorization")
    if (auth !== `Bearer ${env.CRON_SECRET}`) {
      logWarn("Unauthorized sync request", { requestId, method: request.method })
      return unauthorized()
    }
  }

  try {
    assertEnv(env)

    const url = new URL(request.url)
    const stationCode = url.searchParams.get("station") ?? URRAO_STATION_CODE

    logInfo("Sync request received", {
      requestId,
      method: request.method,
      stationCode,
      supabaseHost: new URL(env.SUPABASE_URL).host,
    })

    const raw = await timedStep(
      "Fetch Geoportal pluvio_30d",
      () => fetchGeoportalRain30d(stationCode),
      { requestId, stationCode }
    )

    const { station, daily } = parseGeoportalRainResponse(raw, stationCode)

    if (daily.length === 0) {
      throw new Error(`No daily rows parsed for station ${stationCode}`)
    }

    logInfo("Parsed Geoportal daily rows", {
      requestId,
      stationCode: station.stationCode,
      stationName: station.stationName,
      rowCount: daily.length,
    })

    await timedStep(
      "Upsert station metadata",
      () =>
        upsertStation(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, station),
      { requestId, stationCode: station.stationCode }
    )

    await timedStep(
      "Upsert daily rows",
      () =>
        upsertDailyRows(
          env.SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
          station.stationCode,
          daily
        ),
      { requestId, stationCode: station.stationCode, rowCount: daily.length }
    )

    const calendarYear = new Date().getFullYear()
    let monthlyRowsUpserted = 0

    try {
      monthlyRowsUpserted = await timedStep(
        "Fetch SIATA layer + upsert monthly rows",
        () =>
          upsertMonthlyRows(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_ROLE_KEY,
            station.stationCode,
            calendarYear
          ),
        { requestId, stationCode: station.stationCode, calendarYear }
      )
    } catch (monthlyError) {
      logWarn("Monthly sync skipped after failure", {
        requestId,
        stationCode: station.stationCode,
        calendarYear,
        ...serializeError(monthlyError),
      })
    }

    const dates = daily.map((row) => row.rainDate).sort()
    const result = {
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
    }

    logInfo("Sync completed", {
      requestId,
      durationMs: Date.now() - startedAt,
      ...result,
    })

    return jsonResponse(result)
  } catch (error) {
    logError("Sync failed", error, {
      requestId,
      durationMs: Date.now() - startedAt,
    })

    const message = error instanceof Error ? error.message : "Sync failed"
    return jsonResponse({ ok: false, error: message, requestId }, 500)
  }
}
