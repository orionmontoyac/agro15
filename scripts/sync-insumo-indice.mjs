#!/usr/bin/env node
/**
 * Sync UPRA "Índice de precios de insumos agrícolas" from datos.gov.co.
 *
 * Usage:
 *   npm run sync:insumo-indice              # last stored month - 3 → latest
 *   npm run sync:insumo-indice -- --full    # full series
 */

import { syncInsumoIndice } from './lib/insumo-indice-core.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

async function main() {
  const full = process.argv.includes('--full')
  const supabase = createSupabaseAdmin({ log: console.log })

  const result = await syncInsumoIndice({ supabase, full })

  console.log(
    `\nDone — ${result.rows} row(s) upserted, latest fecha ${result.latestFecha ?? 'n/a'}`
  )

  if (result.rows === 0) process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
