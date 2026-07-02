import { AGRO15_SYNC_PRODUCT_CODES } from '../../scripts/lib/agro15-products.mjs'
import { createSupabaseAdmin } from '../../scripts/lib/supabase-admin.mjs'
import { syncAllProductsUpdate } from '../../scripts/lib/sync-sipsa-prices-core.mjs'

export default async function handler() {
  const supabase = createSupabaseAdmin()
  const results = await syncAllProductsUpdate({
    supabase,
    productCodes: AGRO15_SYNC_PRODUCT_CODES,
  })

  const failed = results.filter((result) => result.error)
  const totalRows = results.reduce((sum, result) => sum + result.totalRows, 0)

  console.log(
    JSON.stringify({
      ok: failed.length === 0,
      totalRows,
      productCount: results.length,
      failedCount: failed.length,
      results,
    })
  )

  return new Response(
    JSON.stringify({
      ok: failed.length === 0,
      totalRows,
      productCount: results.length,
      failedCount: failed.length,
      results,
    }),
    {
      status: failed.length === 0 ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    }
  )
}
