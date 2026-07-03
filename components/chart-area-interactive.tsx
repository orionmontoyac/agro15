"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

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
  ChartLegendContent,
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
import {
  BOGOTA_CODE,
  DEFAULT_PRODUCT_CODE,
  MEDELLIN_CODE,
  type MunicipalityFilter,
} from "@/lib/sipsa/constants"
import {
  fillChartSeriesGaps,
  getChartRangeEndIso,
  getChartRangeStartIso,
  type ChartPoint,
} from "@/lib/sipsa/chart-series"

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

type SeriesKey = "medellin" | "bogota"

type WindowStats = {
  min: number
  max: number
  avg: number
  count: number
  maxPoint: { date: string; series: SeriesKey; value: number }
  minPoint: { date: string; series: SeriesKey; value: number }
}

function formatChartAxisPrice(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatFullPrice(value: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value) + "/kg"
  )
}

function formatChartDate(date: string): string {
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function computeWindowStats(
  data: ChartPoint[],
  seriesKeys: SeriesKey[]
): WindowStats | null {
  const points: { date: string; series: SeriesKey; value: number }[] = []

  for (const row of data) {
    for (const key of seriesKeys) {
      const value = row[key]
      if (value != null && !Number.isNaN(value)) {
        points.push({ date: row.date, series: key, value })
      }
    }
  }

  if (points.length === 0) return null

  const values = points.map((p) => p.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length
  const maxPoint = points.reduce((best, cur) =>
    cur.value > best.value ? cur : best
  )
  const minPoint = points.reduce((best, cur) =>
    cur.value < best.value ? cur : best
  )

  return { min, max, avg, count: points.length, maxPoint, minPoint }
}

function ChartStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      {detail ? (
        <span className="text-xs text-muted-foreground">{detail}</span>
      ) : null}
    </div>
  )
}

type ChartAreaInteractiveProps = {
  dataByProduct: Record<string, ChartPoint[]>
  dataByPeriod?: {
    day: ChartPoint[]
    week: ChartPoint[]
    month: ChartPoint[]
  }
  products: { code: string; name: string }[]
  hideProductSelector?: boolean
  defaultProductCode?: string
  municipalityFilter?: MunicipalityFilter
}

type PeriodType = "day" | "week" | "month"

