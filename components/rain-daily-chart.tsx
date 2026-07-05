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
import type { RainfallDailyPoint } from "@/lib/rain/rain-data"

const chartConfig = {
  rainMm: {
    label: "Lluvia diaria",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

function formatRainMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

function formatDayLabel(dateIso: string): string {
  const date = new Date(`${dateIso}T12:00:00`)
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
}

type RainDailyChartProps = {
  daily: RainfallDailyPoint[]
}

export function RainDailyChart({ daily }: RainDailyChartProps) {
  const chartData = React.useMemo(
    () =>
      daily.map((point) => ({
        ...point,
        label: formatDayLabel(point.date),
      })),
    [daily]
  )

  const stats = React.useMemo(() => {
    if (chartData.length === 0) return null
    const values = chartData.map((point) => point.rainMm)
    const total = values.reduce((sum, value) => sum + value, 0)
    const maxPoint = chartData.reduce((best, point) =>
      point.rainMm > best.rainMm ? point : best
    )
    return { total, maxPoint }
  }, [chartData])

  if (daily.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lluvia diaria (30 días)</CardTitle>
        <CardDescription>
          Promedio diario de los pluviómetros SIATA — estación Urrao (641)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval="preserveStartEnd"
              minTickGap={24}
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
                      | (RainfallDailyPoint & { label: string })
                      | undefined
                    return point ? formatDayLabel(point.date) : ""
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

        {stats ? (
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Día con más lluvia
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatDayLabel(stats.maxPoint.date)} ·{" "}
                {formatRainMm(stats.maxPoint.rainMm)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Total en ventana
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatRainMm(stats.total)}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
