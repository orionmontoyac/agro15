"use client"

import * as React from "react"
import Link from "next/link"
import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { FavoriteStarButton } from "@/components/favorite-star-button"
import { ProductPriceSparkline } from "@/components/product-price-sparkline"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useProductFavorites } from "@/hooks/use-product-favorites"
import {
  getContextDateLabel,
  isTodayOrYesterday,
} from "@/lib/sipsa/date-labels"
import type { KpiCard } from "@/lib/sipsa/dashboard-data"
import { cn } from "@/lib/utils"

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
  const { isFavorite, toggleFavorite, sortWithFavorites } = useProductFavorites()
  const orderedKpis = React.useMemo(
    () => sortWithFavorites(kpis),
    [kpis, sortWithFavorites]
  )

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
          Precios más recientes en mercados mayoristas. Marca con ★ tus favoritos
          para verlos primero.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:px-6 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/10 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs dark:*:data-[slot=card]:bg-card">
        {orderedKpis.map((kpi) => {
          const dateLabel = kpi.priceDate
            ? getContextDateLabel(kpi.priceDate)
            : null
          const favorited = isFavorite(kpi.code)

          return (
            <Link
              key={kpi.code}
              href={`/products/${kpi.code}`}
              className="block min-w-0 rounded-xl transition-colors hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="@container/card h-full">
                <CardHeader className="gap-2 max-sm:[&_[data-slot=card-action]]:col-start-1 max-sm:[&_[data-slot=card-action]]:row-start-auto max-sm:[&_[data-slot=card-action]]:justify-self-start">
                  <CardTitle className="flex min-w-0 items-start gap-0.5 text-base font-semibold leading-snug sm:text-lg">
                    <span className="min-w-0 wrap-break-word">{kpi.name}</span>
                    <FavoriteStarButton
                      productCode={kpi.code}
                      productName={kpi.name}
                      isFavorite={favorited}
                      onToggle={toggleFavorite}
                      size="icon-sm"
                      className="-mt-0.5 size-7 shrink-0"
                    />
                  </CardTitle>
                  <CardDescription className="text-xl font-semibold tabular-nums text-foreground">
                    {formatPrice(kpi.price)}
                  </CardDescription>
                  {kpi.priceMin != null && kpi.priceMax != null ? (
                    <p className="text-xs text-muted-foreground">
                      Rango: {formatPrice(kpi.priceMin)} – {formatPrice(kpi.priceMax)}
                    </p>
                  ) : null}
                  <CardAction>
                    <Badge variant="outline" className="shrink-0">
                      <TrendIcon trendLabel={kpi.trendLabel} />
                      {formatChangePct(kpi.changePct)}
                    </Badge>
                  </CardAction>
                </CardHeader>
                <CardContent className="pt-0">
                  <ProductPriceSparkline
                    points={kpi.recentPrices}
                    trendLabel={kpi.trendLabel}
                  />
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                    {trendFooterText(kpi.trendLabel)}{" "}
                    <TrendIcon trendLabel={kpi.trendLabel} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-muted-foreground">
                    {dateLabel ? (
                      isTodayOrYesterday(dateLabel.primary) ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "shrink-0",
                            dateLabel.primary === "HOY" &&
                              "border-primary/30 text-primary"
                          )}
                        >
                          {dateLabel.primary}
                        </Badge>
                      ) : (
                        <span>{dateLabel.primary}</span>
                      )
                    ) : (
                      <span>—</span>
                    )}
                    {dateLabel && (
                      <span className="capitalize">{dateLabel.secondary}</span>
                    )}
                    <span>
                      · Precio SIPSA — {kpi.marketName ?? kpi.market}
                    </span>
                  </div>
                  <span
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "mt-1 w-full"
                    )}
                  >
                    Ver detalles →
                  </span>
                </CardFooter>
              </Card>
            </Link>
          )
        })}
        <Card className="@container/card sm:col-span-2 md:col-span-1">
          <CardHeader className="gap-2 max-sm:grid-cols-1 max-sm:[&_[data-slot=card-action]]:col-start-1 max-sm:[&_[data-slot=card-action]]:row-start-auto max-sm:[&_[data-slot=card-action]]:justify-self-start">
            <CardDescription>Variación promedio</CardDescription>
            <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {formatChangePct(avgChangePct)}
            </CardTitle>
            <CardAction>
              <Badge variant="outline" className="shrink-0">
                <TrendIcon trendLabel={avgTrend} />
                {formatChangePct(avgChangePct)}
              </Badge>
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
              Promedio de {orderedKpis.length} productos{" "}
              <TrendIcon trendLabel={avgTrend} />
            </div>
            <div className="text-wrap text-muted-foreground">
              Variación mensual en mercados SIPSA
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
