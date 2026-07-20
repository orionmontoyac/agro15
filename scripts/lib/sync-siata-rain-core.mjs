import { createSupabaseAdmin } from './supabase-admin.mjs'

export const SIATA_GEOPORTAL_BASE =
  'https://geoportal.siata.gov.co/fastgeoapi/geodata/geographJson/2/pluvio_30d'

export const URRAO_STATION_CODE = '641'

export const SIATA_RAIN_LAYER_URL =
  'https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga'

export const SIATA_RAIN_LAYER_ID = 'C_00000000000000000000210'

export const URRAO_MUNICIPALITY = 'Urrao'

const DEFAULT_TIMEOUT_MS = 60_000

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const GEOPORTAL_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Origin: 'https://geoportal.siata.gov.co',
  Referer: 'https://geoportal.siata.gov.co/',
  'User-Agent': BROWSER_USER_AGENT,
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  Connection: 'keep-alive',
}

const SIATA_LAYER_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Origin: 'https://siata.gov.co',
  Referer: 'https://siata.gov.co/siata_nuevo/',
  'User-Agent': BROWSER_USER_AGENT,
  'X-Requested-With': 'XMLHttpRequest',
  Connection: 'keep-alive',
}

function formatFetchError(error, context, url) {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Error(`${context} timed out after ${DEFAULT_TIMEOUT_MS}ms (url=${url})`)
  }

  if (!(error instanceof Error)) {
    return new Error(`${context} failed (url=${url}): ${String(error)}`)
  }

  const cause =
    error.cause instanceof Error
      ? `${error.cause.name}: ${error.cause.message}`
      : error.cause != null
        ? String(error.cause)
        : null

  const detail = cause
    ? `${error.name}: ${error.message}; cause=${cause}`
    : `${error.name}: ${error.message}`

  return new Error(`${context} failed (url=${url}): ${detail}`)
}

function logStep(log, level, message, meta = {}) {
  const payload = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
  if (level === 'error') {
    console.error(`[sync-siata-rain] ${message}${payload}`)
    return
  }
  if (level === 'warn') {
    console.warn(`[sync-siata-rain] ${message}${payload}`)
    return
  }
  log(`[sync-siata-rain] ${message}${payload}`)
}

async function timedStep(log, label, run, meta = {}) {
  const startedAt = Date.now()
  logStep(log, 'info', `${label} — start`, meta)

  try {
    const result = await run()
    logStep(log, 'info', `${label} — ok`, {
      ...meta,
      durationMs: Date.now() - startedAt,
    })
    return result
  } catch (error) {
    const wrapped =
      error instanceof Error ? error : new Error(String(error))
    logStep(log, 'error', `${label} — failed`, {
      ...meta,
      durationMs: Date.now() - startedAt,
      errorName: wrapped.name,
      errorMessage: wrapped.message,
      cause:
        wrapped.cause instanceof Error
          ? wrapped.cause.message
          : wrapped.cause != null
            ? String(wrapped.cause)
            : undefined,
      stack: wrapped.stack?.split('\n').slice(0, 4).join(' | '),
    })
    throw wrapped
  }
}

const MONTH_KEY_MAP = {
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

function buildGeoportalRainUrl(stationCode) {
  return `${SIATA_GEOPORTAL_BASE}/${stationCode}`
}

function parseGeoportalDate(value) {
  const datePart = String(value).trim().split(/\s+/)[0]
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  return datePart
}

function getBogotaDateIso(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
  }).format(date)
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function extractStationMetadata(info, stationCode) {
  const lat = info.Latitud ? Number.parseFloat(info.Latitud) : null
  const lng = info.Longitud ? Number.parseFloat(info.Longitud) : null

  return {
    station_code: info.Codigo ?? stationCode,
    station_name: info.NombreEstacion ?? `Estación ${stationCode}`,
    city: info.Ciudad ?? null,
    latitude: lat != null && Number.isFinite(lat) ? lat : null,
    longitude: lng != null && Number.isFinite(lng) ? lng : null,
    subcuenca: info.Subcuenca ?? null,
    updated_at: new Date().toISOString(),
  }
}

function parseGeoportalRainResponse(data, stationCode) {
  const info = data?.info
  if (!info?.Tiempo?.length) {
    throw new Error(`Geoportal response missing Tiempo for station ${stationCode}`)
  }

  const station = extractStationMetadata(info, stationCode)
  const daily = []
  const fetchedAt = new Date().toISOString()
  // SIATA sometimes opens tomorrow's bucket; store Bogotá calendar dates only.
  const bogotaToday = getBogotaDateIso()

  for (let i = 0; i < info.Tiempo.length; i++) {
    const rainDate = parseGeoportalDate(info.Tiempo[i] ?? '')
    if (!rainDate || rainDate > bogotaToday) continue

    const rainMmPluvio1 = toNumber(info.pluvio_1?.[i])
    const rainMmPluvio2 = toNumber(info.pluvio_2?.[i])

    daily.push({
      station_code: station.station_code,
      rain_date: rainDate,
      rain_mm_pluvio_1: rainMmPluvio1,
      rain_mm_pluvio_2: rainMmPluvio2,
      rain_mm_avg: (rainMmPluvio1 + rainMmPluvio2) / 2,
      acum_pluvio_1: toNumber(info.acum_pluvio_1?.[i]),
      acum_pluvio_2: toNumber(info.acum_pluvio_2?.[i]),
      data_coverage_pct: toNumber(info.Porcentaje_Datos?.[i]),
      fetched_at: fetchedAt,
    })
  }

  return { station, daily }
}

