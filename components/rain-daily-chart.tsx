"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"

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
import { cn } from "@/lib/utils"

const chartConfig = {
  rainMm: {
    label: "Lluvia diaria",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

function formatRainMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

function formatBarLabel(value: unknown): string {
  const rainMm = Number(value)
  if (!Number.isFinite(rainMm) || rainMm <= 0) return ""
  return `${rainMm.toFixed(1)} mm`
}

function formatDayLabel(dateIso: string, compact = false): string {
  const date = new Date(`${dateIso}T12:00:00`)
  if (compact) {
    return date.toLocaleDateString("es-CO", { day: "numeric" })
  }
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" })
}

type RainDailyChartProps = {
  daily: RainfallDailyPoint[]
}

export function RainDailyChart({ daily }: RainDailyChartProps) {
  const isMobile = useIsMobile()

  const chartData = React.useMemo(
    () =>
      daily.map((point) => ({
        ...point,
        label: formatDayLabel(point.date, isMobile),
      })),
    [daily, isMobile]
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

  const mobileMinWidth = Math.max(daily.length * 40, 360)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lluvia diaria (30 días)</CardTitle>
        <CardDescription>
          Promedio diario de los pluviómetros SIATA — estación Urrao (641)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          <p className="mb-2 text-xs text-muted-foreground">
            Desliza horizontalmente para ver todos los días
          </p>
        ) : null}
        <div
          className={cn(
            isMobile && "-mx-2 overflow-x-auto overscroll-x-contain px-2 pb-1"
          )}
        >
          <ChartContainer
            config={chartConfig}
            className={cn(
              "aspect-auto w-full",
              isMobile ? "h-[250px]" : "h-[280px]"
            )}
            style={isMobile ? { minWidth: mobileMinWidth } : undefined}
          >
            <BarChart
              data={chartData}
              margin={{
                left: isMobile ? 0 : 8,
                right: isMobile ? 4 : 8,
                top: isMobile ? 32 : 28,
                bottom: isMobile ? 8 : 0,
              }}
              barCategoryGap={isMobile ? "18%" : "22%"}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={isMobile ? 4 : 8}
                interval={isMobile ? 0 : "preserveStartEnd"}
                minTickGap={isMobile ? 0 : 24}
                tick={{ fontSize: isMobile ? 10 : 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={isMobile ? 2 : 8}
                width={isMobile ? 28 : 48}
                tickCount={isMobile ? 4 : 5}
                tick={{ fontSize: isMobile ? 10 : 12 }}
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
              >
                <LabelList
                  dataKey="rainMm"
                  position="top"
                  offset={isMobile ? 4 : 6}
                  className={cn(
                    "fill-foreground tabular-nums",
                    isMobile ? "text-[9px]" : "text-[10px]"
                  )}
                  formatter={formatBarLabel}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

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
