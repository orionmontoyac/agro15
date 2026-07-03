"use client"

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PeriodSummary } from "@/lib/sipsa/price-fetch"

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function formatRange(min: number | null, max: number | null): string | null {
  if (min == null || max == null) return null
  return `${formatPrice(min)} – ${formatPrice(max)}`
}

function PeriodCard({ summary }: { summary: PeriodSummary }) {
  const range = formatRange(summary.priceMin, summary.priceMax)
  const periodLabel =
    summary.reportType === "week"
      ? "Promedio semanal SIPSA"
      : "Promedio mensual SIPSA"

  return (
    <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardDescription>{summary.label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {formatPrice(summary.price)}
        </CardTitle>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="font-medium">{periodLabel}</div>
        {range ? (
          <div className="text-muted-foreground">Rango: {range}</div>
        ) : null}
        <div className="text-muted-foreground">
          {summary.city} · hasta{" "}
          {new Date(summary.periodEnd).toLocaleDateString("es-CO", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </div>
      </CardFooter>
    </Card>
  )
}

type ProductPeriodSummaryProps = {
  medellin: { week: PeriodSummary | null; month: PeriodSummary | null }
  bogota: { week: PeriodSummary | null; month: PeriodSummary | null }
  showMedellin?: boolean
  showBogota?: boolean
}

export function ProductPeriodSummary({
  medellin,
  bogota,
  showMedellin = true,
  showBogota = true,
}: ProductPeriodSummaryProps) {
  const weekSummary =
    (showMedellin && medellin.week) || (showBogota && bogota.week)
      ? showMedellin
        ? medellin.week
        : bogota.week
      : showMedellin
        ? medellin.week
        : bogota.week

  const monthSummary =
    (showMedellin && medellin.month) || (showBogota && bogota.month)
      ? showMedellin
        ? medellin.month
        : bogota.month
      : showMedellin
        ? medellin.month
        : bogota.month

  if (!weekSummary && !monthSummary) {
    return null
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">Resumen por período</h3>
        <p className="text-sm text-muted-foreground">
          Promedios semanales y mensuales reportados por SIPSA
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {weekSummary ? <PeriodCard summary={weekSummary} /> : null}
        {monthSummary ? <PeriodCard summary={monthSummary} /> : null}
      </div>
    </div>
  )
}
