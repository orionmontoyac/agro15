#!/usr/bin/env node
/**
 * sync-sipsa-prices.mjs
 *
 * Fetches the last N days of wholesale prices from SIPSA for a product code
 * in Medellín and Bogotá, then upserts into sipsa_product_prices.
 *
 * Usage:
 *   npm run sync:sipsa-prices -- 106
 *   npm run sync:sipsa-prices -- 106 --years 3
 *   npm run sync:sipsa-prices-granadilla   # shorthand for code 106
 *
 * Prerequisites:
 *   - .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - npm run sync:sipsa-catalog (catalog FK rows must exist)
 */

import {
  fetchSipsaProductPrices,
  formatApiDate,
} from './lib/sipsa-fetch.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

const DEFAULT_DAYS = 30
const CHUNK_BY_MONTH_AFTER_DAYS = 90
const UPSERT_BATCH_SIZE = 500
const LOCATIONS = [
  { label: 'Medellín', department_code: '05', municipality_code: '05001' },
  { label: 'Bogotá', department_code: '11', municipality_code: '11001' },
]

function parseArgs(argv) {
  const args = argv.slice(2)
  let productCode = null
  let days = null
  let years = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days') {
      const value = Number(args[++i])
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--days must be a positive number')
      }
      days = value
    } else if (args[i] === '--years') {
      const value = Number(args[++i])
      if (!Number.isFinite(value) || value < 1) {
        throw new Error('--years must be a positive number')
      }
      years = value
    } else if (args[i] === '--help' || args[i] === '-h') {
      printUsage()
      process.exit(0)
    } else if (!args[i].startsWith('-')) {
      if (productCode) {
        throw new Error(`Unexpected argument: ${args[i]}`)
      }
      productCode = args[i]
    } else {
      throw new Error(`Unknown option: ${args[i]}`)
    }
  }

  if (!productCode) {
    printUsage()
    process.exit(1)
  }

  if (days != null && years != null) {
    throw new Error('Use either --days or --years, not both')
  }

  return {
    productCode,
    range: years != null ? getDateRangeFromYears(years) : getDateRange(days ?? DEFAULT_DAYS),
  }
}

function printUsage() {
  console.log(
    `Usage: npm run sync:sipsa-prices -- <product-code> [--days ${DEFAULT_DAYS}] [--years N]`
  )
  console.log('')
  console.log('Examples:')
  console.log('  npm run sync:sipsa-prices -- 106              # last 30 days')
  console.log('  npm run sync:sipsa-prices -- 106 --days 7')
  console.log('  npm run sync:sipsa-prices -- 106 --years 3    # last 3 calendar years')
  console.log('  npm run sync:sipsa-prices -- 46 --years 3     # Tomate chonto')
  console.log('  npm run sync:sipsa-prices -- 113 --years 3    # Gulupa')
}

function getDateRange(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  return buildRange(start, end, `${days} days`)
}

function getDateRangeFromYears(years) {
  const end = new Date()
  const start = new Date(end)
  start.setFullYear(start.getFullYear() - years)
  return buildRange(start, end, `${years} year(s)`)
}

function buildRange(start, end, label) {
  return {
    startDate: formatApiDate(start),
    endDate: formatApiDate(end),
    startIso: start.toISOString().slice(0, 10),
    endIso: end.toISOString().slice(0, 10),
    spanDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
    label,
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

async function fetchPricesForLocation(location, productCode, range) {
  const chunks = buildMonthlyChunks(range)
  const allRecords = []

  for (const chunk of chunks) {
    if (chunks.length > 1) {
      console.log(`  Chunk ${chunk.label} (${chunk.startDate}–${chunk.endDate})...`)
    }

    const records = await fetchSipsaProductPrices({
      departmentCode: location.department_code,
      municipalityCode: location.municipality_code,
      productCode,
      startDate: chunk.startDate,
      endDate: chunk.endDate,
    })

    allRecords.push(...records)

    if (chunks.length > 1) {
      console.log(`    ${records.length} record(s)`)
    }
  }

  return allRecords
}

async function upsertPriceRows(supabase, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE)
    const { error } = await supabase.from('sipsa_product_prices').upsert(batch, {
      onConflict: 'product_id,municipality_id,date',
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

function mapPriceRecords(records, productId, municipalityId, departmentId) {
  const fetchTimestamp = new Date().toISOString()
  const seenDates = new Set()
  const rows = []

  for (const record of records) {
    const date = record.Date
    if (!date || seenDates.has(date)) continue

    const price = Number(record.PROM_DIARIO)
    if (!Number.isFinite(price)) continue

    seenDates.add(date)
    rows.push({
      product_id: productId,
      municipality_id: municipalityId,
      department_id: departmentId,
      price,
      date,
      fetch_timestamp: fetchTimestamp,
    })
  }

  return rows
}

async function loadCatalogIds(supabase, productCode) {
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

async function main() {
  const { productCode, range } = parseArgs(process.argv)

  console.log('=== SIPSA price sync → Supabase ===\n')

  console.log(`Product code: ${productCode}`)
  console.log(
    `Date range: ${range.startIso} → ${range.endIso} (${range.label}, ~${range.spanDays} days)\n`
  )

  const supabase = createSupabaseAdmin()
  const { product, munByCode } = await loadCatalogIds(supabase, productCode)

  console.log(`Product: ${product.product_code} — ${product.product_name}\n`)

  const results = []

  for (const location of LOCATIONS) {
    console.log(`Fetching ${location.label} (${location.municipality_code})...`)

    const municipality = munByCode.get(location.municipality_code)
    const records = await fetchPricesForLocation(location, productCode, range)

    const rows = mapPriceRecords(
      records,
      product.id,
      municipality.id,
      municipality.department_id
    )

    if (rows.length === 0) {
      console.log(`  No price rows returned for ${location.label}\n`)
      results.push({ location, count: 0, latest: null })
      continue
    }

    await upsertPriceRows(supabase, rows)

    const latest = rows.reduce((best, row) =>
      row.date > best.date ? row : best
    )

    console.log(`  Upserted ${rows.length} price row(s)`)
    console.log(`  Latest: ${latest.date} — $${latest.price}/kg\n`)

    results.push({ location, count: rows.length, latest })
  }

  const total = results.reduce((sum, r) => sum + r.count, 0)

  console.log('=== Summary ===')
  console.log(`Product: ${product.product_name} (${product.product_code})`)
  console.log(`Total price rows upserted: ${total}`)
  for (const { location, count, latest } of results) {
    if (latest) {
      console.log(
        `  ${location.label}: ${count} rows, latest ${latest.date} @ $${latest.price}/kg`
      )
    } else {
      console.log(`  ${location.label}: no data`)
    }
  }

  console.log('\nDone.')
}

main().catch((error) => {
  console.error('\nSync failed:', error.message)
  process.exit(1)
})
