"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { DEFAULT_PRODUCT_CODE } from "@/lib/sipsa/constants"
import type { ChartPoint } from "@/lib/sipsa/dashboard-data"

export const description = "An interactive area chart"

const chartConfig = {
  prices: {
    label: "Precios",
  },
  medellin: {
    label: "Medellín",
    color: "var(--chart-1)",
  },
  bogota: {
    label: "Bogotá",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

type ChartAreaInteractiveProps = {
  dataByProduct: Record<string, ChartPoint[]>
  products: { code: string; name: string }[]
}

export function ChartAreaInteractive({
  dataByProduct,
  products,
}: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [productCode, setProductCode] = React.useState(DEFAULT_PRODUCT_CODE)

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const chartData = dataByProduct[productCode] ?? []

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date()
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  const selectedProduct =
    products.find((p) => p.code === productCode)?.name ?? "Fruta"

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Precios históricos</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Evolución de precios — {selectedProduct}
          </span>
          <span className="@[540px]/card:hidden">{selectedProduct}</span>
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <Select
            value={productCode}
            onValueChange={(value) => {
              if (value !== null) {
                setProductCode(value)
              }
            }}
          >
            <SelectTrigger size="sm" aria-label="Seleccionar fruta">
              <SelectValue placeholder="Fruta" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {products.map((product) => (
                <SelectItem
                  key={product.code}
                  value={product.code}
                  className="rounded-lg"
                >
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={(value) => {
              setTimeRange(value[0] ?? "90d")
            }}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Últimos 3 meses</ToggleGroupItem>
            <ToggleGroupItem value="30d">Últimos 30 días</ToggleGroupItem>
            <ToggleGroupItem value="7d">Últimos 7 días</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={(value) => {
              if (value !== null) {
                setTimeRange(value)
              }
            }}
          >
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Seleccionar período"
            >
              <SelectValue placeholder="Últimos 3 meses" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Últimos 3 meses
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Últimos 30 días
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Últimos 7 días
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillMedellin" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-medellin)"
                  stopOpacity={1.0}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-medellin)"
                  stopOpacity={0.1}
                />
              </linearGradient>
              <linearGradient id="fillBogota" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-bogota)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-bogota)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("es-CO", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("es-CO", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="bogota"
              type="natural"
              fill="url(#fillBogota)"
              stroke="var(--color-bogota)"
            />
            <Area
              dataKey="medellin"
              type="natural"
              fill="url(#fillMedellin)"
              stroke="var(--color-medellin)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
