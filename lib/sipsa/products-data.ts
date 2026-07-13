import { createClient } from "@/lib/supabase/server"

import { BOGOTA_CODE, MEDELLIN_CODE } from "./constants"
import {
  buildMonthlyHeatmap,
  type MonthlyHeatmapData,
} from "./monthly-heatmap"
import {
  buildProductPriceTrend,
  type ProductPriceTrend,
} from "./price-trend"
import {
  buildChartSeries,
  computeChangePct,
  computeTrend,
  fetchPriceRows,
  findPriceOnOrBefore,
  getComparisonDateIso,
  getLatestPrice,
  getLatestPriceForCity,
  type ChartPoint,
  type RawPriceRow,
} from "./price-fetch"
import { getProductSupply, type ProductSupplySummary } from "./supply-data"

export type RecentPricePoint = {
  date: string
  price: number
}

export type ProductListRow = {
  id: number
  code: string
  name: string
  medellinPrice: number | null
  bogotaPrice: number | null
  displayPriceMin: number | null
  displayPriceMax: number | null
  marketName: string | null
  changePct: number | null
  trendLabel: string
  lastDate: string | null
  displayPriceDate: string | null
  recentPrices: RecentPricePoint[]
}

export function computeProductTrendSummary(products: ProductListRow[]) {
  let subiendo = 0
  let bajando = 0
  let estable = 0

  for (const product of products) {
    if (product.trendLabel === "Subiendo") subiendo += 1
    else if (product.trendLabel === "Bajando") bajando += 1
    else estable += 1
  }

  return {
    total: products.length,
    subiendo,
    bajando,
    estable,
  }
}

export type CitySummary = {
  city: string
  price: number
  priceMin: number | null
  priceMax: number | null
  marketName: string | null
  changePct: number | null
  trendLabel: string
  lastDate: string
}

export type { ProductSupplySummary } from "./supply-data"

export type { ProductPriceTrend, CityPriceTrendInsight } from "./price-trend"

export type MergedDailyPriceEntry = {
  date: string
  medellin: number | null
  bogota: number | null
}

export type { MonthlyHeatmapData } from "./monthly-heatmap"

export type ProductDetail = {
  product: { id: number; code: string; name: string }
  medellin: CitySummary | null
  bogota: CitySummary | null
  chartSeries: ChartPoint[]
  supply: ProductSupplySummary
  lastSevenDays: MergedDailyPriceEntry[]
  priceTrend: ProductPriceTrend
  monthlyHeatmap: {
    medellin: MonthlyHeatmapData
    bogota: MonthlyHeatmapData
  }
  hasPriceData: boolean
}

function buildCitySummary(
  rows: RawPriceRow[],
  productCode: string,
  municipalityCode: string,
  cityName: string
): CitySummary | null {
  const latest = getLatestPriceForCity(rows, productCode, municipalityCode)
  if (!latest) return null

  const comparisonIso = getComparisonDateIso()
  const previous = findPriceOnOrBefore(
    rows,
    productCode,
    municipalityCode,
    comparisonIso
  )
  const changePct = computeChangePct(latest.price, previous)
  const trendLabel = computeTrend(latest.price, previous)

  return {
    city: cityName,
    price: latest.price,
    priceMin: latest.priceMin,
    priceMax: latest.priceMax,
    marketName: latest.marketName,
    changePct,
    trendLabel,
    lastDate: latest.date,
  }
}

function buildLastSevenMerged(
  rows: RawPriceRow[],
  productCode: string
): MergedDailyPriceEntry[] {
  const pricesByDate = new Map<
    string,
    { medellin: number | null; bogota: number | null }
  >()

  for (const row of rows) {
    if (row.sipsa_products?.product_code !== productCode) continue

    const municipalityCode = row.sipsa_municipalities?.municipality_code
    if (!pricesByDate.has(row.date)) {
      pricesByDate.set(row.date, { medellin: null, bogota: null })
    }

    const entry = pricesByDate.get(row.date)!
    const price = Number(row.price)

    if (municipalityCode === MEDELLIN_CODE) {
      entry.medellin = price
    } else if (municipalityCode === BOGOTA_CODE) {
      entry.bogota = price
    }
  }

  return [...pricesByDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 7)
    .map(([date, prices]) => ({
      date,
      medellin: prices.medellin,
      bogota: prices.bogota,
    }))
    .reverse()
}

