import {
  fetchSipsaProductPrices,
  formatApiDate,
} from './sipsa-fetch.mjs'

export const DEFAULT_DAYS = 30
const CHUNK_BY_MONTH_AFTER_DAYS = 90
const UPSERT_BATCH_SIZE = 500

export const LOCATIONS = [
  { label: 'Medellín', department_code: '05', municipality_code: '05001' },
  { label: 'Bogotá', department_code: '11', municipality_code: '11001' },
]

export function getDateRange(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return buildRange(start, end, `${days} days`)
}

export function getDateRangeFromYears(years) {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - years)
  return buildRange(start, end, `${years} year(s)`)
}

export function buildRange(start, end, label) {
  return {
    startDate: formatApiDate(start),
    endDate: formatApiDate(end),
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    spanDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    label,
  }
}

function todayAtNoon() {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  return date
}

export function getUpdateDateRange(lastDateIso) {
  const end = todayAtNoon()

  if (!lastDateIso) {
    return {
      ...getDateRange(DEFAULT_DAYS),
      noExistingData: true,
    }
  }

  const start = new Date(`${lastDateIso}T12:00:00`)
  start.setDate(start.getDate() + 1)

  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)

  if (startIso > endIso) {
    return { upToDate: true, lastDateIso }
  }

  return {
    ...buildRange(start, end, `update after ${lastDateIso}`),
    lastDateIso,
  }
}

function buildMonthlyChunks(range) {
  if (range.spanDays <= CHUNK_BY_MONTH_AFTER_DAYS) {
    return [
      {
        startDate: range.startDate,
        endDate: range.endDate,
        label: `${range.startIso} → ${range.endIso}`,
      },
    ]
  }

  const chunks = []
  const end = new Date(`${range.endIso}T12:00:00`)
  let cursor = new Date(`${range.startIso}T12:00:00`)

  while (cursor <= end) {
    const monthEnd = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
      12
    )
    const chunkEnd = monthEnd > end ? end : monthEnd

    chunks.push({
      startDate: formatApiDate(cursor),
      endDate: formatApiDate(chunkEnd),
      label: cursor.toISOString().slice(0, 7),
    })

    cursor = new Date(chunkEnd)
    cursor.setDate(cursor.getDate() + 1)
  }

  return chunks
}

export async function fetchPricesForLocation(
  location,
  productCode,
  range,
  log,
  reportType = 'day'
) {
  const chunks = buildMonthlyChunks(range)
  const allRecords = []

  for (const chunk of chunks) {
    if (chunks.length > 1) {
      log(`  Chunk ${chunk.label} (${chunk.startDate}–${chunk.endDate})...`)
    }

    const records = await fetchSipsaProductPrices({
      departmentCode: location.department_code,
      municipalityCode: location.municipality_code,
      productCode,
      startDate: chunk.startDate,
      endDate: chunk.endDate,
      reportType,
    })

    allRecords.push(...records)

    if (chunks.length > 1) {
      log(`    ${records.length} record(s)`)
    }
  }

  return allRecords
}

