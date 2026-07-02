import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type {
  CityPriceTrendInsight,
  ProductPriceTrend,
} from "@/lib/sipsa/products-data"
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function TrendIcon({ direction }: { direction: CityPriceTrendInsight["direction"] }) {
  if (direction === "Bajando") {
    return <TrendingDownIcon className="size-4" />
  }
  if (direction === "Subiendo") {
    return <TrendingUpIcon className="size-4" />
  }
  return <MinusIcon className="size-4" />
}

function directionColorClass(
  direction: CityPriceTrendInsight["direction"]
): string {
  if (direction === "Subiendo") return "text-primary"
  if (direction === "Bajando") return "text-chart-5"
  return "text-muted-foreground"
}

function TrendCard({ insight }: { insight: CityPriceTrendInsight }) {
  if (insight.insufficientData) {
    return (
      <Card className="shadow-xs">
        <CardHeader className="gap-2">
          <CardDescription>{insight.city}</CardDescription>
          <CardTitle className="text-base font-medium text-muted-foreground">
            {insight.headline}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{insight.summary}</p>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="bg-linear-to-t from-primary/8 to-card shadow-xs dark:bg-card">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <CardDescription>{insight.city}</CardDescription>
          <Badge variant="outline" className={directionColorClass(insight.direction)}>
            <TrendIcon direction={insight.direction} />
            {formatChangePct(insight.changePct)}
          </Badge>
        </div>
        <CardTitle
          className={cn(
            "text-lg font-semibold",
            directionColorClass(insight.direction)
          )}
        >
          {insight.headline}
        </CardTitle>
        <p className="text-sm leading-relaxed">{insight.summary}</p>
        <div className="rounded-md border bg-muted/40 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground">
            Proyección a 3 días
          </p>
          {insight.direction !== "Estable" && insight.projectedPrice3Days != null ? (
            <p className="mt-1 text-base font-semibold tabular-nums">
              {formatPrice(insight.projectedPrice3Days)}
            </p>
          ) : null}
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {insight.projectionNote}
          </p>
        </div>
      </CardHeader>
    </Card>
  )
}

type ProductPriceTrendProps = {
  trend: ProductPriceTrend
  showMedellin: boolean
  showBogota: boolean
}

export function ProductPriceTrend({
  trend,
  showMedellin,
  showBogota,
}: ProductPriceTrendProps) {
  const cards: CityPriceTrendInsight[] = []

  if (showMedellin && trend.medellin) {
    cards.push(trend.medellin)
  }
  if (showBogota && trend.bogota) {
    cards.push(trend.bogota)
  }

  if (cards.length === 0) return null

  const cityLabel =
    showMedellin && showBogota
      ? "Medellín y Bogotá"
      : showMedellin
        ? "Medellín"
        : "Bogotá"

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">Tendencia de precio</h3>
        <p className="text-sm text-muted-foreground">
          Análisis de la racha reciente en {cityLabel} según datos SIPSA
        </p>
      </div>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          cards.length > 1 && "@xl/main:grid-cols-2"
        )}
      >
        {cards.map((insight) => (
          <TrendCard key={insight.city} insight={insight} />
        ))}
      </div>
    </div>
  )
}
