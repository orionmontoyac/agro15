import { createSupabaseAdmin } from '../../scripts/lib/supabase-admin.mjs'
import { syncSiataRain } from '../../scripts/lib/sync-siata-rain-core.mjs'

function serializeError(error) {
  if (!(error instanceof Error)) {
    return { errorType: typeof error, errorValue: String(error) }
  }

  return {
    errorName: error.name,
    errorMessage: error.message,
    cause:
      error.cause instanceof Error
        ? error.cause.message
        : error.cause != null
          ? String(error.cause)
          : undefined,
    stack: error.stack?.split('\n').slice(0, 4).join(' | '),
  }
}

export default async function handler() {
  const requestId = crypto.randomUUID().slice(0, 8)
  const startedAt = Date.now()

  console.log(
    `[sync-siata-rain] Scheduled sync started ${JSON.stringify({ requestId })}`
  )

  const supabase = createSupabaseAdmin()

  try {
    const result = await syncSiataRain({
      supabase,
      log: (message) => console.log(message),
    })

    console.log(
      `[sync-siata-rain] Scheduled sync finished ${JSON.stringify({
        requestId,
        durationMs: Date.now() - startedAt,
        ...result,
      })}`
    )

    return new Response(JSON.stringify({ ...result, requestId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(
      `[sync-siata-rain] Scheduled sync failed ${JSON.stringify({
        requestId,
        durationMs: Date.now() - startedAt,
        ...serializeError(error),
      })}`
    )

    const message = error instanceof Error ? error.message : 'Sync failed'

    return new Response(
      JSON.stringify({ ok: false, error: message, requestId }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