export async function upsertPriceRows(supabase, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabase.from('sipsa_product_prices').upsert(batch, {
      onConflict: 'product_id,municipality_id,date,report_type',
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

function optionalNumber(value) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapPriceRecords(
  records,
  productId,
  municipalityId,
  departmentId,
  reportType = 'day'
) {
  const fetchTimestamp = new Date().toISOString()
  const seenDates = new Set()
  const rows = []
  let marketName = null

  for (const record of records) {
    const date = record.Date
    if (!date || seenDates.has(date)) continue

    const price = Number(record.PROM_DIARIO)
    if (!Number.isFinite(price)) continue

    if (record.NOM_ABASTO && !marketName) {
      marketName = String(record.NOM_ABASTO)
    }

    seenDates.add(date)
    rows.push({
      product_id: productId,
      municipality_id: municipalityId,
      department_id: departmentId,
      price,
      price_min: optionalNumber(record.VAL_MIN),
      price_max: optionalNumber(record.VAL_MAX),
      daily_variation: optionalNumber(record.VAR_DIARIA),
      report_type: reportType,
      date,
      fetch_timestamp: fetchTimestamp,
    })
  }

  return { rows, marketName }
}

export async function updateMarketName(supabase, municipalityId, marketName) {
  if (!marketName) return

  const { error } = await supabase
    .from('sipsa_municipalities')
    .update({ market_name: marketName })
    .eq('id', municipalityId)

  if (error) {
    throw new Error(`Failed to update market name: ${error.message}`)
  }
}

async function getLatestPriceDate(supabase, productId, municipalityId) {
  const { data, error } = await supabase
    .from('sipsa_product_prices')
    .select('date')
    .eq('product_id', productId)
    .eq('municipality_id', municipalityId)
    .eq('report_type', 'day')
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load latest price date: ${error.message}`)
  }

  return data?.date ?? null
}

export async function loadCatalogIds(supabase, productCode) {
  const { data: product, error: productError } = await supabase
    .from('sipsa_products')
    .select('id, product_code, product_name')
    .eq('product_code', productCode)
    .single()

  if (productError || !product) {
    throw new Error(
      `Product ${productCode} not found in Supabase. Run npm run sync:sipsa-catalog first.`
    )
  }

  const municipalityCodes = LOCATIONS.map((loc) => loc.municipality_code)
  const { data: municipalities, error: munError } = await supabase
    .from('sipsa_municipalities')
    .select('id, municipality_code, municipality_name, department_id')
    .in('municipality_code', municipalityCodes)

  if (munError) {
    throw new Error(`Failed to load municipalities: ${munError.message}`)
  }

  const munByCode = new Map(
    (municipalities ?? []).map((row) => [row.municipality_code, row])
  )

  for (const loc of LOCATIONS) {
    if (!munByCode.has(loc.municipality_code)) {
      throw new Error(
        `Municipality ${loc.municipality_code} not found. Run npm run sync:sipsa-catalog first.`
      )
    }
  }

  return { product, munByCode }
}

async function syncProductPricesInternal(
  supabase,
  productCode,
  { range: fixedRange, update = false, log = () => {} }
) {
  const { product, munByCode } = await loadCatalogIds(supabase, productCode)
  const locationResults = []

  for (const location of LOCATIONS) {
    log(`Fetching ${location.label} (${location.municipality_code})...`)

    const municipality = munByCode.get(location.municipality_code)

    let range = fixedRange
    if (update) {
      const lastDate = await getLatestPriceDate(
        supabase,
        product.id,
        municipality.id
      )
      const updateRange = getUpdateDateRange(lastDate)

      if (updateRange.upToDate) {
        log(`  Already up to date (latest stored: ${updateRange.lastDateIso})`)
        locationResults.push({
          location: location.label,
          count: 0,
          latestDate: updateRange.lastDateIso,
          skipped: true,
        })
        continue
      }

      range = updateRange

      if (updateRange.noExistingData) {
        log(
          `  No stored prices yet — fetching last ${DEFAULT_DAYS} days (${range.startIso} → ${range.endIso})`
        )
      } else {
        log(
          `  Last stored: ${updateRange.lastDateIso} — fetching ${range.startIso} → ${range.endIso}`
        )
      }
    }

    const records = await fetchPricesForLocation(
      location,
      productCode,
      range,
      log
    )

    const { rows, marketName } = mapPriceRecords(
      records,
      product.id,
      municipality.id,
      municipality.department_id,
      'day'
    )

    if (rows.length === 0) {
      log(`  No price rows returned for ${location.label}`)
      locationResults.push({
        location: location.label,
        count: 0,
        latestDate: null,
      })
      continue
    }

    await upsertPriceRows(supabase, rows)
    await updateMarketName(supabase, municipality.id, marketName)

    const latest = rows.reduce((best, row) =>
      row.date > best.date ? row : best
    )

    log(`  Upserted ${rows.length} price row(s)`)
    log(`  Latest: ${latest.date} — $${latest.price}/kg`)

    locationResults.push({
      location: location.label,
      count: rows.length,
      latestDate: latest.date,
      latestPrice: latest.price,
    })
  }

  const totalRows = locationResults.reduce((sum, row) => sum + row.count, 0)

  return {
    productCode: product.product_code,
    productName: product.product_name,
    totalRows,
    locations: locationResults,
  }
}

export async function syncProductPricesUpdate(supabase, productCode, options = {}) {
  return syncProductPricesInternal(supabase, productCode, {
    update: true,
    log: options.log ?? (() => {}),
  })
}

export async function syncProductPrices(supabase, productCode, options = {}) {
  if (!options.range) {
    throw new Error('syncProductPrices requires a date range')
  }

  return syncProductPricesInternal(supabase, productCode, {
    range: options.range,
    update: false,
    log: options.log ?? (() => {}),
  })
}

export async function syncAllProductsUpdate({
  supabase,
  productCodes,
  log = console.log,
}) {
  const settled = await Promise.allSettled(
    productCodes.map(async (productCode) => {
      log(`Syncing product ${productCode}...`)
      const result = await syncProductPricesUpdate(supabase, productCode, {
        log: (message) => log(`  [${productCode}] ${message}`),
      })
      log(
        `  [${productCode}] Done — ${result.totalRows} row(s) upserted`
      )
      return result
    })
  )

  return settled.map((outcome, index) => {
    const productCode = productCodes[index]
    if (outcome.status === 'fulfilled') {
      return outcome.value
    }

    const error =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : String(outcome.reason)

    log(`  [${productCode}] Failed — ${error}`)

    return {
      productCode,
      productName: null,
      totalRows: 0,
      locations: [],
      error,
    }
  })
}
