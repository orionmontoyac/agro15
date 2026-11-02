#!/usr/bin/env node
/**
 * Melt UPRA "Índice de precios de insumos agrícolas" CSV (wide → long)
 * and upsert into public.insumo_precio_indice on agro15.
 * Offline fallback — the scheduled sync uses `sync:insumo-indice` (datos.gov.co API).
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-insumo-precio-indice.mjs [path/to.csv]
 */

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'
import {
  PRODUCT_CATEGORY,
  parseValor,
  upsertIndiceRows,
} from './lib/insumo-indice-core.mjs'

/**
 * @param {string} mmYyyy e.g. "05/2026"
 * @returns {string} ISO date first day of month
 */
function parseFecha(mmYyyy) {
  const [mm, yyyy] = mmYyyy.trim().split('/')
  if (!mm || !yyyy) throw new Error(`Invalid Fecha: ${mmYyyy}`)
  return `${yyyy}-${mm.padStart(2, '0')}-01`
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

/**
 * @param {string} csvPath
 * @returns {Promise<Array<{ fecha: string, categoria: string, producto: string, valor: number | null }>>}
 */
async function meltCsv(csvPath) {
  const rl = createInterface({
    input: createReadStream(csvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })

  /** @type {string[] | null} */
  let headers = null
  /** @type {Array<{ fecha: string, categoria: string, producto: string, valor: number | null }>} */
  const rows = []
  /** @type {string[]} */
  const unknown = []

  for await (const line of rl) {
    const trimmed = line.replace(/^\uFEFF/, '').trim()
    if (!trimmed) continue
    const cols = parseCsvLine(trimmed)
    if (!headers) {
      headers = cols
      continue
    }

    const fechaRaw = cols[0]
    if (!fechaRaw) continue
    const fecha = parseFecha(fechaRaw)

    for (let i = 1; i < headers.length; i++) {
      const producto = headers[i]
      if (!producto) continue
      const categoria = PRODUCT_CATEGORY[producto]
      if (!categoria) {
        if (!unknown.includes(producto)) unknown.push(producto)
        continue
      }
      rows.push({
        fecha,
        categoria,
        producto,
        valor: parseValor(cols[i] ?? ''),
      })
    }
  }

  if (unknown.length) {
    throw new Error(`Unknown product columns (add to PRODUCT_CATEGORY): ${unknown.join(', ')}`)
  }

  return rows
}

async function main() {
  const csvPath = resolve(
    process.argv[2] ??
      `${process.env.HOME}/Downloads/Índice_de_precios_de_insumos_agrícolas_20260728.csv`
  )

  console.log(`Reading ${csvPath}`)
  const rows = await meltCsv(csvPath)
  console.log(`Melted ${rows.length} rows`)

  const supabase = createSupabaseAdmin()
  await upsertIndiceRows(supabase, rows)

  const { count, error: countError } = await supabase
    .from('insumo_precio_indice')
    .select('*', { count: 'exact', head: true })

  if (countError) {
    throw new Error(`Count failed: ${countError.message}`)
  }

  console.log(`Done — table has ${count} row(s)`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
