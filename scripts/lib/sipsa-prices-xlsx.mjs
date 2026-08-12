import * as XLSX from 'xlsx'

export const DANE_PRICES_PAGE_URL =
  process.env.DANE_PRICES_PAGE_URL ??
  'https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-precios-mayoristas'

export const DANE_ANEX_BASE_URL =
  process.env.DANE_ANEX_BASE_URL ??
  'https://www.dane.gov.co/files/operaciones/SIPSA'

/** Exact bulletin product name → SIPSA product_code (no fuzzy variants). */
export const EXCEL_PRODUCT_CODE_BY_NAME = {
  Granadilla: '106',
  Lulo: '116',
  'Tomate de árbol': '148',
}

export const EXCEL_PRODUCT_NAME_BY_CODE = Object.fromEntries(
  Object.entries(EXCEL_PRODUCT_CODE_BY_NAME).map(([name, code]) => [code, name])
)

const SPANISH_MONTH_ABBR = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

const SPANISH_MONTH_NAME_TO_NUM = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

const DANE_HEADERS = {
  Accept: '*/*',
  'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8',
  Referer: 'https://www.dane.gov.co/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
}

export function isExcelSupportedProduct(productCode) {
  return Boolean(EXCEL_PRODUCT_NAME_BY_CODE[String(productCode)])
}

export function buildAnexFilename(dateIso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso)
  if (!match) {
    throw new Error(`Invalid ISO date: ${dateIso}`)
  }

  const year = match[1]
  const month = Number(match[2])
  const day = match[3]
  const abbr = SPANISH_MONTH_ABBR[month - 1]
  if (!abbr) {
    throw new Error(`Invalid month in date: ${dateIso}`)
  }

  return `anex-SIPSADiario-${day}${abbr}${year}.xlsx`
}

export function buildAnexUrl(dateIso) {
  return `${DANE_ANEX_BASE_URL}/${buildAnexFilename(dateIso)}`
}

function normalizeCell(value) {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function normalizeProductName(value) {
  return normalizeCell(value).replace(/\*+$/, '').trim()
}

function sheetToMatrix(workbook) {
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: null,
  })
}

