import { createSupabaseAdmin } from './lib/supabase-admin.mjs'
import {
  syncSiataRain,
  URRAO_STATION_CODE,
} from './lib/sync-siata-rain-core.mjs'

const stationCode = process.argv[2] ?? URRAO_STATION_CODE

const supabase = createSupabaseAdmin()

try {
  const result = await syncSiataRain({
    supabase,
    stationCode,
    log: console.log,
  })
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
