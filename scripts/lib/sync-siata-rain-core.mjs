import { createSupabaseAdmin } from './supabase-admin.mjs'

export const SIATA_GEOPORTAL_BASE =
  'https://geoportal.siata.gov.co/fastgeoapi/geodata/geographJson/2/pluvio_30d'

export const URRAO_STATION_CODE = '641'

export const SIATA_RAIN_LAYER_URL =
  'https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga'

export const SIATA_RAIN_LAYER_ID = 'C_00000000000000000000210'

export const URRAO_MUNICIPALITY = 'Urrao'

const DEFAULT_TIMEOUT_MS = 60_000

const SIATA_LAYER_HEADERS = {
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Origin: 'https://siata.gov.co',
  Referer: 'https://siata.gov.co/siata_nuevo/',
  'X-Requested-With': 'XMLHttpRequest',
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

  for (let i = 0; i < info.Tiempo.length; i++) {
    const rainDate = parseGeoportalDate(info.Tiempo[i] ?? '')
    if (!rainDate) continue

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
      throw new Error(`SIATA layer API error ${response.status}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`SIATA layer request timed out (${DEFAULT_TIMEOUT_MS}ms)`)
    }
    throw error
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
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Geoportal API error ${response.status} for ${url}`)
    }

    return response.json()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Geoportal request timed out (${DEFAULT_TIMEOUT_MS}ms)`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function syncSiataRain({
  supabase,
  stationCode = URRAO_STATION_CODE,
  log = () => {},
}) {
  log(`Fetching Geoportal pluvio_30d for station ${stationCode}…`)
  const raw = await fetchGeoportalRain30d(stationCode)
  const { station, daily } = parseGeoportalRainResponse(raw, stationCode)

  if (daily.length === 0) {
    throw new Error(`No daily rows parsed for station ${stationCode}`)
  }

  const { error: stationError } = await supabase
    .from('siata_rain_stations')
    .upsert(station, { onConflict: 'station_code' })

  if (stationError) {
    throw new Error(`Station upsert failed: ${stationError.message}`)
  }

  const { error: dailyError } = await supabase
    .from('siata_rain_daily')
    .upsert(daily, { onConflict: 'station_code,rain_date' })

  if (dailyError) {
    throw new Error(`Daily upsert failed: ${dailyError.message}`)
  }

  const dates = daily.map((row) => row.rain_date).sort()
  const dateRange = {
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
  }

  log(`Upserted ${daily.length} daily rows for ${station.station_name}`)

  let monthlyRows = []
  const calendarYear = new Date().getFullYear()

  try {
    log('Fetching SIATA capa_service monthly series…')
    const layer = await fetchSiataRainLayer()
    const urraoIndex = findUrraoSensorIndex(layer?.feature_vector)
    const sensor =
      urraoIndex != null ? layer.feature_vector[urraoIndex] : null
    monthlyRows = parseSiataLayerMonthlyRows(sensor, calendarYear).filter(
      (row) => row.station_code === station.station_code
    )

    if (monthlyRows.length > 0) {
      const { error: monthlyError } = await supabase
        .from('siata_rain_monthly')
        .upsert(monthlyRows, {
          onConflict: 'station_code,calendar_year,month',
        })

      if (monthlyError) {
        throw new Error(`Monthly upsert failed: ${monthlyError.message}`)
      }

      log(
        `Upserted ${monthlyRows.length} monthly rows for ${calendarYear}`
      )
    } else {
      log('No monthly rows parsed from SIATA layer')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`Monthly sync warning: ${message}`)
    monthlyRows = []
  }

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
