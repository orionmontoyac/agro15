"use client"

import { Line, LineChart, YAxis } from "recharts"

import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import type { RecentPricePoint } from "@/lib/sipsa/products-data"

const chartConfig = {
  price: {
    label: "Precio",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type ProductPriceSparklineProps = {
  points: RecentPricePoint[]
  trendLabel?: string
  className?: string
}

function sparklineColor(trendLabel?: string): string {
  if (trendLabel === "Bajando") return "var(--chart-5)"
  return "var(--primary)"
}

/** Tight Y domain so small day-to-day moves read clearly (not flattened against zero). */
function sparklineYDomain(prices: number[]): [number, number] {
  if (prices.length === 0) return [0, 1]

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const spread = max - min

  if (spread === 0) {
    const pad = Math.max(Math.abs(min) * 0.04, 50)
    return [min - pad, max + pad]
  }

  const pad = spread * 0.12
  return [min - pad, max + pad]
}

export function ProductPriceSparkline({
  points,
  trendLabel,
  className,
}: ProductPriceSparklineProps) {
  if (points.length < 2) {
    return (
      <div
        className={cn(
          "h-16 w-full rounded-md bg-muted/40",
          className
        )}
        aria-hidden
      />
    )
  }

  const color = sparklineColor(trendLabel)
  const prices = points.map((point) => point.price)
  const yDomain = sparklineYDomain(prices)

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto h-16 w-full", className)}
    >
      <LineChart data={points} margin={{ top: 6, right: 4, bottom: 6, left: 4 }}>
        <YAxis hide domain={yDomain} />
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
