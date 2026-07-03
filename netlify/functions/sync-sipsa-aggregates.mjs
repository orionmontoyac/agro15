import { AGRO15_SYNC_PRODUCT_CODES } from '../../scripts/lib/agro15-products.mjs'
import { createSupabaseAdmin } from '../../scripts/lib/supabase-admin.mjs'
import { syncAllAggregates } from '../../scripts/lib/sync-sipsa-aggregates-core.mjs'

function getReportTypesForToday() {
  const now = new Date()
  const reportTypes = []

  if (now.getUTCDay() === 1) {
    reportTypes.push('week')
  }

  if (now.getUTCDate() === 9) {
    reportTypes.push('month')
  }

  return reportTypes
}

export default async function handler() {
  const reportTypes = getReportTypesForToday()

  if (reportTypes.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, skipped: true, message: 'Not a sync day' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createSupabaseAdmin()
  const results = await syncAllAggregates({
    supabase,
    productCodes: AGRO15_SYNC_PRODUCT_CODES,
    reportTypes,
  })

  const totalRows = results.reduce((sum, row) => sum + (row.totalRows ?? 0), 0)
  const failures = results.filter((row) => row.error)

  const payload = {
    ok: failures.length === 0,
    reportTypes,
    totalRows,
    results,
  }

  console.log(JSON.stringify(payload))

  return new Response(JSON.stringify(payload), {
    status: failures.length === 0 ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  })
}
