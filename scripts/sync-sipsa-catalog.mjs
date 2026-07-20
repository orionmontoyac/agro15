#!/usr/bin/env node
/**
 * sync-sipsa-catalog.mjs
 *
 * Fetches SIPSA catalog data for tracked locations and upserts into Supabase:
 *   sipsa_departments, sipsa_municipalities, sipsa_products
 *
 * Usage:
 *   npm run sync:sipsa-catalog
 *   npm run sync:sipsa-catalog -- --offline   # seed tracked Agro15 catalog without SIPSA API
 *
 * Requires .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import {
  fetchSipsaDepartments,
  fetchSipsaMunicipalitiesByDepartment,
  fetchSipsaProductsByCity,
  isRetryableSipsaError,
} from './lib/sipsa-fetch.mjs'
import { AGRO15_PRODUCTS, AGRO15_SYNC_PRODUCT_CODES } from './lib/agro15-products.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

const TRACKED_DEPARTMENTS = [
  { department_code: '05', department_name: 'Antioquia' },
  { department_code: '11', department_name: 'Bogotá, D.C.' },
]

const TRACKED_MUNICIPALITIES = [
  {
    municipality_code: '05001',
    municipality_name: 'Medellín',
    department_code: '05',
  },
  {
    municipality_code: '11001',
    municipality_name: 'Bogotá, D.C.',
    department_code: '11',
  },
]

const TRACKED_DEPARTMENT_CODES = TRACKED_DEPARTMENTS.map(
  (row) => row.department_code
)
const TRACKED_MUNICIPALITY_CODES = TRACKED_MUNICIPALITIES.map(
  (row) => row.municipality_code
)

function parseArgs(argv) {
  return {
    offline: argv.includes('--offline') || argv.includes('--seed'),
  }
}

async function upsertDepartmentRows(supabase, tracked) {
  const { error } = await supabase.from('sipsa_departments').upsert(
    tracked.map((row) => ({
      department_code: row.department_code,
      department_name: row.department_name,
    })),
    { onConflict: 'department_code' }
  )

  if (error) {
    const hint =
      error.message.includes('<!DOCTYPE html>') || error.message.includes('<html')
        ? ' Check SUPABASE_URL is https://<project-ref>.supabase.co (not the dashboard URL).'
        : ''
    throw new Error(
      `Failed to upsert departments: ${error.message.slice(0, 200)}${hint}`
    )
  }

  const { data: rows, error: selectError } = await supabase
    .from('sipsa_departments')
    .select('id, department_code')
    .in('department_code', TRACKED_DEPARTMENT_CODES)

  if (selectError) {
    throw new Error(`Failed to load department ids: ${selectError.message}`)
  }

  const idByCode = new Map(
    (rows ?? []).map((row) => [row.department_code, row.id])
  )

  return { count: tracked.length, idByCode }
}

async function upsertDepartmentsFromSipsa(supabase) {
  const allDepartments = await fetchSipsaDepartments()
  const tracked = allDepartments.filter((row) =>
    TRACKED_DEPARTMENT_CODES.includes(row.department_code)
  )

  if (tracked.length === 0) {
    throw new Error(
      `No tracked departments found in SIPSA response (expected ${TRACKED_DEPARTMENT_CODES.join(', ')})`
    )
  }

  return upsertDepartmentRows(supabase, tracked)
}

async function upsertDepartmentsOffline(supabase) {
  return upsertDepartmentRows(supabase, TRACKED_DEPARTMENTS)
}

async function upsertMunicipalitiesFromSipsa(supabase, idByCode) {
  const municipalities = []

  for (const departmentCode of TRACKED_DEPARTMENT_CODES) {
    const departmentId = idByCode.get(departmentCode)
    if (departmentId == null) {
      throw new Error(`Department id not found for code ${departmentCode}`)
    }

    const cities = await fetchSipsaMunicipalitiesByDepartment(departmentCode)
    const tracked = cities.filter((row) =>
      TRACKED_MUNICIPALITY_CODES.includes(row.municipality_code)
    )

    for (const city of tracked) {
      municipalities.push({
        municipality_code: city.municipality_code,
        municipality_name: city.municipality_name,
        department_id: departmentId,
      })
    }
  }

  if (municipalities.length === 0) {
    throw new Error(
      `No tracked municipalities found (expected ${TRACKED_MUNICIPALITY_CODES.join(', ')})`
    )
  }

  const { error } = await supabase
    .from('sipsa_municipalities')
    .upsert(municipalities, { onConflict: 'municipality_code' })

  if (error) {
    throw new Error(`Failed to upsert municipalities: ${error.message}`)
  }

  return { count: municipalities.length, rows: municipalities }
}

async function upsertMunicipalitiesOffline(supabase, idByCode) {
  const municipalities = TRACKED_MUNICIPALITIES.map((row) => {
    const departmentId = idByCode.get(row.department_code)
    if (departmentId == null) {
      throw new Error(`Department id not found for code ${row.department_code}`)
    }

    return {
      municipality_code: row.municipality_code,
      municipality_name: row.municipality_name,
      department_id: departmentId,
    }
  })

  const { error } = await supabase
    .from('sipsa_municipalities')
    .upsert(municipalities, { onConflict: 'municipality_code' })

  if (error) {
    throw new Error(`Failed to upsert municipalities: ${error.message}`)
  }

  return { count: municipalities.length, rows: municipalities }
}

async function upsertProductsFromSipsa(supabase) {
  const productByCode = new Map()

  for (const municipalityCode of TRACKED_MUNICIPALITY_CODES) {
    console.log(`  Fetching products for municipality ${municipalityCode}...`)
    const products = await fetchSipsaProductsByCity(municipalityCode)

    for (const product of products) {
      if (!product.product_code) continue
      productByCode.set(product.product_code, {
        product_code: product.product_code,
        product_name: product.product_name,
      })
    }
  }

  // Always ensure Agro15 tracked products exist even if a city response omits one.
  for (const product of AGRO15_PRODUCTS) {
    if (!productByCode.has(product.code)) {
      productByCode.set(product.code, {
        product_code: product.code,
        product_name: product.name,
      })
    }
  }

  const rows = [...productByCode.values()]

  if (rows.length === 0) {
    throw new Error('No products returned from SIPSA for tracked municipalities')
  }

  const { error } = await supabase
    .from('sipsa_products')
    .upsert(rows, { onConflict: 'product_code' })

  if (error) {
    throw new Error(`Failed to upsert products: ${error.message}`)
  }

  return { count: rows.length, rows }
}

async function upsertProductsOffline(supabase) {
  const rows = AGRO15_PRODUCTS.map((product) => ({
    product_code: product.code,
    product_name: product.name,
  }))

  const { error } = await supabase
    .from('sipsa_products')
    .upsert(rows, { onConflict: 'product_code' })

  if (error) {
    throw new Error(`Failed to upsert products: ${error.message}`)
  }

  return { count: rows.length, rows }
}

async function runOfflineCatalog(supabase) {
  console.log('Mode: offline (seed tracked Agro15 catalog without SIPSA API)\n')

  console.log('Step 1: Departments')
  const { count: deptCount, idByCode } = await upsertDepartmentsOffline(supabase)
  console.log(`  Upserted ${deptCount} department(s)\n`)

  console.log('Step 2: Municipalities')
  const { count: munCount, rows: municipalities } =
    await upsertMunicipalitiesOffline(supabase, idByCode)
  console.log(`  Upserted ${munCount} municipality/municipalities\n`)

  console.log('Step 3: Products')
  const { count: prodCount, rows: products } =
    await upsertProductsOffline(supabase)
  console.log(`  Upserted ${prodCount} product(s)\n`)

  return { deptCount, munCount, prodCount, municipalities, products }
}

async function runOnlineCatalog(supabase) {
  console.log('Mode: online (fetch from SIPSA REST API)\n')

  console.log('Step 1: Departments')
  const { count: deptCount, idByCode } = await upsertDepartmentsFromSipsa(supabase)
  console.log(`  Upserted ${deptCount} department(s)\n`)

  console.log('Step 2: Municipalities')
  const { count: munCount, rows: municipalities } =
    await upsertMunicipalitiesFromSipsa(supabase, idByCode)
  console.log(`  Upserted ${munCount} municipality/municipalities\n`)

  console.log('Step 3: Products')
  const { count: prodCount, rows: products } =
    await upsertProductsFromSipsa(supabase)
  console.log(`  Upserted ${prodCount} product(s)\n`)

  return { deptCount, munCount, prodCount, municipalities, products }
}

function printSummary({ deptCount, munCount, prodCount, municipalities, products }) {
  console.log('=== Summary ===')
  console.log(`Departments:     ${deptCount}`)
  console.log(`Municipalities:  ${munCount}`)
  console.log(`Products:        ${prodCount}`)

  console.log('\nMunicipalities synced:')
  for (const row of municipalities) {
    console.log(`  ${row.municipality_code} — ${row.municipality_name}`)
  }

  console.log('\nAgro15 fruit products:')
  for (const code of AGRO15_SYNC_PRODUCT_CODES) {
    const product = products.find((row) => row.product_code === code)
    if (product) {
      console.log(`  ${code} — ${product.product_name}`)
    } else {
      console.log(`  ${code} — (not found in SIPSA response)`)
    }
  }

  console.log('\nDone.')
}

async function main() {
  console.log('=== SIPSA catalog sync → Supabase ===\n')

  const { offline } = parseArgs(process.argv.slice(2))
  const supabase = createSupabaseAdmin()

  if (offline) {
    printSummary(await runOfflineCatalog(supabase))
    return
  }

  try {
    printSummary(await runOnlineCatalog(supabase))
  } catch (error) {
    if (!isRetryableSipsaError(error)) throw error

    console.warn(
      `\nSIPSA REST API unreachable (${error.message.slice(0, 160)}…).`
    )
    console.warn(
      'Falling back to offline seed of tracked departments, municipalities, and Agro15 products.\n'
    )
    printSummary(await runOfflineCatalog(supabase))
    console.warn(
      '\nNote: price sync still needs sen.dane.gov.co. Retry npm run sync:sipsa-prices when the host recovers.'
    )
  }
}

main().catch((error) => {
  console.error('\nSync failed:', error.message)
  process.exit(1)
})