export function parseSpanishBulletinDate(text) {
  const normalized = normalizeCell(text).toLowerCase()
  const match = normalized.match(
    /(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/i
  )
  if (!match) return null

  const day = Number(match[1])
  const month = SPANISH_MONTH_NAME_TO_NUM[match[2]]
  const year = Number(match[3])
  if (!month || !Number.isFinite(day) || !Number.isFinite(year)) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function findHeaderRows(matrix) {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const row = matrix[i] ?? []
    const joined = row.map(normalizeCell).join(' ').toLowerCase()
    if (
      joined.includes('medellín') ||
      joined.includes('medellin') ||
      joined.includes('bogotá') ||
      joined.includes('bogota')
    ) {
      return {
        dateText: normalizeCell(matrix[Math.max(0, i - 1)]?.[0]),
        marketRowIndex: i,
        marketRow: row,
        subHeaderRow: matrix[i + 1] ?? [],
      }
    }
  }
  return null
}

function buildMarketColumns(marketRow) {
  const columns = []

  for (let i = 0; i < marketRow.length; i++) {
    const label = normalizeCell(marketRow[i])
    if (!label || /^precio\s*\$/i.test(label)) continue

    const lower = label.toLowerCase()
    let municipalityCode = null
    if (/medell[ií]n/.test(lower)) municipalityCode = '05001'
    else if (/bogot[aá]/.test(lower)) municipalityCode = '11001'
    else continue

    columns.push({
      municipalityCode,
      marketName: label.replace(/\r?\n/g, ' '),
      priceCol: i,
      variationCol: i + 1,
    })
  }

  return columns
}

function parsePriceCell(value) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const text = normalizeCell(value)
  if (!text || /^n\.?\s*d\.?$/i.test(text)) return null

  const normalized = text.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseVariationCell(value) {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value

  const text = normalizeCell(value)
  if (!text || /^n\.?\s*d\.?$/i.test(text)) return null

  const parsed = Number(text.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Parse a daily SIPSA anexo workbook into market prices by product name.
 * @returns {{ dateIso: string|null, products: Map<string, Array<{municipalityCode, marketName, price, variation}>> }}
 */
export function parseDailyAnexWorkbook(workbook) {
  const matrix = sheetToMatrix(workbook)
  const headers = findHeaderRows(matrix)
  if (!headers) {
    throw new Error('Could not find market header row in SIPSA daily anexo')
  }

  const dateIso = parseSpanishBulletinDate(headers.dateText)
  const marketColumns = buildMarketColumns(headers.marketRow)
  if (marketColumns.length === 0) {
    throw new Error('No Medellín/Bogotá columns found in SIPSA daily anexo')
  }

  const products = new Map()

  for (let r = headers.marketRowIndex + 2; r < matrix.length; r++) {
    const row = matrix[r] ?? []
    const rawName = normalizeCell(row[0])
    if (!rawName) continue
    if (/^verduras|^frutas|^tubérculos|^procesados|^carnes|^pescados|^lácteos|^granos|^otros/i.test(rawName)) {
      continue
    }
    if (rawName.startsWith('*') || /^n\.d\./i.test(rawName)) continue

    const mappedName =
      rawName in EXCEL_PRODUCT_CODE_BY_NAME
        ? rawName
        : normalizeProductName(rawName) in EXCEL_PRODUCT_CODE_BY_NAME
          ? normalizeProductName(rawName)
          : null
    if (!mappedName) continue

    const markets = []
    for (const col of marketColumns) {
      const price = parsePriceCell(row[col.priceCol])
      if (price == null) continue
      markets.push({
        municipalityCode: col.municipalityCode,
        marketName: col.marketName,
        price,
        variation: parseVariationCell(row[col.variationCol]),
      })
    }

    if (markets.length > 0) {
      products.set(mappedName, markets)
    }
  }

  return { dateIso, products }
}

export async function fetchAnexWorkbook(url) {
  const response = await fetch(url, {
    headers: {
      ...DANE_HEADERS,
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*',
    },
  })

  if (response.status === 404) {
    const error = new Error(`SIPSA daily anexo not found (404): ${url}`)
    error.code = 'ANEX_NOT_FOUND'
    throw error
  }

  if (!response.ok) {
    throw new Error(
      `Failed to download SIPSA daily anexo (${response.status}): ${url}`
    )
  }

  const buffer = await response.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

function eachDateIso(startIso, endIso) {
  const dates = []
  const cursor = new Date(`${startIso}T12:00:00`)
  const end = new Date(`${endIso}T12:00:00`)

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

/**
 * Fetch Excel bulletin prices for one product over a date range.
 * Returns API-shaped records: { Date, PROM_DIARIO, VAR_DIARIA, NOM_ABASTO }
 * scoped to municipalityCode.
 */
export async function fetchExcelProductPrices({
  productCode,
  municipalityCode,
  startIso,
  endIso,
  log = () => {},
  dayCache = null,
}) {
  const productName = EXCEL_PRODUCT_NAME_BY_CODE[String(productCode)]
  if (!productName) {
    throw new Error(
      `Product ${productCode} is not mapped in the SIPSA daily Excel bulletin. Supported: ${Object.entries(
        EXCEL_PRODUCT_NAME_BY_CODE
      )
        .map(([code, name]) => `${code}=${name}`)
        .join(', ')}`
    )
  }

  const cache = dayCache ?? new Map()
  const records = []
  const dates = eachDateIso(startIso, endIso)
  let downloaded = 0
  let missing = 0

  for (const dateIso of dates) {
    let day = cache.get(dateIso)

    if (day === undefined) {
      const url = buildAnexUrl(dateIso)
      try {
        log(`  Excel: ${buildAnexFilename(dateIso)}`)
        const workbook = await fetchAnexWorkbook(url)
        day = parseDailyAnexWorkbook(workbook)
        if (day.dateIso && day.dateIso !== dateIso) {
          log(
            `    Warning: file date ${day.dateIso} differs from expected ${dateIso}`
          )
        }
        downloaded += 1
      } catch (error) {
        if (error?.code === 'ANEX_NOT_FOUND') {
          day = null
          missing += 1
        } else {
          throw error
        }
      }
      cache.set(dateIso, day)
    }

    if (!day) continue

    const markets = day.products.get(productName)
    if (!markets) continue

    const hit = markets.find((m) => m.municipalityCode === municipalityCode)
    if (!hit) continue

    records.push({
      Date: day.dateIso ?? dateIso,
      PROM_DIARIO: hit.price,
      VAR_DIARIA: hit.variation,
      VAL_MIN: null,
      VAL_MAX: null,
      NOM_ABASTO: hit.marketName,
    })
  }

  log(
    `  Excel range ${startIso} → ${endIso}: ${records.length} day(s) with prices (${downloaded} downloaded, ${missing} missing/weekend)`
  )

  return records
}
