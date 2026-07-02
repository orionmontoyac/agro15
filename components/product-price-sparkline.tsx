"use client"

import { Line, LineChart } from "recharts"

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

export function ProductPriceSparkline({
  points,
  trendLabel,
  className,
}: ProductPriceSparklineProps) {
  if (points.length < 2) {
    return (
      <div
        className={cn(
          "h-14 w-full rounded-md bg-muted/40",
          className
        )}
        aria-hidden
      />
    )
  }

  const color = sparklineColor(trendLabel)

  return (
    <ChartContainer
      config={chartConfig}
      className={cn("aspect-auto h-14 w-full", className)}
    >
      <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
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
