"use client"

import Link from "next/link"

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

function formatDate(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
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
    <div className="flex flex-col gap-4">
      <div className="px-4 lg:px-6">
        <h2 className="text-lg font-semibold">Últimos precios de productos</h2>
        <p className="text-sm text-muted-foreground">
          Precios más recientes en mercados mayoristas. Selecciona un producto
          para ver su historial y estadísticas.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/10 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs md:grid-cols-3 lg:px-6 dark:*:data-[slot=card]:bg-card">
      {kpis.map((kpi) => (
        <Link
          key={kpi.code}
          href={`/products/${kpi.code}`}
          className="block rounded-xl transition-colors hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card className="@container/card h-full">
            <CardHeader>
              <CardTitle className="line-clamp-2 text-lg font-semibold leading-snug @[250px]/card:text-xl">
                {kpi.name}
              </CardTitle>
              <CardDescription className="text-lg font-semibold tabular-nums text-foreground\\\">
                {formatPrice(kpi.price)}
              </CardDescription>
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
                {formatDate(kpi.priceDate)} · Precio SIPSA — {kpi.market}
              </div>
            </CardFooter>
          </Card>
        </Link>
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
            Promedio de {kpis.length} productos{" "}
            <TrendIcon trendLabel={avgTrend} />
          </div>
          <div className="text-muted-foreground">
            Variación mensual en mercados SIPSA
          </div>
        </CardFooter>
      </Card>
      </div>
    </div>
  )
}
