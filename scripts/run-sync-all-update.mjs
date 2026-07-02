#!/usr/bin/env node
/**
 * Incrementally sync all Agro15 tracked products (--update for each code).
 *
 * Usage: npm run sync:sipsa-prices-all-update
 */

import { AGRO15_SYNC_PRODUCT_CODES } from './lib/agro15-products.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'
import { syncAllProductsUpdate } from './lib/sync-sipsa-prices-core.mjs'

async function main() {
  console.log('=== SIPSA all-products update → Supabase ===\n')
  console.log(`Products: ${AGRO15_SYNC_PRODUCT_CODES.join(', ')}\n`)

  const supabase = createSupabaseAdmin()
  const results = await syncAllProductsUpdate({
    supabase,
    productCodes: AGRO15_SYNC_PRODUCT_CODES,
  })

  const failed = results.filter((result) => result.error)
  const totalRows = results.reduce((sum, result) => sum + result.totalRows, 0)

  console.log('\n=== Summary ===')
  console.log(`Products synced: ${results.length}`)
  console.log(`Total rows upserted: ${totalRows}`)
  console.log(`Failures: ${failed.length}`)

  if (failed.length > 0) {
    for (const result of failed) {
      console.log(`  ${result.productCode}: ${result.error}`)
    }
    process.exit(1)
  }

  console.log('\nDone.')
}

main().catch((error) => {
  console.error('\nSync failed:', error.message)
  process.exit(1)
})
