import { createSupabaseAdmin } from '../../scripts/lib/supabase-admin.mjs'
import { syncInsumoIndice } from '../../scripts/lib/insumo-indice-core.mjs'

export default async function handler() {
  try {
    const supabase = createSupabaseAdmin()
    const result = await syncInsumoIndice({ supabase })

    const payload = { ok: true, ...result }
    console.log(JSON.stringify(payload))

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ ok: false, error: message }))

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
