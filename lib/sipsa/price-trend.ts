import { computeChangePct, computeTrend } from "./price-fetch"

export type TrendDirection = "Subiendo" | "Bajando" | "Estable"

type DailyPriceEntry = {
  date: string
  medellin: number | null
  bogota: number | null
}

export type CityPriceTrendInsight = {
  city: string
  direction: TrendDirection
  streakDays: number
  latestPrice: number
  latestDate: string
  startPrice: number
  startDate: string
  changeAmount: number
  changePct: number | null
  avgDailyChange: number
  projectedPrice3Days: number | null
  headline: string
  summary: string
  projectionNote: string
  insufficientData?: boolean
}

export type ProductPriceTrend = {
  medellin: CityPriceTrendInsight | null
  bogota: CityPriceTrendInsight | null
}

type PricePoint = { date: string; price: number }

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function formatChangeAmount(amount: number): string {
  const sign = amount >= 0 ? "+" : "−"
  return `${sign}${formatPrice(Math.abs(amount)).replace("/kg", "")}/kg`
}

function formatChangePct(pct: number | null): string {
  if (pct === null) return ""
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

function asTrendDirection(label: string): TrendDirection {
  if (label === "Subiendo" || label === "Bajando") return label
  return "Estable"
}

function buildHeadline(direction: TrendDirection, streakDays: number): string {
  const dayLabel = streakDays === 1 ? "día" : "días"
  if (direction === "Subiendo") {
    return `Subiendo durante ${streakDays} ${dayLabel}`
  }
  if (direction === "Bajando") {
    return `Bajando durante ${streakDays} ${dayLabel}`
  }
  return `Estable durante ${streakDays} ${dayLabel}`
}

function buildSummary(
  city: string,
  direction: TrendDirection,
  streakDays: number,
  changeAmount: number,
  changePct: number | null
): string {
  const dayLabel = streakDays === 1 ? "día" : "días"
  const pctPart =
    changePct !== null ? ` (${formatChangeAmount(changeAmount)}, ${formatChangePct(changePct)})` : ""

  if (direction === "Subiendo") {
    return `En ${city}, el precio lleva ${streakDays} ${dayLabel} subiendo${pctPart}.`
  }
  if (direction === "Bajando") {
    return `En ${city}, el precio lleva ${streakDays} ${dayLabel} bajando${pctPart}.`
  }
  return `En ${city}, el precio se mantiene estable desde hace ${streakDays} ${dayLabel} (variación menor al 0.5%).`
}

function buildProjectionNote(
  direction: TrendDirection,
  projectedPrice3Days: number | null,
  latestPrice: number
): string {
  if (direction === "Estable") {
    return `Se espera un precio similar al actual (${formatPrice(latestPrice)}). Estimación basada en la tendencia reciente; no es una predicción garantizada.`
  }
  if (projectedPrice3Days === null) {
    return "Estimación basada en la tendencia reciente; no es una predicción garantizada."
  }
  return `Si la tendencia reciente continúa, la estimación para los próximos 3 días es alrededor de ${formatPrice(projectedPrice3Days)}. Estimación basada en la tendencia reciente; no es una predicción garantizada.`
}

function extractCityPrices(
  entries: DailyPriceEntry[],
  cityKey: "medellin" | "bogota"
): PricePoint[] {
  return entries
    .filter((entry) => entry[cityKey] != null)
    .map((entry) => ({ date: entry.date, price: entry[cityKey]! }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function computeCityPriceTrend(
  city: string,
  prices: PricePoint[]
): CityPriceTrendInsight | null {
  if (prices.length < 2) {
    return {
      city,
      direction: "Estable",
      streakDays: 0,
      latestPrice: prices[0]?.price ?? 0,
      latestDate: prices[0]?.date ?? "",
      startPrice: prices[0]?.price ?? 0,
      startDate: prices[0]?.date ?? "",
      changeAmount: 0,
      changePct: null,
      avgDailyChange: 0,
      projectedPrice3Days: null,
      headline: "Datos insuficientes",
      summary: `No hay suficientes observaciones recientes en ${city} para calcular la tendencia.`,
      projectionNote: "",
      insufficientData: true,
    }
  }

  const latest = prices[prices.length - 1]
  const previous = prices[prices.length - 2]
  const direction = asTrendDirection(
    computeTrend(latest.price, previous.price)
  )

  let streakDays = 1
  for (let i = prices.length - 2; i >= 1; i--) {
    const moveDirection = asTrendDirection(
      computeTrend(prices[i].price, prices[i - 1].price)
    )
    if (moveDirection !== direction) break
    streakDays++
  }

  const startIndex = prices.length - 1 - streakDays
  const start = prices[startIndex]
  const changeAmount = latest.price - start.price
  const changePct = computeChangePct(latest.price, start.price)
  const avgDailyChange = changeAmount / streakDays

  const projectedPrice3Days =
    direction === "Estable"
      ? latest.price
      : Math.max(0, latest.price + avgDailyChange * 3)

  return {
    city,
    direction,
    streakDays,
    latestPrice: latest.price,
    latestDate: latest.date,
    startPrice: start.price,
    startDate: start.date,
    changeAmount,
    changePct,
    avgDailyChange,
    projectedPrice3Days:
      direction === "Estable" ? null : projectedPrice3Days,
    headline: buildHeadline(direction, streakDays),
    summary: buildSummary(city, direction, streakDays, changeAmount, changePct),
    projectionNote: buildProjectionNote(
      direction,
      direction === "Estable" ? null : projectedPrice3Days,
      latest.price
    ),
  }
}

export function buildProductPriceTrend(
  entries: DailyPriceEntry[]
): ProductPriceTrend {
  const medellinPrices = extractCityPrices(entries, "medellin")
  const bogotaPrices = extractCityPrices(entries, "bogota")

  return {
    medellin:
      medellinPrices.length > 0
        ? computeCityPriceTrend("Medellín", medellinPrices)
        : null,
    bogota:
      bogotaPrices.length > 0
        ? computeCityPriceTrend("Bogotá", bogotaPrices)
        : null,
  }
}
