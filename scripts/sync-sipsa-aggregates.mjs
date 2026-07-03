#!/usr/bin/env node
/**
 * Sync SIPSA weekly and monthly price aggregates.
 *
 * Usage:
 *   npm run sync:sipsa-aggregates
 *   npm run sync:sipsa-aggregates -- week
 *   npm run sync:sipsa-aggregates -- month
 */

import { AGRO15_SYNC_PRODUCT_CODES } from './lib/agro15-products.mjs'
import { syncAllAggregates } from './lib/sync-sipsa-aggregates-core.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

function parseReportTypes(argv) {
  const args = argv.slice(2)
  const valid = new Set(['week', 'month'])
  const requested = args.filter((arg) => valid.has(arg))
  return requested.length > 0 ? requested : ['week', 'month']
}

async function main() {
  const reportTypes = parseReportTypes(process.argv)
  const supabase = createSupabaseAdmin()

  console.log(`Syncing aggregates: ${reportTypes.join(', ')}`)
  console.log(`Products: ${AGRO15_SYNC_PRODUCT_CODES.join(', ')}\n`)

  const results = await syncAllAggregates({
    supabase,
    productCodes: AGRO15_SYNC_PRODUCT_CODES,
    reportTypes,
  })

  const totalRows = results.reduce((sum, row) => sum + (row.totalRows ?? 0), 0)
  const failures = results.filter((row) => row.error)

  console.log(`\nDone — ${totalRows} row(s) upserted`)
  if (failures.length > 0) {
    console.error(`${failures.length} failure(s)`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
