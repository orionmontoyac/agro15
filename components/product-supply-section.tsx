"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  BOGOTA_CODE,
  MEDELLIN_CODE,
  type MunicipalityFilter,
} from "@/lib/sipsa/constants"
import type { ProductSupplySummary } from "@/lib/sipsa/supply-data"

const chartConfig = {
  medellin: {
    label: "Medellín",
    color: "var(--chart-1)",
  },
  bogota: {
    label: "Bogotá",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function formatMonthLabel(periodMonth: string): string {
  const date = new Date(`${periodMonth}T12:00:00`)
  return date.toLocaleDateString("es-CO", { month: "short", year: "2-digit" })
}

function formatTons(value: number): string {
  return `${new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 }).format(value)} t`
}

type ProductSupplySectionProps = {
  supply: ProductSupplySummary
  municipalityFilter?: MunicipalityFilter
}

export function ProductSupplySection({
  supply,
  municipalityFilter = "all",
}: ProductSupplySectionProps) {
  const showMedellin =
    municipalityFilter === "all" || municipalityFilter === MEDELLIN_CODE
  const showBogota =
    municipalityFilter === "all" || municipalityFilter === BOGOTA_CODE

  const chartData = React.useMemo(() => {
    const byMonth = new Map<string, { month: string; medellin?: number; bogota?: number }>()

    for (const row of supply.monthly) {
      if (!byMonth.has(row.periodMonth)) {
        byMonth.set(row.periodMonth, { month: row.periodMonth })
      }
      const entry = byMonth.get(row.periodMonth)!
      if (row.municipalityCode === MEDELLIN_CODE) {
        entry.medellin = row.quantityTons
      } else if (row.municipalityCode === BOGOTA_CODE) {
        entry.bogota = row.quantityTons
      }
    }

    return [...byMonth.values()].sort((a, b) =>
      a.month.localeCompare(b.month)
    )
  }, [supply.monthly])

  const sources = React.useMemo(() => {
    if (municipalityFilter === BOGOTA_CODE) {
      return supply.latestMonthSources.bogota
    }
    if (municipalityFilter === MEDELLIN_CODE) {
      return supply.latestMonthSources.medellin
    }
    return [
      ...supply.latestMonthSources.medellin,
      ...supply.latestMonthSources.bogota,
    ]
      .sort((a, b) => b.quantityTons - a.quantityTons)
      .slice(0, 5)
  }, [municipalityFilter, supply.latestMonthSources])

  if (!supply.hasData) {
    return (
      <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
        <CardHeader>
          <CardTitle>Abastecimiento mensual (SIPSA)</CardTitle>
          <CardDescription>
            Toneladas reportadas en central mayorista — datos aún no sincronizados
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ejecuta{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">npm run sync:sipsa-supply</code>{" "}
          para cargar volúmenes de abastecimiento.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardTitle>Abastecimiento mensual (SIPSA)</CardTitle>
        <CardDescription>
          Toneladas reportadas en central mayorista — contexto de oferta en el mercado
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatMonthLabel}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v} t`}
              width={48}
              tick={{ fontSize: 12 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => formatMonthLabel(String(value))}
                  formatter={(value, name) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="text-muted-foreground">
                        {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                      </span>
                      <span className="font-mono font-medium tabular-nums">
                        {formatTons(Number(value))}
                      </span>
                    </div>
                  )}
                />
              }
            />
            {(showMedellin && showBogota) && (
              <Legend content={<ChartLegendContent />} verticalAlign="top" />
            )}
            {showMedellin && (
              <Bar
                dataKey="medellin"
                name="medellin"
                fill="var(--color-medellin)"
                radius={[4, 4, 0, 0]}
              />
            )}
            {showBogota && (
              <Bar
                dataKey="bogota"
                name="bogota"
                fill="var(--color-bogota)"
                radius={[4, 4, 0, 0]}
              />
            )}
          </BarChart>
        </ChartContainer>

        {supply.latestMonth && sources.length > 0 ? (
          <div className="border-t pt-4">
            <h4 className="mb-3 text-sm font-semibold">
              Mercados —{" "}
              {new Date(`${supply.latestMonth}T12:00:00`).toLocaleDateString("es-CO", {
                month: "long",
                year: "numeric",
              })}
            </h4>
            <ul className="space-y-2 text-sm">
              {sources.map((source) => (
                <li
                  key={source.sourceName}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-muted-foreground">{source.sourceName}</span>
                  <span className="font-medium tabular-nums">
                    {formatTons(source.quantityTons)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
