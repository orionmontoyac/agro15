import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CitySummary } from "@/lib/sipsa/products-data"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

function TrendIcon({ trendLabel }: { trendLabel: string }) {
  if (trendLabel === "Bajando") {
    return <TrendingDownIcon className="size-4" />
  }
  return <TrendingUpIcon className="size-4" />
}

function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null
  const fmt = (value: number) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value)
  return `${fmt(min)} – ${fmt(max)}/kg`
}

function CityCard({ summary }: { summary: CitySummary }) {
  const priceRange = formatPriceRange(summary.priceMin, summary.priceMax)
  const subtitle = summary.marketName
    ? `${summary.marketName} · ${summary.city}`
    : summary.city

  return (
    <Card className="@container/card bg-linear-to-t from-primary/10 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>{subtitle}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {formatPrice(summary.price)}
        </CardTitle>
        {priceRange ? (
          <p className="text-sm text-muted-foreground">
            Rango del día: <span className="font-medium text-foreground">{priceRange}</span>
          </p>
        ) : null}
        <CardAction>
          <Badge variant="outline">
            <TrendIcon trendLabel={summary.trendLabel} />
            {formatChangePct(summary.changePct)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {summary.trendLabel}{" "}
          <TrendIcon trendLabel={summary.trendLabel} />
        </div>
        <div className="text-muted-foreground">
          Actualizado{" "}
          {new Date(summary.lastDate).toLocaleDateString("es-CO", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
      </CardFooter>
    </Card>
  )
}

type ProductCityCardsProps = {
  medellin: CitySummary | null
  bogota: CitySummary | null
  showMedellin?: boolean
  showBogota?: boolean
}

export function ProductCityCards({
  medellin,
  bogota,
  showMedellin = true,
  showBogota = true,
}: ProductCityCardsProps) {
  const cards = []

  if (showMedellin) {
    cards.push(
      medellin ? (
        <CityCard key="medellin" summary={medellin} />
      ) : (
        <Card key="medellin">
          <CardHeader>
            <CardDescription>Medellín</CardDescription>
            <CardTitle className="text-muted-foreground">Sin datos</CardTitle>
          </CardHeader>
        </Card>
      )
    )
  }

  if (showBogota) {
    cards.push(
      bogota ? (
        <CityCard key="bogota" summary={bogota} />
      ) : (
        <Card key="bogota">
          <CardHeader>
            <CardDescription>Bogotá</CardDescription>
            <CardTitle className="text-muted-foreground">Sin datos</CardTitle>
          </CardHeader>
        </Card>
      )
    )
  }

  if (cards.length === 0) return null

  return (
    <div
      className={`grid grid-cols-1 gap-4 ${cards.length > 1 ? "@xl/main:grid-cols-2" : ""}`}
    >
      {cards}
    </div>
  )
}
