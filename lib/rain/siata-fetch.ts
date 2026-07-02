export const SIATA_RAIN_LAYER_URL =
  "https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga"

export const SIATA_RAIN_LAYER_ID = "C_00000000000000000000210"

export const SIATA_DEFAULT_TIMEOUT_MS = 120_000

export const URRAO_MUNICIPALITY = "Urrao"

export const URRAO_STATION_CODE = "641"

export const SIATA_30D_RAIN_URL = `https://geoportal.siata.gov.co/fastgeoapi/geodata/geographJson/2/pluvio_30d/${URRAO_STATION_CODE}`

const SIATA_GEO_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "es-CO,es;q=0.9",
}

export type Siata30DayRainResponse = {
  info?: {
    NombreEstacion?: string
    Codigo?: string
    Ciudad?: string
    Tiempo?: string[]
    pluvio_1?: number[]
  }
}

const SIATA_HEADERS = {
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  Origin: "https://siata.gov.co",
  Referer: "https://siata.gov.co/siata_nuevo/",
  "X-Requested-With": "XMLHttpRequest",
}

type SiataAttributeValue = {
  valor_alfanumerico?: string
}

type SiataFeature = {
  atributos?: {
    descripcion?: Record<string, SiataAttributeValue>
    serie_mensual?: Record<string, SiataAttributeValue>
  }
}

export type SiataRainLayerResponse = {
  feature_vector?: SiataFeature[]
}

function formatFetchError(error: unknown, url: string): Error {
  if (!(error instanceof Error)) {
    return new Error(`SIATA request failed for ${url}`)
  }

  if (error.name === "AbortError") {
    return new Error(
      `SIATA request timed out for ${url} (${SIATA_DEFAULT_TIMEOUT_MS}ms).`
    )
  }

  return error
}

export function parseMm(value: string): number {
  const numericString = value.replace(/\s*mm\s*$/i, "").trim()
  const parsed = Number.parseFloat(numericString)
  return Number.isFinite(parsed) ? parsed : 0
}

export function findUrraoSensorIndex(
  featureVector: SiataFeature[] | undefined
): number | null {
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

export async function fetchSiataRainLayer(): Promise<SiataRainLayerResponse | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    SIATA_DEFAULT_TIMEOUT_MS
  )

  try {
    const response = await fetch(SIATA_RAIN_LAYER_URL, {
      method: "POST",
      headers: SIATA_HEADERS,
      body: `id_capa=${SIATA_RAIN_LAYER_ID}`,
      signal: controller.signal,
      next: { revalidate: 300 },
    })

    if (!response.ok) {
      throw new Error(`SIATA API error ${response.status}`)
    }

    return (await response.json()) as SiataRainLayerResponse
  } catch (error) {
    throw formatFetchError(error, SIATA_RAIN_LAYER_URL)
  } finally {
    clearTimeout(timeoutId)
  }
}

export function getUrraoSensor(
  data: SiataRainLayerResponse
): SiataFeature | null {
  const index = findUrraoSensorIndex(data.feature_vector)
  if (index == null || !data.feature_vector) return null
  return data.feature_vector[index] ?? null
}

export async function fetchSiata30DayRain(): Promise<Siata30DayRainResponse | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    SIATA_DEFAULT_TIMEOUT_MS
  )

  try {
    const response = await fetch(SIATA_30D_RAIN_URL, {
      headers: SIATA_GEO_HEADERS,
      signal: controller.signal,
      next: { revalidate: 3600 },
    })

    if (!response.ok) {
      throw new Error(`SIATA geoportal API error ${response.status}`)
    }

    return (await response.json()) as Siata30DayRainResponse
  } catch (error) {
    throw formatFetchError(error, SIATA_30D_RAIN_URL)
  } finally {
    clearTimeout(timeoutId)
  }
}
