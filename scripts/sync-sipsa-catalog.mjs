#!/usr/bin/env node
/**
 * sync-sipsa-catalog.mjs
 *
 * Fetches SIPSA catalog data for tracked locations and upserts into Supabase:
 *   sipsa_departments, sipsa_municipalities, sipsa_products
 *
 * Usage:
 *   npm run sync:sipsa-catalog
 *
 * Requires .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import {
  fetchSipsaDepartments,
  fetchSipsaMunicipalitiesByDepartment,
  fetchSipsaProductsByCity,
} from './lib/sipsa-fetch.mjs'
import { createSupabaseAdmin } from './lib/supabase-admin.mjs'

const TRACKED_DEPARTMENTS = ['05', '11']
const TRACKED_MUNICIPALITIES = ['05001', '11001']
const AGRO15_PRODUCT_CODES = ['106', '46', '113']

async function upsertDepartments(supabase) {
  const allDepartments = await fetchSipsaDepartments()
  const tracked = allDepartments.filter((row) =>
    TRACKED_DEPARTMENTS.includes(row.department_code)
  )

  if (tracked.length === 0) {
    throw new Error(
      `No tracked departments found in SIPSA response (expected ${TRACKED_DEPARTMENTS.join(', ')})`
    )
  }

  const { error } = await supabase.from('sipsa_departments').upsert(
    tracked.map((row) => ({
      department_code: row.department_code,
      department_name: row.department_name,
    })),
    { onConflict: 'department_code' }
  )

  if (error) {
    throw new Error(`Failed to upsert departments: ${error.message}`)
  }

  const { data: rows, error: selectError } = await supabase
    .from('sipsa_departments')
    .select('id, department_code')
    .in('department_code', TRACKED_DEPARTMENTS)

  if (selectError) {
    throw new Error(`Failed to load department ids: ${selectError.message}`)
  }

  const idByCode = new Map(
    (rows ?? []).map((row) => [row.department_code, row.id])
  )

  return { count: tracked.length, idByCode }
}

async function upsertMunicipalities(supabase, idByCode) {
  const municipalities = []

  for (const departmentCode of TRACKED_DEPARTMENTS) {
    const departmentId = idByCode.get(departmentCode)
    if (departmentId == null) {
      throw new Error(`Department id not found for code ${departmentCode}`)
    }

    const cities = await fetchSipsaMunicipalitiesByDepartment(departmentCode)
    const tracked = cities.filter((row) =>
      TRACKED_MUNICIPALITIES.includes(row.municipality_code)
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
      `No tracked municipalities found (expected ${TRACKED_MUNICIPALITIES.join(', ')})`
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

async function upsertProducts(supabase) {
  const productByCode = new Map()

  for (const municipalityCode of TRACKED_MUNICIPALITIES) {
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

async function main() {
  console.log('=== SIPSA catalog sync → Supabase ===\n')

  const supabase = createSupabaseAdmin()

  console.log('Step 1: Departments')
  const { count: deptCount, idByCode } = await upsertDepartments(supabase)
  console.log(`  Upserted ${deptCount} department(s)\n`)

  console.log('Step 2: Municipalities')
  const { count: munCount, rows: municipalities } =
    await upsertMunicipalities(supabase, idByCode)
  console.log(`  Upserted ${munCount} municipality/municipalities\n`)

  console.log('Step 3: Products')
  const { count: prodCount, rows: products } = await upsertProducts(supabase)
  console.log(`  Upserted ${prodCount} product(s)\n`)

  console.log('=== Summary ===')
  console.log(`Departments:     ${deptCount}`)
  console.log(`Municipalities:  ${munCount}`)
  console.log(`Products:        ${prodCount}`)

  console.log('\nMunicipalities synced:')
  for (const row of municipalities) {
    console.log(`  ${row.municipality_code} — ${row.municipality_name}`)
  }

  console.log('\nAgro15 fruit products:')
  for (const code of AGRO15_PRODUCT_CODES) {
    const product = products.find((row) => row.product_code === code)
    if (product) {
      console.log(`  ${code} — ${product.product_name}`)
    } else {
      console.log(`  ${code} — (not found in SIPSA response)`)
    }
  }

  console.log('\nDone.')
}

main().catch((error) => {
  console.error('\nSync failed:', error.message)
  process.exit(1)
})
