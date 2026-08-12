import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ENV_LOCAL_PATH = resolve(REPO_ROOT, '.env.local')

let envLocalLoaded = false

/**
 * Load repo `.env.local` when present, with override.
 * Node's `--env-file` does NOT overwrite existing shell vars, so a stray
 * SUPABASE_URL from another project silently breaks local SIPSA syncs.
 * On Netlify / CI the file is absent and platform env vars are used as-is.
 */
export function loadRepoEnvLocal({ override = true } = {}) {
  if (envLocalLoaded) return ENV_LOCAL_PATH
  envLocalLoaded = true
  if (!existsSync(ENV_LOCAL_PATH)) {
    return null
  }
  loadEnv({ path: ENV_LOCAL_PATH, override, quiet: true })
  return ENV_LOCAL_PATH
}

export function getSupabaseProjectRef(url = process.env.SUPABASE_URL) {
  const match = String(url ?? '').match(
    /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i
  )
  return match?.[1] ?? null
}

export function createSupabaseAdmin({ log = null } = {}) {
  loadRepoEnvLocal({ override: true })

  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('Missing SUPABASE_URL in environment (.env.local)')
  }

  if (
    url.includes('YOUR_PROJECT_REF') ||
    url.includes('your-project-ref') ||
    !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)
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

  const projectRef = getSupabaseProjectRef(url)
  if (typeof log === 'function' && projectRef) {
    log(`Supabase project: ${projectRef}`)
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
