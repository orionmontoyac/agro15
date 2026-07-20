/** Deno/Edge copy — keep in sync with lib/rain/geoportal-rain.ts */

import { geoportalRainHeaders } from "./siata-http-headers.ts"

export const SIATA_GEOPORTAL_BASE =
  "https://geoportal.siata.gov.co/fastgeoapi/geodata/geographJson/2/pluvio_30d"

export const URRAO_STATION_CODE = "641"

export const GEOPORTAL_DEFAULT_TIMEOUT_MS = 60_000

export type GeoportalRainInfo = {
  NombreEstacion?: string
  Codigo?: string
  Tiempo?: string[]
  pluvio_1?: number[]
  pluvio_2?: number[]
  acum_pluvio_1?: number[]
  acum_pluvio_2?: number[]
  Porcentaje_Datos?: number[]
  Ciudad?: string
  Latitud?: string
  Longitud?: string
  Subcuenca?: string
}

export type GeoportalRainResponse = {
  info?: GeoportalRainInfo
}

export type GeoportalRainDailyRow = {
  rainDate: string
  rainMmPluvio1: number
  rainMmPluvio2: number
  rainMmAvg: number
  acumPluvio1: number
  acumPluvio2: number
  dataCoveragePct: number
}

export type GeoportalStationMetadata = {
  stationCode: string
  stationName: string
  city: string | null
  latitude: number | null
  longitude: number | null
  subcuenca: string | null
}

function parseGeoportalDate(value: string): string | null {
  const datePart = value.trim().split(/\s+/)[0]
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null
  return datePart
}

function getBogotaDateIso(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
  }).format(date)
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function buildGeoportalRainUrl(stationCode: string): string {
  return `${SIATA_GEOPORTAL_BASE}/${stationCode}`
}

export function extractStationMetadata(
  info: GeoportalRainInfo,
  stationCode: string
): GeoportalStationMetadata {
  const lat = info.Latitud ? Number.parseFloat(info.Latitud) : null
  const lng = info.Longitud ? Number.parseFloat(info.Longitud) : null

  return {
    stationCode: info.Codigo ?? stationCode,
    stationName: info.NombreEstacion ?? `Estación ${stationCode}`,
    city: info.Ciudad ?? null,
    latitude: lat != null && Number.isFinite(lat) ? lat : null,
    longitude: lng != null && Number.isFinite(lng) ? lng : null,
    subcuenca: info.Subcuenca ?? null,
  }
}

export function parseGeoportalRainResponse(
  data: GeoportalRainResponse,
  stationCode: string
): {
  station: GeoportalStationMetadata
  daily: GeoportalRainDailyRow[]
} {
  const info = data.info
  if (!info?.Tiempo?.length) {
    throw new Error(`Geoportal response missing Tiempo for station ${stationCode}`)
  }

  const station = extractStationMetadata(info, stationCode)
  const daily: GeoportalRainDailyRow[] = []
  // SIATA sometimes opens tomorrow's bucket; store Bogotá calendar dates only.
  const bogotaToday = getBogotaDateIso()

  for (let i = 0; i < info.Tiempo.length; i++) {
    const rainDate = parseGeoportalDate(info.Tiempo[i] ?? "")
    if (!rainDate || rainDate > bogotaToday) continue

    const rainMmPluvio1 = toNumber(info.pluvio_1?.[i])
    const rainMmPluvio2 = toNumber(info.pluvio_2?.[i])

    daily.push({
      rainDate,
      rainMmPluvio1,
      rainMmPluvio2,
      rainMmAvg: (rainMmPluvio1 + rainMmPluvio2) / 2,
      acumPluvio1: toNumber(info.acum_pluvio_1?.[i]),
      acumPluvio2: toNumber(info.acum_pluvio_2?.[i]),
      dataCoveragePct: toNumber(info.Porcentaje_Datos?.[i]),
    })
  }

  return { station, daily }
}

function formatFetchError(
  error: unknown,
  context: string,
  url: string,
  timeoutMs: number
): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(
      `${context} timed out after ${timeoutMs}ms (url=${url})`
    )
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

export async function fetchGeoportalRain30d(
  stationCode: string = URRAO_STATION_CODE
): Promise<GeoportalRainResponse> {
  const url = buildGeoportalRainUrl(stationCode)
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    GEOPORTAL_DEFAULT_TIMEOUT_MS
  )

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: geoportalRainHeaders(),
      signal: controller.signal,
      cache: "no-store",
    })

    if (!response.ok) {
      const bodyPreview = (await response.text()).slice(0, 200)
      throw new Error(
        `Geoportal HTTP ${response.status} for ${url} body=${bodyPreview}`
      )
    }

    return (await response.json()) as GeoportalRainResponse
  } catch (error) {
    throw formatFetchError(error, "Geoportal pluvio_30d fetch", url, GEOPORTAL_DEFAULT_TIMEOUT_MS)
  } finally {
    clearTimeout(timeoutId)
  }
}