function parseMm(value) {
  const numericString = String(value).replace(/\s*mm\s*$/i, '').trim()
  const parsed = Number.parseFloat(numericString)
  return Number.isFinite(parsed) ? parsed : 0
}

function findUrraoSensorIndex(featureVector) {
  if (!featureVector) return null

  for (let i = 0; i < featureVector.length; i++) {
    const municipality =
      featureVector[i]?.atributos?.descripcion?.Municipio?.valor_alfanumerico
    if (municipality?.includes(URRAO_MUNICIPALITY)) {
      return i
    }
  }

  return null
}

function parseSiataLayerMonthlyRows(sensor, calendarYear = new Date().getFullYear()) {
  const serieMensual = sensor?.atributos?.serie_mensual
  if (!serieMensual) return []

  const stationCode =
    sensor?.atributos?.descripcion?.Codigo?.valor_alfanumerico ?? null
  if (!stationCode) return []

  const rows = []
  const fetchedAt = new Date().toISOString()

  for (const [key, value] of Object.entries(serieMensual)) {
    if (!key.startsWith('P_ACUM_')) continue
    const month = MONTH_KEY_MAP[key]
    if (!month) continue

    rows.push({
      station_code: stationCode,
      calendar_year: calendarYear,
      month,
      rain_mm: parseMm(value.valor_alfanumerico ?? '0'),
      fetched_at: fetchedAt,
    })
  }

  return rows.sort((a, b) => a.month - b.month)
}

export async function fetchSiataRainLayer() {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(SIATA_RAIN_LAYER_URL, {
      method: 'POST',
      headers: SIATA_LAYER_HEADERS,
      body: `id_capa=${SIATA_RAIN_LAYER_ID}`,
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      const bodyPreview = (await response.text()).slice(0, 200)
      throw new Error(`SIATA layer HTTP ${response.status} body=${bodyPreview}`)
    }

    return response.json()
  } catch (error) {
    throw formatFetchError(error, 'SIATA capa_service fetch', SIATA_RAIN_LAYER_URL)
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchGeoportalRain30d(stationCode = URRAO_STATION_CODE) {
  const url = buildGeoportalRainUrl(stationCode)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: GEOPORTAL_HEADERS,
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      const bodyPreview = (await response.text()).slice(0, 200)
      throw new Error(`Geoportal HTTP ${response.status} for ${url} body=${bodyPreview}`)
    }

    return response.json()
  } catch (error) {
    throw formatFetchError(error, 'Geoportal pluvio_30d fetch', url)
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function syncSiataRain({
  supabase,
  stationCode = URRAO_STATION_CODE,
  log = () => {},
}) {
  const raw = await timedStep(
    log,
    'Fetch Geoportal pluvio_30d',
    () => fetchGeoportalRain30d(stationCode),
    { stationCode }
  )
  const { station, daily } = parseGeoportalRainResponse(raw, stationCode)

  if (daily.length === 0) {
    throw new Error(`No daily rows parsed for station ${stationCode}`)
  }

  logStep(log, 'info', 'Parsed Geoportal daily rows', {
    stationCode: station.station_code,
    stationName: station.station_name,
    rowCount: daily.length,
  })

  await timedStep(
    log,
    'Upsert station metadata',
    async () => {
      const { error: stationError } = await supabase
        .from('siata_rain_stations')
        .upsert(station, { onConflict: 'station_code' })

      if (stationError) {
        throw new Error(`Station upsert failed: ${stationError.message}`)
      }
    },
    { stationCode: station.station_code }
  )

  await timedStep(
    log,
    'Upsert daily rows',
    async () => {
      const { error: dailyError } = await supabase
        .from('siata_rain_daily')
        .upsert(daily, { onConflict: 'station_code,rain_date' })

      if (dailyError) {
        throw new Error(`Daily upsert failed: ${dailyError.message}`)
      }
    },
    { stationCode: station.station_code, rowCount: daily.length }
  )

  const dates = daily.map((row) => row.rain_date).sort()
  const dateRange = {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  }

  let monthlyRows = []
  const calendarYear = new Date().getFullYear()

  try {
    monthlyRows = await timedStep(
      log,
      'Fetch SIATA capa_service monthly series',
      async () => {
        const layer = await fetchSiataRainLayer()
        const urraoIndex = findUrraoSensorIndex(layer?.feature_vector)
        const sensor =
          urraoIndex != null ? layer.feature_vector[urraoIndex] : null
        const rows = parseSiataLayerMonthlyRows(sensor, calendarYear).filter(
          (row) => row.station_code === station.station_code
        )

        if (rows.length === 0) {
          logStep(log, 'warn', 'No monthly rows parsed from SIATA layer', {
            stationCode: station.station_code,
            calendarYear,
          })
          return rows
        }

        const { error: monthlyError } = await supabase
          .from('siata_rain_monthly')
          .upsert(rows, {
            onConflict: 'station_code,calendar_year,month',
          })

        if (monthlyError) {
          throw new Error(`Monthly upsert failed: ${monthlyError.message}`)
        }

        return rows
      },
      { stationCode: station.station_code, calendarYear }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logStep(log, 'warn', `Monthly sync skipped: ${message}`, {
      stationCode: station.station_code,
      calendarYear,
    })
    monthlyRows = []
  }

  logStep(log, 'info', 'Sync completed', {
    stationCode: station.station_code,
    stationName: station.station_name,
    rowsUpserted: daily.length,
    monthlyRowsUpserted: monthlyRows.length,
    calendarYear,
    dateRange,
  })

  return {
    ok: true,
    rowsUpserted: daily.length,
    monthlyRowsUpserted: monthlyRows.length,
    calendarYear,
    stationCode: station.station_code,
    stationName: station.station_name,
    dateRange,
  }
}
