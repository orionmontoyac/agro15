import { AGRO15_PRODUCTS } from './agro15-products.mjs'

export const TRACKED_DEPARTMENTS = [
  { department_code: '05', department_name: 'Antioquia' },
  { department_code: '11', department_name: 'Bogotá, D.C.' },
]

export const TRACKED_MUNICIPALITIES = [
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

function formatSupabaseError(error) {
  const message = error?.message ?? String(error)
  if (
    message.includes('schema cache') ||
    message.includes('Could not find the table')
  ) {
    return `${message} (wrong Supabase project or stale PostgREST cache — scripts now force-load repo .env.local; unset shell SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY if they point elsewhere)`
  }
  return message
}

export function normalizeProductCode(productCode) {
  return String(productCode ?? '').trim()
}

export function findAgro15Product(productCode) {
  const code = normalizeProductCode(productCode)
  return AGRO15_PRODUCTS.find((product) => product.code === code) ?? null
}

/**
 * Ensures tracked departments, municipalities, and the requested Agro15 product
 * exist so price sync does not depend on a separate catalog run.
 */
export async function ensureTrackedCatalog(supabase, productCode, { log = () => {} } = {}) {
  const code = normalizeProductCode(productCode)
  const agro15 = findAgro15Product(code)

  const { error: deptError } = await supabase.from('sipsa_departments').upsert(
    TRACKED_DEPARTMENTS.map((row) => ({
      department_code: row.department_code,
      department_name: row.department_name,
    })),
    { onConflict: 'department_code' }
  )
  if (deptError) {
    throw new Error(
      `Failed to ensure departments: ${formatSupabaseError(deptError)}`
    )
  }

  const { data: departments, error: deptSelectError } = await supabase
    .from('sipsa_departments')
    .select('id, department_code')
    .in(
      'department_code',
      TRACKED_DEPARTMENTS.map((row) => row.department_code)
    )

  if (deptSelectError) {
    throw new Error(
      `Failed to load departments after upsert: ${formatSupabaseError(deptSelectError)}`
    )
  }

  const idByCode = new Map(
    (departments ?? []).map((row) => [row.department_code, row.id])
  )

  const municipalities = TRACKED_MUNICIPALITIES.map((row) => {
    const departmentId = idByCode.get(row.department_code)
    if (departmentId == null) {
      throw new Error(
        `Department ${row.department_code} missing after upsert — check DB access/schema.`
      )
    }
    return {
      municipality_code: row.municipality_code,
      municipality_name: row.municipality_name,
      department_id: departmentId,
    }
  })

  const { error: munError } = await supabase
    .from('sipsa_municipalities')
    .upsert(municipalities, { onConflict: 'municipality_code' })

  if (munError) {
    throw new Error(
      `Failed to ensure municipalities: ${formatSupabaseError(munError)}`
    )
  }

  if (agro15) {
    const { error: productError } = await supabase.from('sipsa_products').upsert(
      {
        product_code: agro15.code,
        product_name: agro15.name,
      },
      { onConflict: 'product_code' }
    )

    if (productError) {
      throw new Error(
        `Failed to ensure product ${agro15.code}: ${formatSupabaseError(productError)}`
      )
    }

    log(`Ensured catalog rows for ${agro15.name} (${agro15.code})`)
  }

  return { code, agro15 }
}

export { formatSupabaseError }
