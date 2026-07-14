import { createClient } from "@supabase/supabase-js"

/** Service-role client for trusted server jobs only. Never expose to the browser. */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      // Avoid requiring a WebSocket polyfill in Node route handlers.
      params: { eventsPerSecond: -1 },
    },
  })
}
