import { getProductsList, type RecentPricePoint } from "./products-data"

export type KpiCard = {
  code: string
  name: string
  price: number
  priceMin: number | null
  priceMax: number | null
  priceDate: string | null
  market: string
  marketName: string | null
  changePct: number | null
  trendLabel: string
  recentPrices: RecentPricePoint[]
}

export function buildAvgChangePct(kpis: KpiCard[]): number | null {
  const valid = kpis
    .map((k) => k.changePct)
    .filter((p): p is number => p !== null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

export async function getDashboardData() {
  const products = await getProductsList()
  const withPrices = products
    .filter(
      (product) =>
        product.medellinPrice !== null || product.bogotaPrice !== null
    )
    .map((product) => ({
      code: product.code,
      name: product.name,
      price: product.medellinPrice ?? product.bogotaPrice ?? 0,
      priceMin: product.displayPriceMin,
      priceMax: product.displayPriceMax,
      priceDate: product.displayPriceDate,
      market: product.medellinPrice !== null ? "Medellín" : "Bogotá",
      marketName: product.marketName,
      changePct: product.changePct,
      trendLabel: product.trendLabel,
      recentPrices: product.recentPrices,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  if (withPrices.length === 0) return null

  const avgChangePct = buildAvgChangePct(withPrices)

  return {
    kpis: withPrices,
    avgChangePct,
  }
}
