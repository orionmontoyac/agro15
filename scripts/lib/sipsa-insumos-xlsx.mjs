import * as XLSX from 'xlsx'

export const DANE_INSUMOS_PAGE_URL =
  process.env.DANE_INSUMOS_PAGE_URL ??
  'https://www.dane.gov.co/index.php/estadisticas-por-tema/agropecuario/sistema-de-informacion-de-precios-sipsa/componente-insumos-1'

export const DANE_INSUMOS_HISTORICAL_XLSX_URL =
  process.env.DANE_INSUMOS_HISTORICAL_XLSX_URL ??
  'https://www.dane.gov.co/files/operaciones/SIPSA/anex-SIPSAInsumos-SeriesHistoricasMun-2021-2026.xlsx'

export const TRACKED_INSUMO_MUNICIPALITY_CODES = ['05001', '11001']

const SPANISH_MONTHS = {
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

function padMunicipalityCode(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  return digits.slice(-5).padStart(5, '0')
}

function parsePriceHeader(header) {
  if (!header || typeof header !== 'string') return null
  const match = header.match(/precio promedio de (\w+) de (\d{4})/i)
  if (!match) return null

  const monthName = match[1].toLowerCase()
  const month = SPANISH_MONTHS[monthName]
  const year = Number(match[2])
  if (!month || !Number.isFinite(year)) return null

  return `${year}-${String(month).padStart(2, '0')}-01`
}

function normalizeCell(value) {
  if (value == null) return ''
  return String(value).trim()
}

function buildInsumoName(productName, presentation) {
  const product = normalizeCell(productName)
  const pres = normalizeCell(presentation)
  if (!product) return null
  return pres ? `${product} (${pres})` : product
}

function sheetToMatrix(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
}

function findDataSheet(workbook) {
  for (const sheetName of workbook.SheetNames) {
    const matrix = sheetToMatrix(workbook, sheetName)
    for (let rowIndex = 0; rowIndex < Math.min(matrix.length, 40); rowIndex++) {
      const row = matrix[rowIndex].map(normalizeCell)
      const hasMunicipalityCode = row.some((cell) =>
        /c[oó]digo municipio/i.test(cell)
      )
      const hasProduct = row.some((cell) =>
        /nombre del producto/i.test(cell)
      )
      if (hasMunicipalityCode && hasProduct) {
        return { sheetName, headerRowIndex: rowIndex, header: row, matrix }
      }
    }
  }
  return null
}

function columnIndex(header, pattern) {
  return header.findIndex((cell) => pattern.test(cell))
}

export function parseInsumosMunicipioWorkbook(workbook, options = {}) {
  const tracked = new Set(
    options.municipalityCodes ?? TRACKED_INSUMO_MUNICIPALITY_CODES
  )
  const found = findDataSheet(workbook)
  if (!found) return []

  const { header, headerRowIndex, matrix } = found
  const deptNameIdx = columnIndex(header, /nombre departamento/i)
  const muniCodeIdx = columnIndex(header, /c[oó]digo municipio/i)
  const muniNameIdx = columnIndex(header, /nombre municipio/i)
  const productIdx = columnIndex(header, /nombre del producto/i)
  const presentationIdx = columnIndex(header, /presentaci[oó]n del producto/i)

  const priceColumns = header
    .map((cell, index) => ({ index, periodMonth: parsePriceHeader(cell) }))
    .filter((col) => col.periodMonth != null)

  if (
    muniCodeIdx < 0 ||
    productIdx < 0 ||
    priceColumns.length === 0
  ) {
    return []
  }

  const rows = []

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex++) {
    const row = matrix[rowIndex]
    if (!row?.length) continue

    const municipalityCode = padMunicipalityCode(row[muniCodeIdx])
    if (!municipalityCode || !tracked.has(municipalityCode)) continue

    const insumoName = buildInsumoName(row[productIdx], row[presentationIdx])
    if (!insumoName) continue

    for (const { index, periodMonth } of priceColumns) {
      const price = Number(row[index])
      if (!Number.isFinite(price) || price <= 0) continue

      rows.push({
        insumoNombre: insumoName,
        deptNombre:
          deptNameIdx >= 0 ? normalizeCell(row[deptNameIdx]) || null : null,
        muniId: municipalityCode,
        muniNombre:
          muniNameIdx >= 0 ? normalizeCell(row[muniNameIdx]) || null : null,
        presentation:
          presentationIdx >= 0 ? normalizeCell(row[presentationIdx]) || null : null,
        fechaMesIni: `${periodMonth}T00:00:00-05:00`,
        promedio: price,
        tireId: 'sipsa-i',
        tireNombre: 'SIPSA-I · Precio de mercado',
        dataSource: options.dataSource ?? 'dane-xlsx',
      })
    }
  }

  return rows
}

export async function discoverLatestMunicipioXlsxUrl() {
  const response = await fetch(DANE_INSUMOS_PAGE_URL, {
    headers: { Accept: 'text/html' },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch DANE insumos page (${response.status})`)
  }

  const html = await response.text()
  const match = html.match(
    /href="(\/files\/operaciones\/SIPSA\/anex-SIPSAinsumosmunicipio-[^"]+\.xlsx)"/i
  )

  if (!match) {
    throw new Error('Could not find anex-SIPSAinsumosmunicipio XLSX link on DANE page')
  }

  return `https://www.dane.gov.co${match[1]}`
}

export async function fetchInsumosMunicipioWorkbook(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*' },
  })

  if (!response.ok) {
    throw new Error(`Failed to download insumos XLSX (${response.status}): ${url}`)
  }

  const buffer = await response.arrayBuffer()
  return XLSX.read(buffer, { type: 'array' })
}

export async function fetchLatestInsumosFromDane() {
  const url = await discoverLatestMunicipioXlsxUrl()
  const workbook = await fetchInsumosMunicipioWorkbook(url)
  const rows = parseInsumosMunicipioWorkbook(workbook)

  return { url, rows }
}

export async function fetchHistoricalInsumosFromDane(options = {}) {
  const url = options.url ?? DANE_INSUMOS_HISTORICAL_XLSX_URL
  const workbook = await fetchInsumosMunicipioWorkbook(url)
  const rows = parseInsumosMunicipioWorkbook(workbook, {
    dataSource: 'dane-xlsx-historical',
  })

  return { url, rows }
}
