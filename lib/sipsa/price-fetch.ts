import { createClient } from "@/lib/supabase/server"

import { type ChartPoint } from "./chart-series"
import { BOGOTA_CODE, MEDELLIN_CODE } from "./constants"

export type { ChartPoint } from "./chart-series"

export type RawPriceRow = {
  date: string
  price: number
  product_id: number
  sipsa_products: { product_code: string; product_name: string } | null
  sipsa_municipalities: {
    municipality_code: string
    municipality_name: string
  } | null
}

export function normalizePriceRow(row: Record<string, unknown>): RawPriceRow {
  const products = row.sipsa_products
  const municipalities = row.sipsa_municipalities

  const product =
    Array.isArray(products) && products.length > 0
      ? (products[0] as { product_code: string; product_name: string })
      : products && !Array.isArray(products)
        ? (products as { product_code: string; product_name: string })
        : null

  const municipality =
    Array.isArray(municipalities) && municipalities.length > 0
      ? (municipalities[0] as {
          municipality_code: string
          municipality_name: string
        })
      : municipalities && !Array.isArray(municipalities)
        ? (municipalities as {
            municipality_code: string
            municipality_name: string
          })
        : null

  return {
    date: String(row.date),
    price: Number(row.price),
    product_id: Number(row.product_id),
    sipsa_products: product,
    sipsa_municipalities: municipality,
  }
}

export function getStartDateIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export function computeTrend(
  current: number,
  previous: number | null
): string {
  if (previous === null || previous === 0) return "Estable"
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return "Estable"
  return pct > 0 ? "Subiendo" : "Bajando"
}

export function computeChangePct(
  current: number,
  previous: number | null
): number | null {
  if (previous === null || previous === 0) return null
  return ((current - previous) / previous) * 100
}

export function findPriceOnOrBefore(
  rows: RawPriceRow[],
  productCode: string,
  municipalityCode: string,
  targetDate: string
): number | null {
  const match = rows
    .filter(
      (r) =>
        r.sipsa_products?.product_code === productCode &&
        r.sipsa_municipalities?.municipality_code === municipalityCode &&
        r.date <= targetDate
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return match ? Number(match.price) : null
}

export function getLatestPriceForCity(
  rows: RawPriceRow[],
  productCode: string,
  municipalityCode: string
): { price: number; date: string } | null {
  const match = rows
    .filter(
      (r) =>
        r.sipsa_products?.product_code === productCode &&
        r.sipsa_municipalities?.municipality_code === municipalityCode
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (!match) return null
  return { price: Number(match.price), date: match.date }
}

export function getLatestPrice(
  rows: RawPriceRow[],
  productCode: string,
  preferredMunicipality: string
): { price: number; municipalityCode: string; date: string } | null {
  const productRows = rows.filter(
    (r) => r.sipsa_products?.product_code === productCode
  )
  if (productRows.length === 0) return null

  const preferred = productRows
    .filter(
      (r) =>
        r.sipsa_municipalities?.municipality_code === preferredMunicipality
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (preferred) {
    return {
      price: Number(preferred.price),
      municipalityCode: preferredMunicipality,
      date: preferred.date,
    }
  }

  const fallback = productRows.sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0]
  if (!fallback) return null

  return {
    price: Number(fallback.price),
    municipalityCode:
      fallback.sipsa_municipalities?.municipality_code ?? "",
    date: fallback.date,
  }
}

export function buildChartSeries(
  rows: RawPriceRow[],
  productCode: string
): ChartPoint[] {
  const filtered = rows.filter(
    (r) => r.sipsa_products?.product_code === productCode
  )
  const byDate = new Map<string, ChartPoint>()

  for (const row of filtered) {
    const code = row.sipsa_municipalities?.municipality_code
    if (!byDate.has(row.date)) {
      byDate.set(row.date, { date: row.date })
    }
    const point = byDate.get(row.date)!
    if (code === MEDELLIN_CODE) {
      point.medellin = Number(row.price)
    } else if (code === BOGOTA_CODE) {
      point.bogota = Number(row.price)
    }
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )
}

export const COMPARISON_DAYS = 30

export function getComparisonDateIso(daysAgo = COMPARISON_DAYS): string {
  const comparisonDate = new Date()
  comparisonDate.setDate(comparisonDate.getDate() - daysAgo)
  return comparisonDate.toISOString().slice(0, 10)
}

type FetchPriceRowsOptions = {
  productIds?: number[]
  days?: number
}

const PRODUCT_ID_BATCH_SIZE = 100

async function fetchPriceRowsBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: { productIds?: number[]; days: number }
): Promise<RawPriceRow[]> {
  const { productIds, days } = options
  const startIso = getStartDateIso(days)

  let query = supabase
    .from("sipsa_product_prices")
    .select(
      `
      date, price, product_id,
      sipsa_products ( product_code, product_name ),
      sipsa_municipalities ( municipality_code, municipality_name )
    `
    )
    .gte("date", startIso)
    .order("date", { ascending: true })

  if (productIds?.length) {
    query = query.in("product_id", productIds)
  }

  const { data, error } = await query

  if (error || !data?.length) {
    return []
  }

  return data.map((row) => normalizePriceRow(row as Record<string, unknown>))
}

export async function fetchPriceRows(
  options: FetchPriceRowsOptions = {}
): Promise<RawPriceRow[]> {
  const { productIds, days = 90 } = options
  const supabase = await createClient()

  if (!productIds?.length) {
    return fetchPriceRowsBatch(supabase, { days })
  }

  if (productIds.length <= PRODUCT_ID_BATCH_SIZE) {
    return fetchPriceRowsBatch(supabase, { productIds, days })
  }

  const rows: RawPriceRow[] = []
  for (let i = 0; i < productIds.length; i += PRODUCT_ID_BATCH_SIZE) {
    const chunk = productIds.slice(i, i + PRODUCT_ID_BATCH_SIZE)
    const batch = await fetchPriceRowsBatch(supabase, { productIds: chunk, days })
    rows.push(...batch)
  }

  return rows
}
