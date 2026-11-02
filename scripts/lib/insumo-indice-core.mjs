/**
 * Sync UPRA agroinsumo price indices (base ene-2021=100) from datos.gov.co
 * into public.insumo_precio_indice:
 *   - gwbi-fnzs  Índice de precios de insumos agrícolas (fertilizantes, plaguicidas, otros)
 *   - wgj6-cvyj  Índice de precios de alimentos balanceados para animales (ABA)
 *
 * Both datasets are wide (one column per product); we melt them to long rows.
 */

const SOCRATA_BASE = 'https://www.datos.gov.co'
const FETCH_TIMEOUT_MS = 30_000
/** UPRA occasionally revises recent months — re-fetch this many back. */
const REVISION_WINDOW_MONTHS = 3

/** Column display name (as in UPRA CSV / Socrata `name`) → categoria. */
/** @type {Record<string, string>} */
export const PRODUCT_CATEGORY = {
  Indice_total: 'total',
  Total_Fertilizantes: 'fertilizantes',
  Total_Plaguicidas: 'plaguicidas',
  Total_Otros: 'otros',
  Total_Simples: 'fertilizantes_simples',
  Total_Compuestos: 'fertilizantes_compuestos',
  Total_Herbicidas: 'herbicidas',
  Total_Fungicidas: 'fungicidas',
  Total_Insecticidas: 'insecticidas',
  Total_Coadyuvantes: 'coadyuvantes',
  Total_Reguladores: 'reguladores',
  Total_Molusquicidas: 'molusquicidas',
  'Urea 46%': 'fertilizantes_simples',
  'Urea sulfato': 'fertilizantes_simples',
  'DAP 18-46': 'fertilizantes_simples',
  'KCL 0-0-60': 'fertilizantes_simples',
  SAM: 'fertilizantes_simples',
  '15-15-15': 'fertilizantes_compuestos',
  '25-4-24': 'fertilizantes_compuestos',
  '17-6-18-2': 'fertilizantes_compuestos',
  '18-18-18': 'fertilizantes_compuestos',
  '31-8-8': 'fertilizantes_compuestos',
  '12-24-12': 'fertilizantes_compuestos',
  '13-26-6': 'fertilizantes_compuestos',
  '15-4-23': 'fertilizantes_compuestos',
  '10-20-30': 'fertilizantes_compuestos',
  '28-4-0-6': 'fertilizantes_compuestos',
  Glifosato: 'herbicidas',
  Paraquat: 'herbicidas',
  Propanil: 'herbicidas',
  '2,4-D + picloram': 'herbicidas',
  '2,4-D': 'herbicidas',
  'Aminopiralid + 2,4-D': 'herbicidas',
  Diuron: 'herbicidas',
  'Glufosinato de amonio': 'herbicidas',
  Picloram: 'herbicidas',
  Oxadiazon: 'herbicidas',
  'Metsulfuron metil': 'herbicidas',
  Pendimetalin: 'herbicidas',
  Clorotalonil: 'fungicidas',
  Difenoconazol: 'fungicidas',
  Mancozeb: 'fungicidas',
  'Mancozeb + cimoxanil': 'fungicidas',
  'Azoxistrobin + difenoconazol': 'fungicidas',
  Dimetomorf: 'fungicidas',
  'Tebuconazol + trifloxistrobin': 'fungicidas',
  'Propineb + fluopicolide': 'fungicidas',
  'Mancozeb + metalaxil-m': 'fungicidas',
  Clorpirifos: 'insecticidas',
  Fipronil: 'insecticidas',
  Metomil: 'insecticidas',
  'Tiametoxam + lambdacihalotrina': 'insecticidas',
  Abamectina: 'insecticidas',
  Imidacloprid: 'insecticidas',
  'Profenofos + cipermetrina': 'insecticidas',
  Cipermetrina: 'insecticidas',
  Profenofos: 'insecticidas',
}

/** Socrata fieldName → { producto, categoria } for the ABA dataset. */
/** @type {Record<string, { producto: string, categoria: string }>} */
export const ABA_COLUMNS = {
  indice_total: { producto: 'Total_Alimentos_balanceados', categoria: 'alimentos_balanceados' },
  indice_acu_cultura: { producto: 'ABA Acuicultura', categoria: 'alimentos_balanceados' },
  indice_avicultura: { producto: 'ABA Avicultura', categoria: 'alimentos_balanceados' },
  indice_bovinos: { producto: 'ABA Bovinos', categoria: 'alimentos_balanceados' },
  indice_porcicultura: { producto: 'ABA Porcicultura', categoria: 'alimentos_balanceados' },
}

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   categorias: string[],
 *   resolve: (fieldName: string, displayName: string) => { producto: string, categoria: string } | null,
 * }} IndiceDataset
 */

/** @type {IndiceDataset[]} */
export const INDICE_DATASETS = [
  {
    id: 'gwbi-fnzs',
    label: 'insumos agrícolas',
    categorias: [...new Set(Object.values(PRODUCT_CATEGORY))],
    resolve: (_field, name) =>
      PRODUCT_CATEGORY[name] ? { producto: name, categoria: PRODUCT_CATEGORY[name] } : null,
  },
  {
    id: 'wgj6-cvyj',
    label: 'alimentos balanceados (ABA)',
    categorias: ['alimentos_balanceados'],
    resolve: (field) => ABA_COLUMNS[field] ?? null,
  },
]

/**
 * UPRA uses 0 for "sin reporte".
 * @param {unknown} raw
 * @returns {number | null}
 */
