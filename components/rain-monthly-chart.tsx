"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { RainfallMonthlyPoint } from "@/lib/rain/rain-data"

const chartConfig = {
  rainMm: {
    label: "Lluvia acumulada",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

function formatRainMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

type RainMonthlyChartProps = {
  monthly: RainfallMonthlyPoint[]
  calendarYear?: number
}

export function RainMonthlyChart({
  monthly,
  calendarYear = new Date().getFullYear(),
}: RainMonthlyChartProps) {
  const stats = React.useMemo(() => {
    if (monthly.length === 0) return null

    const currentMonth = new Date().getMonth() + 1
    const eligible = monthly.filter((point) => point.month <= currentMonth)
    const values = eligible.map((point) => point.rainMm)
    const total = values.reduce((sum, value) => sum + value, 0)
    const maxPoint = eligible.reduce((best, point) =>
      point.rainMm > best.rainMm ? point : best
    )

    return { total, maxPoint }
  }, [monthly])

  if (monthly.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lluvia mensual acumulada</CardTitle>
          <CardDescription>
            No hay datos mensuales disponibles en este momento.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lluvia mensual acumulada</CardTitle>
        <CardDescription>
          Precipitación acumulada por mes en {calendarYear} (mm)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={monthly} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              tickFormatter={(value) => `${value}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload as
                      | RainfallMonthlyPoint
                      | undefined
                    return point?.label ?? ""
                  }}
                  formatter={(value) => (
                    <span className="font-mono font-medium tabular-nums">
                      {formatRainMm(Number(value))}
                    </span>
                  )}
                />
              }
            />
            <Bar
              dataKey="rainMm"
              fill="var(--color-rainMm)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>

        {stats && (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Mes con más lluvia
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {stats.maxPoint.label} · {formatRainMm(stats.maxPoint.rainMm)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Total acumulado ({calendarYear})
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatRainMm(stats.total)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
