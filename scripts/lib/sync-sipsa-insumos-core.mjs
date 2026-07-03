import {
  fetchAllSipsaInsumos,
  normalizeMunicipalityCode,
  parsePeriodMonth,
} from './sipsa-soap-fetch.mjs'
import {
  fetchHistoricalInsumosFromDane,
  fetchLatestInsumosFromDane,
  TRACKED_INSUMO_MUNICIPALITY_CODES,
} from './sipsa-insumos-xlsx.mjs'

const UPSERT_BATCH_SIZE = 500
const MONTHS_TO_KEEP = 36

const TRACKED_CODES = new Set(TRACKED_INSUMO_MUNICIPALITY_CODES)

function cutoffPeriodMonth() {
  const date = new Date()
  date.setMonth(date.getMonth() - MONTHS_TO_KEEP)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function mapInsumoRows(rawRows, defaultDataSource = 'dane-xlsx') {
  const fetchTimestamp = new Date().toISOString()
  const cutoff = cutoffPeriodMonth()
  const rows = []
  const seen = new Set()

  for (const row of rawRows) {
    const municipalityCode =
      normalizeMunicipalityCode(row.muniId) ??
      normalizeMunicipalityCode(row.municipality_code)
    if (!municipalityCode || !TRACKED_CODES.has(municipalityCode)) continue

    const periodMonth = parsePeriodMonth(row.fechaMesIni) ?? row.period_month
    if (!periodMonth || periodMonth < cutoff) continue

    const price = Number(row.promedio ?? row.average_price)
    if (!Number.isFinite(price)) continue

    const insumoName = row.insumoNombre ?? row.insumo_name
    if (!insumoName) continue

    const collectionTypeId = String(row.tireId ?? row.collection_type_id ?? 'sipsa-i')
    const dedupeKey = `${insumoName}:${municipalityCode}:${periodMonth}:${collectionTypeId}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    rows.push({
      insumo_name: insumoName,
      department_name: row.deptNombre ?? row.department_name ?? null,
      municipality_code: municipalityCode,
      municipality_name: row.muniNombre ?? row.municipality_name ?? null,
      presentation: row.presentation ?? null,
      period_month: periodMonth,
      average_price: price,
      collection_type_id: collectionTypeId,
      collection_type_name: row.tireNombre ?? row.collection_type_name ?? 'SIPSA-I',
      data_source: row.dataSource ?? row.data_source ?? defaultDataSource,
      fetch_timestamp: fetchTimestamp,
    })
  }

  return rows
}

async function upsertInsumoRows(supabase, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabase.from('sipsa_insumos_monthly').upsert(batch, {
      onConflict: 'insumo_name,municipality_code,period_month,collection_type_id',
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

async function fetchSoapRows(log) {
  log('Trying SIPSA SOAP consultarInsumosSipsaMesMadr (often empty)...')
  const soapRows = await fetchAllSipsaInsumos()
  log(`SOAP returned ${soapRows.length} row(s)`)
  return soapRows
}

export async function syncAllInsumos({
  supabase,
  log = console.log,
  historical = false,
  skipSoap = true,
}) {
  let rawRows = []
  let source = 'dane-xlsx'

  if (historical) {
    log('Downloading DANE historical insumos series (2021-2026)...')
    const { url, rows } = await fetchHistoricalInsumosFromDane()
    log(`Historical XLSX: ${url}`)
    log(`Parsed ${rows.length} row(s) from historical workbook`)
    rawRows = rows
    source = 'dane-xlsx-historical'
  } else {
    log('Downloading latest DANE insumos bulletin (municipio)...')
    const { url, rows } = await fetchLatestInsumosFromDane()
    log(`Monthly XLSX: ${url}`)
    log(`Parsed ${rows.length} row(s) from monthly workbook`)
    rawRows = rows
  }

  if (rawRows.length === 0 && !skipSoap) {
    rawRows = await fetchSoapRows(log)
    source = 'sipsa-soap'
  }

  const rows = mapInsumoRows(rawRows, source)
  log(`Mapped ${rows.length} row(s) for Medellín and Bogotá`)

  if (rows.length === 0) {
    return {
      totalRows: 0,
      sourceRows: rawRows.length,
      source,
      message:
        'No insumo rows found. Try: npm run sync:sipsa-insumos -- --historical',
    }
  }

  await upsertInsumoRows(supabase, rows)
  log(`Upserted ${rows.length} insumo row(s)`)

  return {
    totalRows: rows.length,
    sourceRows: rawRows.length,
    source,
  }
}
