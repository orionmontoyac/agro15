import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

export function createSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL in environment (.env.local)')
  }

  if (
    url.includes('YOUR_PROJECT_REF') ||
    url.includes('your-project-ref') ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)
  ) {
    throw new Error(
      'Invalid SUPABASE_URL. Use https://<project-ref>.supabase.co from Supabase Dashboard → Project Settings → API → Project URL'
    )
  }

  if (
    !serviceRoleKey ||
    serviceRoleKey.includes('YOUR_SERVICE_ROLE_KEY') ||
    serviceRoleKey === 'your-service-role-key'
  ) {
    throw new Error(
      'Missing or placeholder SUPABASE_SERVICE_ROLE_KEY. Reveal the service_role key under Supabase Dashboard → Project Settings → API.'
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: ws,
    },
  })
}