export function parseValor(raw) {
  const t = String(raw ?? '').trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  if (!Number.isFinite(n) || n === 0) return null
  return Math.round(n * 100) / 100
}

/**
 * @param {string} url
 * @returns {Promise<any>}
 */
async function fetchJson(url) {
  /** @type {Record<string, string>} */
  const headers = { Accept: 'application/json' }
  if (process.env.SOCRATA_APP_TOKEN) {
    headers['X-App-Token'] = process.env.SOCRATA_APP_TOKEN
  }

  let lastError
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`)
      }
      return await res.json()
    } catch (error) {
      lastError = error
      if (attempt < 2) await new Promise((r) => setTimeout(r, 2000))
    }
  }
  throw lastError
}

/**
 * @param {string} datasetId
 * @returns {Promise<Map<string, string>>} Socrata fieldName → display name
 */
async function fetchColumnNames(datasetId) {
  const meta = await fetchJson(`${SOCRATA_BASE}/api/views/${datasetId}.json`)
  /** @type {Map<string, string>} */
  const map = new Map()
  for (const col of meta.columns ?? []) {
    if (col.fieldName && col.name) map.set(col.fieldName, col.name)
  }
  return map
}

/**
 * Fetch and melt one UPRA index dataset.
 * @param {{ dataset?: IndiceDataset, since?: string | null, log?: (msg: string) => void }} [opts]
 * @returns {Promise<Array<{ fecha: string, categoria: string, producto: string, valor: number | null }>>}
 */
export async function fetchIndiceRows({
  dataset = INDICE_DATASETS[0],
  since = null,
  log = console.log,
} = {}) {
  const columns = await fetchColumnNames(dataset.id)

  const params = new URLSearchParams({ $order: 'fecha', $limit: '5000' })
  if (since) params.set('$where', `fecha >= '${since}T00:00:00.000'`)
  const data = await fetchJson(
    `${SOCRATA_BASE}/resource/${dataset.id}.json?${params}`
  )

  /** @type {Array<{ fecha: string, categoria: string, producto: string, valor: number | null }>} */
  const rows = []
  /** @type {Set<string>} */
  const unknown = new Set()

  for (const record of data) {
    if (!record.fecha) continue
    const fecha = `${String(record.fecha).slice(0, 7)}-01`

    for (const [field, raw] of Object.entries(record)) {
      if (field === 'fecha' || field.startsWith(':')) continue
      const resolved = dataset.resolve(field, columns.get(field) ?? field)
      if (!resolved) {
        unknown.add(columns.get(field) ?? field)
        continue
      }
      rows.push({ fecha, ...resolved, valor: parseValor(raw) })
    }
  }

  if (unknown.size) {
    log(
      `Warning: skipped unknown ${dataset.id} columns: ${[...unknown].join(', ')}`
    )
  }

  return rows
}

/**
 * @param {string} isoDate YYYY-MM-DD
 * @param {number} months
 */
function subtractMonths(isoDate, months) {
  const [y, m] = isoDate.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 - months, 1))
  return d.toISOString().slice(0, 10)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string[]} categorias
 * @returns {Promise<string | null>}
 */
async function getLatestFecha(supabase, categorias) {
  const { data, error } = await supabase
    .from('insumo_precio_indice')
    .select('fecha')
    .in('categoria', categorias)
    .order('fecha', { ascending: false })
    .limit(1)
  if (error) throw new Error(`Read latest fecha failed: ${error.message}`)
  return data?.[0]?.fecha ?? null
}

/**
 * Upsert melted rows in batches.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ fecha: string, categoria: string, producto: string, valor: number | null }>} rows
 * @param {(msg: string) => void} [log]
 */
export async function upsertIndiceRows(supabase, rows, log = console.log) {
  const batchSize = 500
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('insumo_precio_indice')
      .upsert(batch, { onConflict: 'fecha,producto' })
    if (error) throw new Error(`Upsert failed at offset ${i}: ${error.message}`)
    log(`Upserted ${Math.min(i + batchSize, rows.length)}/${rows.length}`)
  }
}

/**
 * Sync every UPRA index dataset. Incremental unless `full`.
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, full?: boolean, log?: (msg: string) => void }} opts
 * @returns {Promise<{ rows: number, latestFecha: string | null, datasets: Array<{ id: string, rows: number, since: string | null, latestFecha: string | null }> }>}
 */
export async function syncInsumoIndice({ supabase, full = false, log = console.log }) {
  const datasets = []

  for (const dataset of INDICE_DATASETS) {
    const stored = full ? null : await getLatestFecha(supabase, dataset.categorias)
    const since = stored ? subtractMonths(stored, REVISION_WINDOW_MONTHS) : null

    log(`Fetching UPRA ${dataset.label} (${dataset.id}) ${since ? `since ${since}` : '(full series)'}`)
    const rows = await fetchIndiceRows({ dataset, since, log })
    log(`Melted ${rows.length} row(s)`)

    if (rows.length) await upsertIndiceRows(supabase, rows, log)

    const latestFecha = rows.reduce((max, r) => (r.fecha > max ? r.fecha : max), stored ?? '')
    datasets.push({ id: dataset.id, rows: rows.length, since, latestFecha: latestFecha || null })
  }

  return {
    rows: datasets.reduce((n, d) => n + d.rows, 0),
    latestFecha: datasets.reduce((max, d) => (d.latestFecha && d.latestFecha > max ? d.latestFecha : max), '') || null,
    datasets,
  }
}
