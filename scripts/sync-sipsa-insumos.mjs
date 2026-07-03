#!/usr/bin/env node
/**
 * Sync SIPSA-I insumo prices from DANE published XLSX files.
 *
 * Usage:
 *   npm run sync:sipsa-insumos              # latest monthly bulletin (~2 months)
 *   npm run sync:sipsa-insumos -- --historical   # full 2021-2026 series (large download)
 *   npm run sync:sipsa-insumos -- --try-soap     # also attempt legacy SOAP API
 */

import { syncAllInsumos } from './lib/sync-sipsa-insumos-core.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

function parseFlags(argv) {
  return {
    historical: argv.includes('--historical'),
    trySoap: argv.includes('--try-soap'),
  }
}

async function main() {
  const { historical, trySoap } = parseFlags(process.argv)
  const supabase = createSupabaseAdmin()

  const result = await syncAllInsumos({
    supabase,
    historical,
    skipSoap: !trySoap,
  })

  console.log(`\nDone — ${result.totalRows} insumo row(s) upserted (${result.source})`)

  if (result.totalRows === 0) {
    console.log(result.message ?? 'No data synced.')
    if (!historical) {
      console.log('Tip: run with --historical for the full DANE municipality series.')
    }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
