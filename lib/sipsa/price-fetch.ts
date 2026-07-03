import { createClient } from "@/lib/supabase/server"

import { type ChartPoint } from "./chart-series"
import { BOGOTA_CODE, MEDELLIN_CODE } from "./constants"

export type { ChartPoint } from "./chart-series"

export type ReportType = "day" | "week" | "month"

export type RawPriceRow = {
  date: string
  price: number
  price_min: number | null
  price_max: number | null
  daily_variation: number | null
  report_type: ReportType
  product_id: number
  sipsa_products: { product_code: string; product_name: string } | null
  sipsa_municipalities: {
    municipality_code: string
    municipality_name: string
    market_name: string | null
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
          market_name: string | null
        })
      : municipalities && !Array.isArray(municipalities)
        ? (municipalities as {
            municipality_code: string
            municipality_name: string
            market_name: string | null
          })
        : null

  const optionalNumber = (value: unknown): number | null => {
    if (value == null || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return {
    date: String(row.date),
    price: Number(row.price),
    price_min: optionalNumber(row.price_min),
    price_max: optionalNumber(row.price_max),
    daily_variation: optionalNumber(row.daily_variation),
    report_type: (row.report_type as ReportType) ?? "day",
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
        r.report_type === "day" &&
        r.sipsa_products?.product_code === productCode &&
        r.sipsa_municipalities?.municipality_code === municipalityCode &&
        r.date <= targetDate
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  return match ? Number(match.price) : null
}

export type LatestCityPrice = {
  price: number
  date: string
  priceMin: number | null
  priceMax: number | null
  marketName: string | null
}

export function getLatestPriceForCity(
  rows: RawPriceRow[],
  productCode: string,
  municipalityCode: string,
  reportType: ReportType = "day"
): LatestCityPrice | null {
  const match = rows
    .filter(
      (r) =>
        r.report_type === reportType &&
        r.sipsa_products?.product_code === productCode &&
        r.sipsa_municipalities?.municipality_code === municipalityCode
    )
    .sort((a, b) => b.date.localeCompare(a.date))[0]

  if (!match) return null
  return {
    price: Number(match.price),
    date: match.date,
    priceMin: match.price_min,
    priceMax: match.price_max,
    marketName: match.sipsa_municipalities?.market_name ?? null,
  }
}

export function getLatestPrice(
  rows: RawPriceRow[],
  productCode: string,
  preferredMunicipality: string
): { price: number; municipalityCode: string; date: string } | null {
  const productRows = rows.filter(
    (r) =>
      r.report_type === "day" &&
      r.sipsa_products?.product_code === productCode
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
  productCode: string,
  reportType: ReportType = "day"
): ChartPoint[] {
  const filtered = rows.filter(
    (r) =>
      r.report_type === reportType &&
      r.sipsa_products?.product_code === productCode
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
      if (row.price_min != null) point.medellinMin = row.price_min
      if (row.price_max != null) point.medellinMax = row.price_max
    } else if (code === BOGOTA_CODE) {
      point.bogota = Number(row.price)
      if (row.price_min != null) point.bogotaMin = row.price_min
      if (row.price_max != null) point.bogotaMax = row.price_max
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
  reportType?: ReportType
}

const PRODUCT_ID_BATCH_SIZE = 100

async function fetchPriceRowsBatch(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: { productIds?: number[]; days: number; reportType: ReportType }
): Promise<RawPriceRow[]> {
  const { productIds, days, reportType } = options
  const startIso = getStartDateIso(days)

  let query = supabase
    .from("sipsa_product_prices")
    .select(
      `
      date, price, price_min, price_max, daily_variation, report_type, product_id,
      sipsa_products ( product_code, product_name ),
      sipsa_municipalities ( municipality_code, municipality_name, market_name )
    `
    )
    .eq("report_type", reportType)
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
  const { productIds, days = 90, reportType = "day" } = options
  const supabase = await createClient()

  if (!productIds?.length) {
    return fetchPriceRowsBatch(supabase, { days, reportType })
  }

  if (productIds.length <= PRODUCT_ID_BATCH_SIZE) {
    return fetchPriceRowsBatch(supabase, { productIds, days, reportType })
  }

  const rows: RawPriceRow[] = []
  for (let i = 0; i < productIds.length; i += PRODUCT_ID_BATCH_SIZE) {
    const chunk = productIds.slice(i, i + PRODUCT_ID_BATCH_SIZE)
    const batch = await fetchPriceRowsBatch(supabase, {
      productIds: chunk,
      days,
      reportType,
    })
    rows.push(...batch)
  }

  return rows
}

export async function fetchAggregatePrices(
  productId: number,
  reportType: "week" | "month",
  days = 730
): Promise<RawPriceRow[]> {
  return fetchPriceRows({ productIds: [productId], days, reportType })
}

export type PeriodSummary = {
  reportType: "week" | "month"
  label: string
  city: string
  price: number
  priceMin: number | null
  priceMax: number | null
  periodEnd: string
}

function toPeriodSummary(
  latest: LatestCityPrice | null,
  reportType: "week" | "month",
  label: string,
  city: string
): PeriodSummary | null {
  if (!latest) return null
  return {
    reportType,
    label,
    city,
    price: latest.price,
    priceMin: latest.priceMin,
    priceMax: latest.priceMax,
    periodEnd: latest.date,
  }
}

export function buildPeriodSummariesByCity(
  rows: RawPriceRow[],
  productCode: string
): {
  medellin: { week: PeriodSummary | null; month: PeriodSummary | null }
  bogota: { week: PeriodSummary | null; month: PeriodSummary | null }
} {
  return {
    medellin: {
      week: toPeriodSummary(
        getLatestPriceForCity(rows, productCode, MEDELLIN_CODE, "week"),
        "week",
        "Semana SIPSA",
        "Medellín"
      ),
      month: toPeriodSummary(
        getLatestPriceForCity(rows, productCode, MEDELLIN_CODE, "month"),
        "month",
        "Mes SIPSA",
        "Medellín"
      ),
    },
    bogota: {
      week: toPeriodSummary(
        getLatestPriceForCity(rows, productCode, BOGOTA_CODE, "week"),
        "week",
        "Semana SIPSA",
        "Bogotá"
      ),
      month: toPeriodSummary(
        getLatestPriceForCity(rows, productCode, BOGOTA_CODE, "month"),
        "month",
        "Mes SIPSA",
        "Bogotá"
      ),
    },
  }
}
