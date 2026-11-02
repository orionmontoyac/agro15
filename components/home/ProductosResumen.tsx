"use client"

import * as React from "react"
import Link from "next/link"
import { StarIcon } from "lucide-react"

import { ProductPriceSparkline } from "@/components/product-price-sparkline"
import { useProductFavorites } from "@/hooks/use-product-favorites"
import type { KpiCard } from "@/lib/sipsa/dashboard-data"
import { getContextDateLabel } from "@/lib/sipsa/date-labels"
import { cn } from "@/lib/utils"

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(price)
}

function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  return `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1)}%`
}

type ProductosResumenProps = {
  kpis: KpiCard[]
  avgChangePct: number | null
  /** Max rows to show (favorites first). */
  limit?: number
}

export function ProductosResumen({ kpis, avgChangePct, limit = 6 }: ProductosResumenProps) {
  const { isFavorite, sortWithFavorites } = useProductFavorites()
  const ordered = React.useMemo(() => sortWithFavorites(kpis), [kpis, sortWithFavorites])
  const visible = ordered.slice(0, limit)

  const subiendo = kpis.filter((k) => k.trendLabel === "Subiendo").length
  const bajando = kpis.filter((k) => k.trendLabel === "Bajando").length

  return (
    <>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Variación prom." value={formatChangePct(avgChangePct)} tone={avgChangePct} />
        <Stat label="Subiendo" value={String(subiendo)} />
        <Stat label="Bajando" value={String(bajando)} />
      </div>

      <ul className="-mx-2 flex flex-col">
        {visible.map((kpi) => {
          const date = kpi.priceDate ? getContextDateLabel(kpi.priceDate).primary : null
          return (
            <li key={kpi.code}>
              <Link
                href={`/products/${kpi.code}`}
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1 truncate text-sm font-medium">
                    {isFavorite(kpi.code) ? (
                      <StarIcon className="size-3 shrink-0 fill-amber-400 text-amber-400" />
                    ) : null}
                    <span className="truncate">{kpi.name}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {kpi.market}
                    {date ? ` · ${date}` : ""}
                  </div>
                </div>
                <ProductPriceSparkline
                  points={kpi.recentPrices}
                  trendLabel={kpi.trendLabel}
                  className="h-8 w-[4.5rem]"
                />
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {formatPrice(kpi.price)}
                    <span className="text-xs font-normal text-muted-foreground">/kg</span>
                  </div>
                  <div
                    className={cn(
                      "text-xs font-medium tabular-nums",
                      kpi.trendLabel === "Subiendo" && "text-primary",
                      kpi.trendLabel === "Bajando" && "text-chart-5",
                      kpi.trendLabel !== "Subiendo" &&
                        kpi.trendLabel !== "Bajando" &&
                        "text-muted-foreground"
                    )}
                  >
                    {formatChangePct(kpi.changePct)}
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>

      {kpis.length > visible.length ? (
        <p className="text-xs text-muted-foreground">
          y {kpis.length - visible.length} producto(s) más. Marca ★ tus favoritos
          para verlos aquí primero.
        </p>
      ) : null}
    </>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: number | null
}) {
  return (
    <div className="rounded-lg border bg-background/40 px-2 py-2">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone != null && tone > 0.5 && "text-primary",
          tone != null && tone < -0.5 && "text-chart-5"
        )}
      >
        {value}
      </div>
      <div className="text-[0.7rem] text-muted-foreground">{label}</div>
    </div>
  )
}
