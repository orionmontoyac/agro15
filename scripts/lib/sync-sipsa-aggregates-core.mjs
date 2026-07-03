import { formatApiDate } from './sipsa-fetch.mjs'
import {
  LOCATIONS,
  fetchPricesForLocation,
  loadCatalogIds,
  mapPriceRecords,
  upsertPriceRows,
} from './sync-sipsa-prices-core.mjs'

const WEEKS_LOOKBACK = 26 * 7
const MONTHS_LOOKBACK = 24 * 31

function getAggregateRange(reportType) {
  const end = new Date()
  const start = new Date()

  if (reportType === 'week') {
    start.setDate(start.getDate() - WEEKS_LOOKBACK)
  } else {
    start.setMonth(start.getMonth() - MONTHS_LOOKBACK)
  }

  return {
    startDate: formatApiDate(start),
    endDate: formatApiDate(end),
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    spanDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    label: `${reportType} aggregates`,
  }
}

export async function syncProductAggregates(
  supabase,
  productCode,
  reportType,
  options = {}
) {
  const log = options.log ?? (() => {})
  const { product, munByCode } = await loadCatalogIds(supabase, productCode)
  const range = getAggregateRange(reportType)
  let totalRows = 0

  for (const location of LOCATIONS) {
    log(`Fetching ${reportType} ${location.label}...`)

    const municipality = munByCode.get(location.municipality_code)
    const records = await fetchPricesForLocation(
      location,
      productCode,
      range,
      log,
      reportType
    )

    const { rows } = mapPriceRecords(
      records,
      product.id,
      municipality.id,
      municipality.department_id,
      reportType
    )

    if (rows.length === 0) {
      log(`  No ${reportType} rows for ${location.label}`)
      continue
    }

    await upsertPriceRows(supabase, rows)
    totalRows += rows.length
    log(`  Upserted ${rows.length} ${reportType} row(s)`)
  }

  return {
    productCode: product.product_code,
    reportType,
    totalRows,
  }
}

export async function syncAllAggregates({
  supabase,
  productCodes,
  reportTypes = ['week', 'month'],
  log = console.log,
}) {
  const results = []

  for (const reportType of reportTypes) {
    log(`\n=== Syncing ${reportType} aggregates ===`)

    const settled = await Promise.allSettled(
      productCodes.map(async (productCode) => {
        const result = await syncProductAggregates(
          supabase,
          productCode,
          reportType,
          {
            log: (message) => log(`  [${productCode}] ${message}`),
          }
        )
        log(`  [${productCode}] ${reportType}: ${result.totalRows} row(s)`)
        return result
      })
    )

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.push(outcome.value)
      } else {
        const error =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason)
        log(`  Failed: ${error}`)
        results.push({ reportType, error, totalRows: 0 })
      }
    }
  }

  return results
}
