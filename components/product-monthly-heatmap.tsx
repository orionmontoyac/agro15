"use client"

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  getCellPrice,
  getHeatmapColor,
  getTopHighestPriceCellsByYear,
  getTopLowestPriceCellsByYear,
  isMarkedCell,
  MONTH_LABELS,
  type MonthlyHeatmapData,
} from "@/lib/sipsa/monthly-heatmap"

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function formatCompactPrice(price: number): string {
  if (price >= 1000) {
    const thousands = price / 1000
    const formatted =
      thousands >= 10
        ? Math.round(thousands).toString()
        : thousands.toFixed(1).replace(/\.0$/, "")
    return `$${formatted}k`
  }
  return `$${Math.round(price)}`
}

function formatTooltipPrice(price: number, year: number, month: number): string {
  const monthName = MONTH_LABELS[month - 1]
  return `${monthName} ${year}: ${formatPrice(price)}`
}

type HeatmapGridProps = {
  data: MonthlyHeatmapData
  cityLabel?: string
}

function HeatmapGrid({ data, cityLabel }: HeatmapGridProps) {
  const { years, minPrice, maxPrice } = data
  const highestCells = getTopHighestPriceCellsByYear(data, 3)
  const lowestCells = getTopLowestPriceCellsByYear(data, 3)

  if (years.length === 0 || minPrice === null || maxPrice === null) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      {cityLabel ? (
        <p className="text-sm font-medium text-muted-foreground">{cityLabel}</p>
      ) : null}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[3rem_repeat(12,minmax(0,1fr))] gap-1">
            <div />
            {MONTH_LABELS.map((label) => (
              <div
                key={label}
                className="text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}

            {years.map((year) => (
              <div
                key={year}
                className="contents"
              >
                <div className="flex items-center text-xs font-medium text-muted-foreground">
                  {year}
                </div>
                {MONTH_LABELS.map((_, monthIndex) => {
                  const month = monthIndex + 1
                  const price = getCellPrice(data, year, month)
                  const hasPrice = price !== null
                  const showHighPrice =
                    hasPrice && isMarkedCell(highestCells, year, month)
                  const showLowPrice =
                    hasPrice && isMarkedCell(lowestCells, year, month)

                  const tooltipSuffix = [
                    showHighPrice ? "Precio alto del año" : null,
                    showLowPrice ? "Precio bajo del año" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")

                  return (
                    <div
                      key={`${year}-${month}`}
                      className={`relative flex min-h-10 items-center justify-center rounded-sm px-0.5 text-[10px] font-medium leading-tight sm:min-h-11 sm:text-xs ${
                        hasPrice ? "" : "bg-muted/40"
                      }`}
                      style={
                        hasPrice
                          ? {
                              backgroundColor: getHeatmapColor(
                                price,
                                minPrice,
                                maxPrice
                              ),
                              color: "white",
                            }
                          : undefined
                      }
                      title={
                        hasPrice
                          ? `${formatTooltipPrice(price, year, month)}${tooltipSuffix ? ` · ${tooltipSuffix}` : ""}`
                          : undefined
                      }
                    >
                      {showHighPrice ? (
                        <TrendingUpIcon
                          className="absolute right-0.5 top-0.5 size-4 drop-shadow-sm"
                          aria-hidden
                        />
                      ) : null}
                      {showLowPrice ? (
                        <TrendingDownIcon
                          className="absolute left-0.5 top-0.5 size-3 drop-shadow-sm"
                          aria-hidden
                        />
                      ) : null}
                      {hasPrice ? (
                        <span className="drop-shadow-sm">
                          {formatCompactPrice(price)}
                        </span>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:gap-4">
        <p className="flex items-center gap-1">
          <TrendingUpIcon className="size-3" aria-hidden />
          los 3 precios más altos de cada año
        </p>
        <p className="flex items-center gap-1">
          <TrendingDownIcon className="size-3" aria-hidden />
          los 3 precios más bajos de cada año
        </p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="text-xs text-muted-foreground">Bajo</span>
        <div
          className="h-2 flex-1 rounded-full"
          style={{
            background:
              "linear-gradient(to right, hsl(0, 75%, 50%), hsl(45, 70%, 50%), hsl(142, 70%, 45%))",
          }}
        />
        <span className="text-xs text-muted-foreground">Alto</span>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatPrice(minPrice)}</span>
        <span>{formatPrice(maxPrice)}</span>
      </div>
    </div>
  )
}

type ProductMonthlyHeatmapProps = {
  medellin: MonthlyHeatmapData
  bogota: MonthlyHeatmapData
  showMedellin: boolean
  showBogota: boolean
}

export function ProductMonthlyHeatmap({
  medellin,
  bogota,
  showMedellin,
  showBogota,
}: ProductMonthlyHeatmapProps) {
  const hasMedellin = showMedellin && medellin.years.length > 0
  const hasBogota = showBogota && bogota.years.length > 0

  if (!hasMedellin && !hasBogota) {
    return null
  }

  const showBoth = hasMedellin && hasBogota

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico mensual</CardTitle>
        <CardDescription>
          Promedio mensual de precio diario SIPSA por año y mes
        </CardDescription>
        <CardAction>
          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
            <div className="flex items-center gap-1" title="Los 3 precios más altos de cada año">
              <TrendingUpIcon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Precio alto</span>
            </div>
            <div className="flex items-center gap-1" title="Los 3 precios más bajos de cada año">
              <TrendingDownIcon className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Precio bajo</span>
            </div>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {hasMedellin ? (
          <HeatmapGrid
            data={medellin}
            cityLabel={showBoth ? "Medellín" : undefined}
          />
        ) : null}
        {hasBogota ? (
          <HeatmapGrid
            data={bogota}
            cityLabel={showBoth ? "Bogotá" : undefined}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}
