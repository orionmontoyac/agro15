import { createSupabaseAdmin } from '../../scripts/lib/supabase-admin.mjs'
import { syncAllSupply } from '../../scripts/lib/sync-sipsa-supply-core.mjs'

export default async function handler() {
  const supabase = createSupabaseAdmin()
  const result = await syncAllSupply({ supabase })

  const payload = {
    ok: true,
    totalRows: result.totalRows,
    soapRows: result.soapRows,
  }

  console.log(JSON.stringify(payload))

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
