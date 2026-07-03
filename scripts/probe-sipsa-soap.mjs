#!/usr/bin/env node
/**
 * Probe SIPSA SOAP abastecimiento API (promedioAbasSipsaMesMadr).
 *
 * Usage: node scripts/probe-sipsa-soap.mjs
 */

import { fetchSipsaAbastecimiento } from './lib/sipsa-soap-fetch.mjs'
import { AGRO15_SYNC_PRODUCT_CODES } from './lib/agro15-products.mjs'

const TRACKED_MARKET_PATTERNS = [
  { label: 'Medellín', test: /medell[ií]n|central mayorista de antioquia/i },
  { label: 'Bogotá', test: /bogot[aá]|corabastos/i },
]

function main() {
  console.log('Fetching promedioAbasSipsaMesMadr…')

  fetchSipsaAbastecimiento()
    .then((rows) => {
      console.log(`Total rows: ${rows.length}`)

      const markets = new Map()
      for (const row of rows) {
        const key = `${row.fuenId ?? '?'}:${row.fuenNombre ?? '?'}`
        markets.set(key, (markets.get(key) ?? 0) + 1)
      }

      console.log(`\nUnique markets (fuenId:fuenNombre): ${markets.size}`)
      const sortedMarkets = [...markets.entries()].sort((a, b) => b[1] - a[1])
      for (const [key, count] of sortedMarkets.slice(0, 20)) {
        console.log(`  ${count} rows — ${key}`)
      }

      console.log('\nTracked markets:')
      for (const { label, test } of TRACKED_MARKET_PATTERNS) {
        const matched = rows.filter((r) => test.test(r.fuenNombre ?? ''))
        const months = new Set(matched.map((r) => r.fechaMesIni?.slice(0, 7)))
        console.log(`  ${label}: ${matched.length} rows, ${months.size} month(s)`)
      }

      console.log('\nAgro15 products (latest month per tracked market):')
      for (const code of AGRO15_SYNC_PRODUCT_CODES) {
        for (const { label, test } of TRACKED_MARKET_PATTERNS) {
          const productRows = rows
            .filter(
              (r) =>
                String(r.artiId) === code && test.test(r.fuenNombre ?? '')
            )
            .sort((a, b) => (b.fechaMesIni ?? '').localeCompare(a.fechaMesIni ?? ''))
          const latest = productRows[0]
          if (latest) {
            console.log(
              `  ${code} @ ${label}: ${latest.cantidadTon} t (${latest.fechaMesIni?.slice(0, 7)}) — ${latest.fuenNombre}`
            )
          }
        }
      }

      console.log('\nSample row:')
      console.log(JSON.stringify(rows[0], null, 2))
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    })
}

main()
