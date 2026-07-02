import { createClient } from "@/lib/supabase/server"

import { BOGOTA_CODE, MEDELLIN_CODE } from "./constants"
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

export type ProductListRow = {
  id: number
  code: string
  name: string
  medellinPrice: number | null
  bogotaPrice: number | null
  changePct: number | null
  trendLabel: string
  lastDate: string | null
  displayPriceDate: string | null
}

export type CitySummary = {
  city: string
  price: number
  changePct: number | null
  trendLabel: string
  lastDate: string
}

export type { ProductPriceTrend, CityPriceTrendInsight } from "./price-trend"

export type MergedDailyPriceEntry = {
  date: string
  medellin: number | null
  bogota: number | null
}

export type ProductDetail = {
  product: { id: number; code: string; name: string }
  medellin: CitySummary | null
  bogota: CitySummary | null
  chartSeries: ChartPoint[]
  lastSevenDays: MergedDailyPriceEntry[]
  priceTrend: ProductPriceTrend
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

  return {
    id: product.id,
    code,
    name: product.product_name,
    medellinPrice: medellin?.price ?? null,
    bogotaPrice: bogota?.price ?? null,
    changePct,
    trendLabel,
    lastDate,
    displayPriceDate: medellin?.date ?? bogota?.date ?? null,
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

  const rows = await fetchPriceRows({ productIds: [product.id] })
  const hasPriceData = rows.length > 0

  const medellin = buildCitySummary(
    rows,
    code,
    MEDELLIN_CODE,
    "Medellín"
  )
  const bogota = buildCitySummary(rows, code, BOGOTA_CODE, "Bogotá")
  const chartSeries = buildChartSeries(rows, code)
  const lastSevenDays = buildLastSevenMerged(rows, code)
  const priceTrend = buildProductPriceTrend(lastSevenDays)

  return {
    product: {
      id: product.id,
      code: product.product_code,
      name: product.product_name,
    },
    medellin,
    bogota,
    chartSeries,
    lastSevenDays,
    priceTrend,
    hasPriceData,
  }
}
