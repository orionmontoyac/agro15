import { createSupabaseAdmin } from '../../scripts/lib/supabase-admin.mjs'
import { syncSiataRain } from '../../scripts/lib/sync-siata-rain-core.mjs'

export default async function handler() {
  const supabase = createSupabaseAdmin()

  try {
    const result = await syncSiataRain({ supabase, log: console.log })
    console.log(JSON.stringify(result))

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed'
    console.error(message)

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
