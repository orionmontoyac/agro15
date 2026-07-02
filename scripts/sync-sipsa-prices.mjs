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
 *   npm run sync:sipsa-prices -- 116 --update   # fill from last stored date to today
 *   npm run sync:sipsa-prices-granadilla   # shorthand for code 106
 *
 * Prerequisites:
 *   - .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - npm run sync:sipsa-catalog (catalog FK rows must exist)
 */

import { createSupabaseAdmin } from './lib/supabase-admin.mjs'
import {
  DEFAULT_DAYS,
  getDateRange,
  getDateRangeFromYears,
  syncProductPrices,
  syncProductPricesUpdate,
} from './lib/sync-sipsa-prices-core.mjs'

function parseArgs(argv) {
  const args = argv.slice(2)
  let productCode = null
  let days = null
  let years = null
  let update = false

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
    } else if (args[i] === '--update') {
      update = true
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

  const rangeFlags = [days != null, years != null, update].filter(Boolean).length
  if (rangeFlags > 1) {
    throw new Error('Use only one of --days, --years, or --update')
  }

  return {
    productCode,
    update,
    range:
      update || years != null
        ? null
        : getDateRange(days ?? DEFAULT_DAYS),
    years,
  }
}

function printUsage() {
  console.log(
    `Usage: npm run sync:sipsa-prices -- <product-code> [--days ${DEFAULT_DAYS}] [--years N] [--update]`
  )
  console.log('')
  console.log('Examples:')
  console.log('  npm run sync:sipsa-prices -- 106              # last 30 days')
  console.log('  npm run sync:sipsa-prices -- 106 --days 7')
  console.log('  npm run sync:sipsa-prices -- 106 --years 3    # last 3 calendar years')
  console.log('  npm run sync:sipsa-prices -- 116 --update     # fill from last stored date to today')
  console.log('  npm run sync:sipsa-prices -- 46 --years 3     # Tomate chonto')
  console.log('  npm run sync:sipsa-prices -- 113 --years 3    # Gulupa')
}

async function main() {
  const { productCode, update, range: fixedRange, years } = parseArgs(process.argv)
  const backfillRange =
    years != null ? getDateRangeFromYears(years) : null

  console.log('=== SIPSA price sync → Supabase ===\n')

  console.log(`Product code: ${productCode}`)
  if (update) {
    console.log('Mode: update (fill from last stored date to today)\n')
  } else {
    const range = backfillRange ?? fixedRange
    console.log(
      `Date range: ${range.startIso} → ${range.endIso} (${range.label}, ~${range.spanDays} days)\n`
    )
  }

  const supabase = createSupabaseAdmin()
  const log = (message) => console.log(message)

  const result = update
    ? await syncProductPricesUpdate(supabase, productCode, { log })
    : await syncProductPrices(supabase, productCode, {
        range: backfillRange ?? fixedRange,
        log,
      })

  console.log('\n=== Summary ===')
  console.log(`Product: ${result.productName} (${result.productCode})`)
  console.log(`Total price rows upserted: ${result.totalRows}`)
  for (const {
    location,
    count,
    latestDate,
    latestPrice,
    skipped,
  } of result.locations) {
    if (latestDate) {
      const suffix =
        latestPrice != null
          ? ` @ $${latestPrice}/kg`
          : skipped
            ? ' (up to date)'
            : ''
      console.log(`  ${location}: ${count} rows, latest ${latestDate}${suffix}`)
    } else {
      console.log(`  ${location}: no data`)
    }
  }

  console.log('\nDone.')
}

main().catch((error) => {
  console.error('\nSync failed:', error.message)
  process.exit(1)
})
