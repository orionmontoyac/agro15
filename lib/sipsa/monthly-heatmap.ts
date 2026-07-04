import type { RawPriceRow } from "./price-fetch"

export type MonthlyHeatmapData = {
  years: number[]
  cells: Record<string, number>
  minPrice: number | null
  maxPrice: number | null
}

export const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

function cellKey(year: number, month: number): string {
  return `${year}-${month}`
}

export function buildMonthlyHeatmap(
  rows: RawPriceRow[],
  productCode: string,
  municipalityCode: string
): MonthlyHeatmapData {
  const buckets = new Map<string, { sum: number; count: number }>()

  for (const row of rows) {
    if (row.sipsa_products?.product_code !== productCode) continue
    if (row.sipsa_municipalities?.municipality_code !== municipalityCode) continue

    const price = Number(row.price)
    if (!Number.isFinite(price)) continue

    const [yearStr, monthStr] = row.date.split("-")
    const year = Number(yearStr)
    const month = Number(monthStr)
    if (!year || month < 1 || month > 12) continue

    const key = cellKey(year, month)
    const existing = buckets.get(key) ?? { sum: 0, count: 0 }
    existing.sum += price
    existing.count += 1
    buckets.set(key, existing)
  }

  const cells: Record<string, number> = {}
  const yearsSet = new Set<number>()
  let minPrice: number | null = null
  let maxPrice: number | null = null

  for (const [key, { sum, count }] of buckets) {
    if (count === 0) continue
    const avgPrice = sum / count
    cells[key] = avgPrice

    const year = Number(key.split("-")[0])
    yearsSet.add(year)

    if (minPrice === null || avgPrice < minPrice) minPrice = avgPrice
    if (maxPrice === null || avgPrice > maxPrice) maxPrice = avgPrice
  }

  const years = [...yearsSet].sort((a, b) => b - a)

  return { years, cells, minPrice, maxPrice }
}

export function getHeatmapColor(
  avgPrice: number,
  min: number,
  max: number
): string {
  if (min === max) {
    return "hsl(45, 70%, 50%)"
  }

  const t = (avgPrice - min) / (max - min)
  const hue = t * 142
  const saturation = 55 + t * 20
  const lightness = 48 - t * 8

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

export function getCellPrice(
  data: MonthlyHeatmapData,
  year: number,
  month: number
): number | null {
  return data.cells[cellKey(year, month)] ?? null
}

/** Cell keys (YYYY-M) for the top N highest prices in each year row. */
export function getTopHighestPriceCellsByYear(
  data: MonthlyHeatmapData,
  topN = 3
): Set<string> {
  return getTopPriceCellsByYear(data, topN, "desc")
}

/** Cell keys (YYYY-M) for the top N lowest prices in each year row. */
export function getTopLowestPriceCellsByYear(
  data: MonthlyHeatmapData,
  topN = 3
): Set<string> {
  return getTopPriceCellsByYear(data, topN, "asc")
}

function getTopPriceCellsByYear(
  data: MonthlyHeatmapData,
  topN: number,
  order: "asc" | "desc"
): Set<string> {
  const marked = new Set<string>()
  const byYear = new Map<number, { key: string; price: number }[]>()

  for (const [key, price] of Object.entries(data.cells)) {
    const year = Number(key.split("-")[0])
    if (!year) continue
    const entries = byYear.get(year) ?? []
    entries.push({ key, price })
    byYear.set(year, entries)
  }

  for (const entries of byYear.values()) {
    entries
      .sort((a, b) => (order === "desc" ? b.price - a.price : a.price - b.price))
      .slice(0, topN)
      .forEach(({ key }) => marked.add(key))
  }

  return marked
}

export function isMarkedCell(
  markedKeys: Set<string>,
  year: number,
  month: number
): boolean {
  return markedKeys.has(cellKey(year, month))
}
