"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { KpiCard } from "@/lib/sipsa/dashboard-data"
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

function trendFooterText(trendLabel: string): string {
  if (trendLabel === "Subiendo") return "Subió respecto al mes anterior"
  if (trendLabel === "Bajando") return "Bajó respecto al mes anterior"
  return "Precio estable en mercados"
}

function TrendIcon({ trendLabel }: { trendLabel: string }) {
  if (trendLabel === "Bajando") {
    return <TrendingDownIcon className="size-4" />
  }
  return <TrendingUpIcon className="size-4" />
}

type SectionCardsProps = {
  kpis: KpiCard[]
  avgChangePct: number | null
}

export function SectionCards({ kpis, avgChangePct }: SectionCardsProps) {
  const avgTrend =
    avgChangePct === null
      ? "Estable"
      : avgChangePct > 0.5
        ? "Subiendo"
        : avgChangePct < -0.5
          ? "Bajando"
          : "Estable"

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      {kpis.map((kpi) => (
        <Card key={kpi.name} className="@container/card">
          <CardHeader>
            <CardDescription>{kpi.name}</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatPrice(kpi.price)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline">
                <TrendIcon trendLabel={kpi.trendLabel} />
                {formatChangePct(kpi.changePct)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="line-clamp-1 flex gap-2 font-medium">
              {trendFooterText(kpi.trendLabel)}{" "}
              <TrendIcon trendLabel={kpi.trendLabel} />
            </div>
            <div className="text-muted-foreground">
              Precio SIPSA — mercado mayorista Medellín
            </div>
          </CardFooter>
        </Card>
      ))}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Variación promedio</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {formatChangePct(avgChangePct)}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendIcon trendLabel={avgTrend} />
              {formatChangePct(avgChangePct)}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Promedio de las 3 frutas <TrendIcon trendLabel={avgTrend} />
          </div>
          <div className="text-muted-foreground">
            Granadilla, Tomate y Gulupa
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
