#!/usr/bin/env node
/**
 * Sync SIPSA monthly abastecimiento (supply volumes) via SOAP.
 *
 * Usage: npm run sync:sipsa-supply
 */

import { syncAllSupply } from './lib/sync-sipsa-supply-core.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

async function main() {
  const supabase = createSupabaseAdmin()
  const result = await syncAllSupply({ supabase })
  console.log(`\nDone — ${result.totalRows} supply row(s) upserted`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
