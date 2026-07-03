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
import type { InsumoMonthlyPoint } from "@/lib/sipsa/insumos-data"

const chartConfig = {
  medellin: { label: "Medellín", color: "var(--chart-1)" },
  bogota: { label: "Bogotá", color: "var(--chart-2)" },
} satisfies ChartConfig

function formatMonthLabel(periodMonth: string): string {
  return new Date(`${periodMonth}T12:00:00`).toLocaleDateString("es-CO", {
    month: "short",
    year: "2-digit",
  })
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

type InsumoPriceChartProps = {
  insumoName: string
  history: InsumoMonthlyPoint[]
}

export function InsumoPriceChart({ insumoName, history }: InsumoPriceChartProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin historial mensual para {insumoName}.
      </p>
    )
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[220px] w-full">
      <BarChart data={history} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="periodMonth"
          tickLine={false}
          axisLine={false}
          tickFormatter={formatMonthLabel}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) =>
            new Intl.NumberFormat("es-CO", {
              notation: "compact",
              maximumFractionDigits: 0,
            }).format(Number(v))
          }
          width={56}
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
                    {formatPrice(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Legend content={<ChartLegendContent />} verticalAlign="top" />
        <Bar
          dataKey="medellin"
          name="medellin"
          fill="var(--color-medellin)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="bogota"
          name="bogota"
          fill="var(--color-bogota)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}
