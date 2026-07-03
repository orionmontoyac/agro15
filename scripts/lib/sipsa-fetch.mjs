export const SIPSA_BASE_URL =
  process.env.SIPSA_BASE_URL ??
  'https://sen.dane.gov.co/variacionPrecioMayoristaSipsa_ws/rest/SipsaServices'

export const SIPSA_DEFAULT_TIMEOUT_MS = Number(
  process.env.SIPSA_FETCH_TIMEOUT_MS ?? 60_000
)

const SIPSA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
  'Content-Type': 'application/json',
  Connection: 'keep-alive',
  Origin: 'https://sen.dane.gov.co',
  Referer:
    'https://sen.dane.gov.co/variacionPrecioMayoristaSipsa_Client/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
}

function formatFetchError(error, url) {
  if (!(error instanceof Error)) {
    return new Error(`SIPSA request failed for ${url}`)
  }

  const cause = error.cause
  const causeMessage =
    cause instanceof Error
      ? cause.message
      : cause != null
        ? String(cause)
        : null

  if (error.name === 'AbortError') {
    return new Error(
      `SIPSA request timed out for ${url} (${SIPSA_DEFAULT_TIMEOUT_MS}ms).`
    )
  }

  return new Error(
    `${error.message}${causeMessage ? ` (${causeMessage})` : ''}`
  )
}

export async function sipsaFetch(path, options = {}) {
  const url = `${SIPSA_BASE_URL}${path}`
  const timeoutMs = options.timeoutMs ?? SIPSA_DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: options.method ?? 'GET',
      headers: SIPSA_HEADERS,
      body: options.body,
      cache: 'no-store',
      signal: controller.signal,
    })
  } catch (error) {
    throw formatFetchError(error, url)
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sipsaFetchJson(path, options = {}) {
  const response = await sipsaFetch(path, options)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `SIPSA API error ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
    )
  }

  return response.json()
}

async function sipsaFetchJsonWithRetry(path, maxRetries = 1) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
    }

    try {
      return await sipsaFetchJson(path)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  throw lastError ?? new Error(`SIPSA fetch failed for ${path}`)
}

export async function fetchSipsaDepartments() {
  const rows = await sipsaFetchJson('/selectAllDptos/')
  if (!Array.isArray(rows)) return []

  return rows.map((row) => ({
    department_code: row.DEP_COD,
    department_name: row.DEP_NOM,
  }))
}

export async function fetchSipsaMunicipalitiesByDepartment(departmentCode) {
  const rows = await sipsaFetchJson(
    `/selectAllCitiesByDpto/${departmentCode}`
  )
  if (!Array.isArray(rows)) return []

  return rows.map((row) => ({
    municipality_code: row.COD_MUN,
    municipality_name: row.NOM_MUN,
  }))
}

export async function fetchSipsaProductsByCity(municipalityCode) {
  const rows = await sipsaFetchJsonWithRetry(
    `/selectAllProductsByCity/${municipalityCode}`,
    1
  )
  if (!Array.isArray(rows)) return []

  return rows.map((row) => ({
    product_code: row.COD_ART,
    product_name: row.NOM_ART,
  }))
}

export function formatApiDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

export function buildArchivoCsv(
  departmentCode,
  municipalityCode,
  productCode
) {
  return `${departmentCode}${municipalityCode}${productCode}`
}

export const SIPSA_PRICE_FIELDS = {
  average: 'PROM_DIARIO',
  min: 'VAL_MIN',
  max: 'VAL_MAX',
  variation: 'VAR_DIARIA',
  marketName: 'NOM_ABASTO',
  date: 'Date',
}

export async function fetchSipsaProductPrices(
  {
    departmentCode,
    municipalityCode,
    productCode,
    startDate,
    endDate,
    reportType = 'day',
  },
  maxRetries = 3
) {
  const payload = {
    depcod: departmentCode,
    codmun: municipalityCode,
    codart: productCode,
    archivoCsv: buildArchivoCsv(
      departmentCode,
      municipalityCode,
      productCode
    ),
    fechaIni: startDate,
    fechaFin: endDate,
    tipoReporte: reportType,
  }

  let lastError = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
    }

    try {
      const response = await sipsaFetch('/selectAllInfoProduct/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        throw new Error(
          `SIPSA API error ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
        )
      }

      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('SIPSA fetch failed')
    }
  }

  throw lastError ?? new Error('SIPSA fetch failed')
}
