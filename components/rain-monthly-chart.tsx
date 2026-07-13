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
import type { RainfallMonthlyPoint } from "@/lib/rain/rain-data"
import { cn } from "@/lib/utils"

const chartConfig = {
  rainMm: {
    label: "Lluvia acumulada",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

function formatRainMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

function formatBarLabel(value: unknown, compact: boolean): string {
  const rainMm = Number(value)
  if (!Number.isFinite(rainMm) || rainMm <= 0) return ""
  return compact ? `${rainMm.toFixed(0)} mm` : `${rainMm.toFixed(1)} mm`
}

type RainMonthlyChartProps = {
  monthly: RainfallMonthlyPoint[]
  calendarYear?: number
}

export function RainMonthlyChart({
  monthly,
  calendarYear = new Date().getFullYear(),
}: RainMonthlyChartProps) {
  const isMobile = useIsMobile()

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
        <div
          className={cn(
            isMobile && "-mx-2 overflow-x-auto overscroll-x-contain px-2 pb-1"
          )}
        >
          <ChartContainer
            config={chartConfig}
            className={cn(
              "aspect-auto w-full",
              isMobile ? "h-[250px] min-w-md" : "h-[280px]"
            )}
          >
            <BarChart
              data={monthly}
              margin={{
                left: isMobile ? 0 : 8,
                right: isMobile ? 4 : 8,
                top: isMobile ? 32 : 28,
                bottom: isMobile ? 4 : 0,
              }}
              barCategoryGap={isMobile ? "12%" : "18%"}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                tickMargin={isMobile ? 4 : 8}
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
              >
                <LabelList
                  dataKey="rainMm"
                  position="top"
                  offset={isMobile ? 4 : 6}
                  className={cn(
                    "fill-foreground tabular-nums",
                    isMobile ? "text-[9px]" : "text-[10px]"
                  )}
                  formatter={(value) => formatBarLabel(value, isMobile)}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

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
