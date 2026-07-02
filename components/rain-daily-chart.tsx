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
import { useIsMobile } from "@/hooks/use-mobile"
import type { RainfallDailyPoint } from "@/lib/rain/rain-data"
import { getLast30DaysTotal } from "@/lib/rain/rain-data"

const chartConfig = {
  rainMm: {
    label: "Lluvia diaria",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

function formatRainMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

type RainDailyChartProps = {
  daily: RainfallDailyPoint[]
  stationName?: string
}

export function RainDailyChart({ daily, stationName }: RainDailyChartProps) {
  const isMobile = useIsMobile()

  const stats = React.useMemo(() => {
    if (daily.length === 0) return null

    const total = getLast30DaysTotal(daily)
    const maxPoint = daily.reduce((best, point) =>
      point.rainMm > best.rainMm ? point : best
    )
    const rainyDays = daily.filter((point) => point.rainMm > 0).length

    return { total, maxPoint, rainyDays }
  }, [daily])

  if (daily.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lluvia diaria — últimos 30 días</CardTitle>
          <CardDescription>
            No hay datos diarios disponibles en este momento.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lluvia diaria — últimos 30 días</CardTitle>
        <CardDescription>
          Precipitación diaria en mm
          {stationName ? ` · ${stationName}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
          <BarChart data={daily} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="shortLabel"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={isMobile ? 4 : 2}
              angle={isMobile ? -45 : 0}
              textAnchor={isMobile ? "end" : "middle"}
              height={isMobile ? 56 : 32}
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
                      | RainfallDailyPoint
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
          <div className="mt-4 grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Total (30 días)
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatRainMm(stats.total)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Día con más lluvia
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {stats.maxPoint.label} · {formatRainMm(stats.maxPoint.rainMm)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted-foreground">
                Días con lluvia
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {stats.rainyDays} de {daily.length}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
