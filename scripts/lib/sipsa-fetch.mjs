export const SIPSA_BASE_URL =
  process.env.SIPSA_BASE_URL ??
  'https://sen.dane.gov.co/variacionPrecioMayoristaSipsa_ws/rest/SipsaServices'

export const SIPSA_DEFAULT_TIMEOUT_MS = Number(
  process.env.SIPSA_FETCH_TIMEOUT_MS ?? 60_000
)

export const SIPSA_DEFAULT_RETRIES = Number(
  process.env.SIPSA_FETCH_RETRIES ?? 4
)

const SIPSA_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
  'Content-Type': 'application/json',
  // Flaky SIPSA host; avoid reuse of half-closed keep-alive sockets.
  Connection: 'close',
  Origin: 'https://sen.dane.gov.co',
  Referer:
    'https://sen.dane.gov.co/variacionPrecioMayoristaSipsa_Client/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
}

function causeChain(error) {
  const parts = []
  let current = error
  let depth = 0

  while (current != null && depth < 5) {
    if (current instanceof Error) {
      if (current.code) parts.push(String(current.code))
      if (current.message) parts.push(current.message)
      current = current.cause
    } else {
      parts.push(String(current))
      break
    }
    depth += 1
  }

  return parts.join(' | ')
}

export function isRetryableSipsaError(error) {
  if (!(error instanceof Error)) return false
  if (error.name === 'AbortError') return true

  const text = causeChain(error).toLowerCase()
  return (
    text.includes('fetch failed') ||
    text.includes('other side closed') ||
    text.includes('socket hang up') ||
    text.includes('econnreset') ||
    text.includes('econnrefused') ||
    text.includes('enotfound') ||
    text.includes('etimedout') ||
    text.includes('und_err_socket') ||
    text.includes('und_err_connect_timeout') ||
    text.includes('empty reply') ||
    text.includes('network') ||
    /\b5\d\d\b/.test(text)
  )
}

function formatFetchError(error, url) {
  if (!(error instanceof Error)) {
    return new Error(`SIPSA request failed for ${url}`)
  }

  if (error.name === 'AbortError') {
    return new Error(
      `SIPSA request timed out for ${url} (${SIPSA_DEFAULT_TIMEOUT_MS}ms).`
    )
  }

  const detail = causeChain(error)
  const unreachable =
    /other side closed|socket hang up|econnreset|und_err_socket|empty reply/i.test(
      detail
    )

  if (unreachable) {
    const isCatalogEndpoint =
      /\/selectAllDptos\/|\/selectAllCitiesByDpto\/|\/selectAllProductsByCity\//.test(
        url
      )
    return new Error(
      `SIPSA host unreachable (${url}): connection closed by remote. ` +
        `sen.dane.gov.co may be down — retry later` +
        (isCatalogEndpoint
          ? ', or seed local catalog with: npm run sync:sipsa-catalog -- --offline'
          : '') +
        `. Details: ${detail}`
    )
  }

  return new Error(detail || error.message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt) {
  const base = 1000 * 2 ** attempt
  const jitter = Math.floor(Math.random() * 400)
  return Math.min(base + jitter, 15_000)
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

export async function sipsaFetchJsonWithRetry(
  path,
  maxRetries = SIPSA_DEFAULT_RETRIES,
  options = {}
) {
  let lastError = null
  const attempts = Math.max(1, maxRetries + 1)

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1)
      console.warn(
        `  SIPSA retry ${attempt}/${maxRetries} for ${path} in ${delay}ms...`
      )
      await sleep(delay)
    }

    try {
      return await sipsaFetchJson(path, options)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (!isRetryableSipsaError(lastError) || attempt === attempts - 1) {
        throw lastError
      }
    }
  }

  throw lastError ?? new Error(`SIPSA fetch failed for ${path}`)
}

export async function fetchSipsaDepartments() {
  const rows = await sipsaFetchJsonWithRetry('/selectAllDptos/')
  if (!Array.isArray(rows)) return []

  return rows.map((row) => ({
    department_code: row.DEP_COD,
    department_name: row.DEP_NOM,
  }))
}

export async function fetchSipsaMunicipalitiesByDepartment(departmentCode) {
  const rows = await sipsaFetchJsonWithRetry(
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
    `/selectAllProductsByCity/${municipalityCode}`
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
  maxRetries = SIPSA_DEFAULT_RETRIES
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
  const attempts = Math.max(1, maxRetries)

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1)
      console.warn(
        `  SIPSA price retry ${attempt}/${attempts - 1} in ${delay}ms...`
      )
      await sleep(delay)
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
      lastError =
        error instanceof Error ? error : new Error('SIPSA fetch failed')
      if (!isRetryableSipsaError(lastError) || attempt === attempts - 1) {
        throw lastError
      }
    }
  }

  throw lastError ?? new Error('SIPSA fetch failed')
}
