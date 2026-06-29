import { createClient } from "@/lib/supabase/server"

import {
  AGRO15_PRODUCTS,
  BOGOTA_CODE,
  MEDELLIN_CODE,
} from "./constants"

const DAYS_LOOKBACK = 90
const COMPARISON_DAYS = 30

export type ChartPoint = {
  date: string
  medellin?: number
  bogota?: number
}

export type KpiCard = {
  name: string
  price: number
  changePct: number | null
  trendLabel: string
}

export type DashboardTableRow = {
  id: number
  header: string
  type: string
  status: string
  target: string
  limit: string
  reviewer: string
}

type RawPriceRow = {
  date: string
  price: number
  product_id: number
  sipsa_products: { product_code: string; product_name: string } | null
  sipsa_municipalities: {
    municipality_code: string
    municipality_name: string
  } | null
}

function normalizePriceRow(row: Record<string, unknown>): RawPriceRow {
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

function getStartDateIso(days: number): string {
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

function findPriceOnOrBefore(
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

function getLatestPrice(
  rows: RawPriceRow[],
  productCode: string,
  preferredMunicipality: string
): { price: number; municipalityCode: string } | null {
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
    return { price: Number(preferred.price), municipalityCode: preferredMunicipality }
  }

  const fallback = productRows.sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0]
  if (!fallback) return null

  return {
    price: Number(fallback.price),
    municipalityCode:
      fallback.sipsa_municipalities?.municipality_code ?? "",
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

export function buildKpiCards(rows: RawPriceRow[]): KpiCard[] {
  const comparisonDate = new Date()
  comparisonDate.setDate(comparisonDate.getDate() - COMPARISON_DAYS)
  const comparisonIso = comparisonDate.toISOString().slice(0, 10)

  return AGRO15_PRODUCTS.map(({ code, name }) => {
    const latest = getLatestPrice(rows, code, MEDELLIN_CODE)
    if (!latest) {
      return { name, price: 0, changePct: null, trendLabel: "Estable" }
    }

    const previous = findPriceOnOrBefore(
      rows,
      code,
      latest.municipalityCode,
      comparisonIso
    )
    const changePct = computeChangePct(latest.price, previous)
    const trendLabel = computeTrend(latest.price, previous)

    return {
      name,
      price: latest.price,
      changePct,
      trendLabel,
    }
  })
}

export function buildAvgChangePct(kpis: KpiCard[]): number | null {
  const valid = kpis
    .map((k) => k.changePct)
    .filter((p): p is number => p !== null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

export function buildTableRows(rows: RawPriceRow[]): DashboardTableRow[] {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date))
  const recent = sorted.slice(0, 20)

  return recent.map((row, index) => {
    const productCode = row.sipsa_products?.product_code ?? ""
    const municipalityCode =
      row.sipsa_municipalities?.municipality_code ?? ""
    const comparisonDate = new Date(row.date)
    comparisonDate.setDate(comparisonDate.getDate() - COMPARISON_DAYS)
    const comparisonIso = comparisonDate.toISOString().slice(0, 10)
    const previous = findPriceOnOrBefore(
      rows,
      productCode,
      municipalityCode,
      comparisonIso
    )
    const price = Number(row.price)

    return {
      id: index + 1,
      header: row.sipsa_products?.product_name ?? productCode,
      type: row.sipsa_municipalities?.municipality_name ?? municipalityCode,
      status: computeTrend(price, previous),
      target: String(Math.round(price)),
      limit:
        previous !== null
          ? String(Math.round(previous))
          : String(Math.round(price)),
      reviewer: "SIPSA",
    }
  })
}

export async function getDashboardPriceRows(): Promise<RawPriceRow[] | null> {
  const supabase = await createClient()

  const productCodes = AGRO15_PRODUCTS.map((p) => p.code)
  const { data: products, error: productsError } = await supabase
    .from("sipsa_products")
    .select("id, product_code")
    .in("product_code", productCodes)

  if (productsError || !products?.length) {
    return null
  }

  const productIds = products.map((p) => p.id)
  const startIso = getStartDateIso(DAYS_LOOKBACK)

  const { data, error } = await supabase
    .from("sipsa_product_prices")
    .select(
      `
      date, price, product_id,
      sipsa_products ( product_code, product_name ),
      sipsa_municipalities ( municipality_code, municipality_name )
    `
    )
    .in("product_id", productIds)
    .gte("date", startIso)
    .order("date", { ascending: true })

  if (error || !data?.length) {
    return null
  }

  return data.map((row) => normalizePriceRow(row as Record<string, unknown>))
}

export async function getDashboardData() {
  const rows = await getDashboardPriceRows()
  if (!rows) return null

  const chartDataByProduct: Record<string, ChartPoint[]> = {}
  for (const { code } of AGRO15_PRODUCTS) {
    chartDataByProduct[code] = buildChartSeries(rows, code)
  }

  const kpis = buildKpiCards(rows)
  const avgChangePct = buildAvgChangePct(kpis)
  const tableRows = buildTableRows(rows)
  const products = AGRO15_PRODUCTS.map(({ code, name }) => ({ code, name }))

  return {
    chartDataByProduct,
    products,
    kpis,
    avgChangePct,
    tableRows,
  }
}
