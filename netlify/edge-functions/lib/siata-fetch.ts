/** Deno/Edge copy — keep in sync with lib/rain/siata-fetch.ts */

export const SIATA_RAIN_LAYER_URL =
  "https://siata.gov.co/siata_nuevo/index.php/capa_service/consultar_capa_carga"

export const SIATA_RAIN_LAYER_ID = "C_00000000000000000000210"

export const SIATA_DEFAULT_TIMEOUT_MS = 120_000

export const URRAO_MUNICIPALITY = "Urrao"

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

export type SiataLayerMonthlyRow = {
  stationCode: string
  calendarYear: number
  month: number
  rainMm: number
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
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error(`SIATA API error ${response.status}`)
    }

    return (await response.json()) as SiataRainLayerResponse
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `SIATA request timed out for ${SIATA_RAIN_LAYER_URL} (${SIATA_DEFAULT_TIMEOUT_MS}ms).`
      )
    }
    throw error
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

export function parseSiataLayerMonthlyRows(
  sensor: SiataFeature,
  calendarYear: number = new Date().getFullYear()
): SiataLayerMonthlyRow[] {
  const serieMensual = sensor.atributos?.serie_mensual
  if (!serieMensual) return []

  const stationCode =
    sensor.atributos?.descripcion?.Codigo?.valor_alfanumerico ?? null

  if (!stationCode) return []

  const rows: SiataLayerMonthlyRow[] = []

  for (const [key, value] of Object.entries(serieMensual)) {
    if (!key.startsWith("P_ACUM_")) continue
    const month = MONTH_KEY_MAP[key]
    if (!month) continue

    rows.push({
      stationCode,
      calendarYear,
      month,
      rainMm: parseMm(value.valor_alfanumerico ?? "0"),
    })
  }

  return rows.sort((a, b) => a.month - b.month)
}