export function ChartAreaInteractive({
  dataByProduct,
  dataByPeriod,
  products,
  hideProductSelector = false,
  defaultProductCode = DEFAULT_PRODUCT_CODE,
  municipalityFilter = "all",
}: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [periodType, setPeriodType] = React.useState<PeriodType>("day")
  const [productCode, setProductCode] = React.useState(defaultProductCode)
  const chartId = React.useId().replace(/:/g, "")

  React.useEffect(() => {
    setProductCode(defaultProductCode)
  }, [defaultProductCode])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const chartData =
    dataByPeriod && hideProductSelector
      ? dataByPeriod[periodType]
      : dataByProduct[productCode] ?? []

  const daysInRange =
    timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
  const rangeStartIso = getChartRangeStartIso(daysInRange)
  const rangeEndIso = getChartRangeEndIso()

  const filteredData = chartData.filter(
    (item) => item.date >= rangeStartIso && item.date <= rangeEndIso
  )

  const chartDisplayData = React.useMemo(
    () => fillChartSeriesGaps(filteredData, rangeStartIso, rangeEndIso),
    [filteredData, rangeStartIso, rangeEndIso]
  )

  const selectedProduct =
    products.find((p) => p.code === productCode)?.name ?? "Fruta"

  const showMedellin =
    municipalityFilter === "all" || municipalityFilter === MEDELLIN_CODE
  const showBogota =
    municipalityFilter === "all" || municipalityFilter === BOGOTA_CODE

  const activeSeries: SeriesKey[] = []
  if (showMedellin) activeSeries.push("medellin")
  if (showBogota) activeSeries.push("bogota")

  const windowStats = computeWindowStats(filteredData, activeSeries)
  const showLegend = activeSeries.length > 1

  const timeRangeLabel =
    timeRange === "7d"
      ? "7 días"
      : timeRange === "30d"
        ? "30 días"
        : "3 meses"

  const showMinMaxBand = periodType === "day"

  return (
    <Card className="@container/card bg-linear-to-t from-primary/10 to-card shadow-xs dark:bg-card">
      <CardHeader>
        <CardTitle>Precios históricos</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Evolución de precios — {selectedProduct} · Precio en COP/kg
            {periodType !== "day" ? " (promedio del período)" : ""}
          </span>
          <span className="@[540px]/card:hidden">
            {selectedProduct} · COP/kg
          </span>
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          {dataByPeriod && hideProductSelector ? (
            <ToggleGroup
              multiple={false}
              value={[periodType]}
              onValueChange={(value) => {
                setPeriodType((value[0] ?? "day") as PeriodType)
              }}
              variant="outline"
              className="*:data-[slot=toggle-group-item]:px-3!"
            >
              <ToggleGroupItem value="day">Diario</ToggleGroupItem>
              <ToggleGroupItem value="week">Semanal</ToggleGroupItem>
              <ToggleGroupItem value="month">Mensual</ToggleGroupItem>
            </ToggleGroup>
          ) : null}
          {!hideProductSelector && (
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
          )}
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
        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No hay datos en el período seleccionado
          </div>
        ) : (
          <>
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[280px] w-full"
            >
              <AreaChart
                data={chartDisplayData}
                margin={{ top: 16, right: 12, left: 8, bottom: 8 }}
              >
                <defs>
                  <linearGradient
                    id={`fillMedellin-${chartId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-medellin)"
                      stopOpacity={0.45}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-medellin)"
                      stopOpacity={0.06}
                    />
                  </linearGradient>
                  <linearGradient
                    id={`fillBogota-${chartId}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-bogota)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-bogota)"
                      stopOpacity={0.06}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  strokeOpacity={0.9}
                />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickMargin={8}
                  minTickGap={32}
                  tick={{ fill: "var(--foreground)", opacity: 0.65, fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString("es-CO", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  label={{
                    value: "Fecha",
                    position: "insideBottom",
                    offset: -4,
                    style: { fill: "var(--foreground)", opacity: 0.7, fontSize: 12 },
                  }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickMargin={8}
                  width={72}
                  tickFormatter={formatChartAxisPrice}
                  tick={{ fill: "var(--foreground)", opacity: 0.65, fontSize: 12 }}
                  label={{
                    value: "COP/kg",
                    angle: -90,
                    position: "insideLeft",
                    offset: 12,
                    dx: -10,
                    style: { fill: "var(--foreground)", opacity: 0.7, fontSize: 12 },
                  }}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "4 4" }}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => formatChartDate(String(value))}
                      formatter={(value, name) => (
                        <div className="flex w-full items-center justify-between gap-4">
                          <span className="text-muted-foreground">
                            {chartConfig[name as SeriesKey]?.label ?? name}
                          </span>
                          <span className="font-mono font-medium tabular-nums">
                            {formatFullPrice(Number(value))}
                          </span>
                        </div>
                      )}
                      indicator="dot"
                    />
                  }
                />
                {showLegend && (
                  <Legend content={<ChartLegendContent />} verticalAlign="top" />
                )}
                {windowStats && (
                  <>
                    <ReferenceLine
                      x={windowStats.maxPoint.date}
                      stroke="var(--color-chart-3)"
                      strokeDasharray="5 4"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                    />
                    <ReferenceDot
                      x={windowStats.maxPoint.date}
                      y={windowStats.maxPoint.value}
                      r={6}
                      fill="var(--color-chart-3)"
                      stroke="var(--background)"
                      strokeWidth={2}
                      ifOverflow="extendDomain"
                      label={{
                        value: `Máx ${formatChartAxisPrice(windowStats.maxPoint.value)}`,
                        position: "top",
                        fill: "var(--foreground)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    />
                  </>
                )}
                {showBogota && (
                  <Area
                    dataKey="bogota"
                    name="bogota"
                    type="monotone"
                    connectNulls
                    fill={`url(#fillBogota-${chartId})`}
                    stroke="var(--color-bogota)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
                  />
                )}
                {showMedellin && (
                  <Area
                    dataKey="medellin"
                    name="medellin"
                    type="monotone"
                    connectNulls
                    fill={`url(#fillMedellin-${chartId})`}
                    stroke="var(--color-medellin)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
                  />
                )}
                {showMinMaxBand && showMedellin && (
                  <>
                    <Line
                      dataKey="medellinMax"
                      name="medellinMax"
                      type="monotone"
                      connectNulls
                      stroke="var(--color-medellin)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                      dot={false}
                      legendType="none"
                    />
                    <Line
                      dataKey="medellinMin"
                      name="medellinMin"
                      type="monotone"
                      connectNulls
                      stroke="var(--color-medellin)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                      dot={false}
                      legendType="none"
                    />
                  </>
                )}
                {showMinMaxBand && showBogota && (
                  <>
                    <Line
                      dataKey="bogotaMax"
                      name="bogotaMax"
                      type="monotone"
                      connectNulls
                      stroke="var(--color-bogota)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                      dot={false}
                      legendType="none"
                    />
                    <Line
                      dataKey="bogotaMin"
                      name="bogotaMin"
                      type="monotone"
                      connectNulls
                      stroke="var(--color-bogota)"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      strokeOpacity={0.45}
                      dot={false}
                      legendType="none"
                    />
                  </>
                )}
              </AreaChart>
            </ChartContainer>

            {windowStats && (
              <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                <ChartStat
                  label={`Máximo (${timeRangeLabel})`}
                  value={formatFullPrice(windowStats.max)}
                  detail={`${formatChartDate(windowStats.maxPoint.date)} · ${chartConfig[windowStats.maxPoint.series].label}`}
                />
                <ChartStat
                  label={`Mínimo (${timeRangeLabel})`}
                  value={formatFullPrice(windowStats.min)}
                  detail={`${formatChartDate(windowStats.minPoint.date)} · ${chartConfig[windowStats.minPoint.series].label}`}
                />
                <ChartStat
                  label={`Promedio (${timeRangeLabel})`}
                  value={formatFullPrice(windowStats.avg)}
                />
                <ChartStat
                  label="Observaciones"
                  value={String(windowStats.count)}
                  detail="Precios en el período"
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
