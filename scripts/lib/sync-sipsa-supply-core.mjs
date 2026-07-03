import { AGRO15_SYNC_PRODUCT_CODES } from './agro15-products.mjs'
import {
  fetchSipsaAbastecimiento,
  matchSupplyMarket,
  parsePeriodMonth,
} from './sipsa-soap-fetch.mjs'

const UPSERT_BATCH_SIZE = 500
const MONTHS_TO_KEEP = 24

function cutoffPeriodMonth() {
  const date = new Date()
  date.setMonth(date.getMonth() - MONTHS_TO_KEEP)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

async function loadCatalog(supabase) {
  const { data: products, error: productError } = await supabase
    .from('sipsa_products')
    .select('id, product_code, product_name')
    .in('product_code', AGRO15_SYNC_PRODUCT_CODES)

  if (productError) {
    throw new Error(`Failed to load products: ${productError.message}`)
  }

  const { data: municipalities, error: munError } = await supabase
    .from('sipsa_municipalities')
    .select('id, municipality_code')
    .in('municipality_code', ['05001', '11001'])

  if (munError) {
    throw new Error(`Failed to load municipalities: ${munError.message}`)
  }

  const productByCode = new Map(
    (products ?? []).map((row) => [row.product_code, row])
  )
  const munByCode = new Map(
    (municipalities ?? []).map((row) => [row.municipality_code, row])
  )

  return { productByCode, munByCode }
}

function mapSupplyRows(soapRows, productByCode, munByCode) {
  const fetchTimestamp = new Date().toISOString()
  const cutoff = cutoffPeriodMonth()
  const rows = []
  const seen = new Set()

  for (const row of soapRows) {
    const productCode = String(row.artiId)
    const product = productByCode.get(productCode)
    if (!product) continue

    const market = matchSupplyMarket(row.fuenNombre)
    if (!market) continue

    const municipality = munByCode.get(market.municipality_code)
    if (!municipality) continue

    const periodMonth = parsePeriodMonth(row.fechaMesIni)
    if (!periodMonth || periodMonth < cutoff) continue

    if (!Number.isFinite(row.cantidadTon)) continue

    const sourceId = row.fuenId ?? 'unknown'
    const dedupeKey = `${product.id}:${municipality.id}:${periodMonth}:${sourceId}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    rows.push({
      product_id: product.id,
      municipality_id: municipality.id,
      period_month: periodMonth,
      quantity_tons: row.cantidadTon,
      source_id: String(sourceId),
      source_name: row.fuenNombre,
      fetch_timestamp: fetchTimestamp,
    })
  }

  return rows
}

async function upsertSupplyRows(supabase, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabase.from('sipsa_supply_monthly').upsert(batch, {
      onConflict: 'product_id,municipality_id,period_month,source_id',
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function syncAllSupply({ supabase, log = console.log }) {
  log('Fetching SIPSA abastecimiento (SOAP)...')
  const soapRows = await fetchSipsaAbastecimiento()
  log(`Received ${soapRows.length} SOAP row(s)`)

  const { productByCode, munByCode } = await loadCatalog(supabase)
  const rows = mapSupplyRows(soapRows, productByCode, munByCode)
  log(`Mapped ${rows.length} row(s) for tracked products and markets`)

  if (rows.length === 0) {
    return { totalRows: 0, soapRows: soapRows.length }
  }

  await upsertSupplyRows(supabase, rows)
  log(`Upserted ${rows.length} supply row(s)`)

  return { totalRows: rows.length, soapRows: soapRows.length }
}