function buildRecentPricesForCity(
  rows: RawPriceRow[],
  productCode: string,
  municipalityCode: string,
  limit = 30
): RecentPricePoint[] {
  return rows
    .filter(
      (row) =>
        row.sipsa_products?.product_code === productCode &&
        row.sipsa_municipalities?.municipality_code === municipalityCode
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-limit)
    .map((row) => ({
      date: row.date,
      price: Number(row.price),
    }))
}

function aggregateProductListRow(
  product: { id: number; product_code: string; product_name: string },
  rows: RawPriceRow[]
): ProductListRow {
  const code = product.product_code
  const medellin = getLatestPriceForCity(rows, code, MEDELLIN_CODE)
  const bogota = getLatestPriceForCity(rows, code, BOGOTA_CODE)

  const latest = getLatestPrice(rows, code, MEDELLIN_CODE)
  let changePct: number | null = null
  let trendLabel = "Estable"

  if (latest) {
    const comparisonIso = getComparisonDateIso()
    const previous = findPriceOnOrBefore(
      rows,
      code,
      latest.municipalityCode,
      comparisonIso
    )
    changePct = computeChangePct(latest.price, previous)
    trendLabel = computeTrend(latest.price, previous)
  }

  const dates = [medellin?.date, bogota?.date, latest?.date].filter(
    (d): d is string => Boolean(d)
  )
  const lastDate =
    dates.length > 0
      ? dates.sort((a, b) => b.localeCompare(a))[0]
      : null

  const primaryMunicipalityCode =
    medellin != null ? MEDELLIN_CODE : BOGOTA_CODE
  const primaryLatest = getLatestPriceForCity(
    rows,
    code,
    primaryMunicipalityCode
  )
  const recentPrices = buildRecentPricesForCity(
    rows,
    code,
    primaryMunicipalityCode
  )

  return {
    id: product.id,
    code,
    name: product.product_name,
    medellinPrice: medellin?.price ?? null,
    bogotaPrice: bogota?.price ?? null,
    displayPriceMin: primaryLatest?.priceMin ?? null,
    displayPriceMax: primaryLatest?.priceMax ?? null,
    marketName: primaryLatest?.marketName ?? null,
    changePct,
    trendLabel,
    lastDate,
    displayPriceDate: medellin?.date ?? bogota?.date ?? null,
    recentPrices,
  }
}

export async function getProductsList(): Promise<ProductListRow[]> {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from("sipsa_products")
    .select("id, product_code, product_name")
    .order("product_name")

  if (error || !products?.length) {
    return []
  }

  const productIds = products.map((p) => p.id)
  const rows = await fetchPriceRows({ productIds, days: 35 })

  return products
    .map((product) => aggregateProductListRow(product, rows))
    .sort((a, b) => {
      if (a.lastDate === null && b.lastDate === null) {
        return a.name.localeCompare(b.name, "es")
      }
      if (a.lastDate === null) return 1
      if (b.lastDate === null) return -1
      const byDate = b.lastDate.localeCompare(a.lastDate)
      if (byDate !== 0) return byDate
      return a.name.localeCompare(b.name, "es")
    })
}

export async function getProductByCode(
  code: string
): Promise<{ id: number; product_code: string; product_name: string } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("sipsa_products")
    .select("id, product_code, product_name")
    .eq("product_code", code)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data
}

export async function getProductDetail(code: string): Promise<ProductDetail | null> {
  const product = await getProductByCode(code)
  if (!product) return null

  const [dailyRows, heatmapRows, supply] = await Promise.all([
    fetchPriceRows({ productIds: [product.id], reportType: "day", days: 365 * 5 }),
    fetchPriceRows({
      productIds: [product.id],
      reportType: "day",
      days: undefined,
    }),
    getProductSupply(product.id),
  ])

  const rows = dailyRows
  const hasPriceData = rows.length > 0

  const medellin = buildCitySummary(
    rows,
    code,
    MEDELLIN_CODE,
    "Medellín"
  )
  const bogota = buildCitySummary(rows, code, BOGOTA_CODE, "Bogotá")
  const chartSeries = buildChartSeries(rows, code, "day")
  const lastSevenDays = buildLastSevenMerged(rows, code)
  const priceTrend = buildProductPriceTrend(lastSevenDays)
  const monthlyHeatmap = {
    medellin: buildMonthlyHeatmap(heatmapRows, code, MEDELLIN_CODE),
    bogota: buildMonthlyHeatmap(heatmapRows, code, BOGOTA_CODE),
  }

  return {
    product: {
      id: product.id,
      code: product.product_code,
      name: product.product_name,
    },
    medellin,
    bogota,
    chartSeries,
    supply,
    lastSevenDays,
    priceTrend,
    monthlyHeatmap,
    hasPriceData,
  }
}
