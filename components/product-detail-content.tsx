"use client"

import * as React from "react"

import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { ProductCityCards } from "@/components/product-city-cards"
import { ProductLastSevenDays } from "@/components/product-last-seven-days"
import { ProductMonthlyHeatmap } from "@/components/product-monthly-heatmap"
import { ProductPeriodSummary } from "@/components/product-period-summary"
import { ProductPriceTrend } from "@/components/product-price-trend"
import { ProductSupplySection } from "@/components/product-supply-section"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  BOGOTA_CODE,
  MEDELLIN_CODE,
  MUNICIPALITY_FILTER_OPTIONS,
  type MunicipalityFilter,
} from "@/lib/sipsa/constants"
import type { ChartPoint, PeriodSummary } from "@/lib/sipsa/price-fetch"
import type {
  CitySummary,
  MergedDailyPriceEntry,
  MonthlyHeatmapData,
  ProductPriceTrend as ProductPriceTrendData,
  ProductSupplySummary,
} from "@/lib/sipsa/products-data"

type ProductDetailContentProps = {
  product: { code: string; name: string }
  medellin: CitySummary | null
  bogota: CitySummary | null
  chartSeries: ChartPoint[]
  chartSeriesWeek: ChartPoint[]
  chartSeriesMonth: ChartPoint[]
  periodSummaries: {
    medellin: { week: PeriodSummary | null; month: PeriodSummary | null }
    bogota: { week: PeriodSummary | null; month: PeriodSummary | null }
  }
  supply: ProductSupplySummary
  lastSevenDays: MergedDailyPriceEntry[]
  priceTrend: ProductPriceTrendData
  monthlyHeatmap: {
    medellin: MonthlyHeatmapData
    bogota: MonthlyHeatmapData
  }
}

export function ProductDetailContent({
  product,
  medellin,
  bogota,
  chartSeries,
  chartSeriesWeek,
  chartSeriesMonth,
  periodSummaries,
  supply,
  lastSevenDays,
  priceTrend,
  monthlyHeatmap,
}: ProductDetailContentProps) {
  const [municipalityFilter, setMunicipalityFilter] =
    React.useState<MunicipalityFilter>(MEDELLIN_CODE)

  const showMedellin =
    municipalityFilter === "all" || municipalityFilter === MEDELLIN_CODE
  const showBogota =
    municipalityFilter === "all" || municipalityFilter === BOGOTA_CODE

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Filtrar por mercado</h3>
          <p className="text-sm text-muted-foreground">
            Muestra precios de un municipio o de todos
          </p>
        </div>
        <ToggleGroup
          multiple={false}
          value={municipalityFilter ? [municipalityFilter] : []}
          onValueChange={(value) => {
            setMunicipalityFilter((value[0] ?? MEDELLIN_CODE) as MunicipalityFilter)
          }}
          variant="outline"
          className="w-full flex-wrap sm:w-auto *:data-[slot=toggle-group-item]:px-3!"
          aria-label="Filtrar por mercado"
        >
          {MUNICIPALITY_FILTER_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <ProductCityCards
        medellin={medellin}
        bogota={bogota}
        showMedellin={showMedellin}
        showBogota={showBogota}
      />

      <ProductPeriodSummary
        medellin={periodSummaries.medellin}
        bogota={periodSummaries.bogota}
        showMedellin={showMedellin}
        showBogota={showBogota}
      />

      <ProductLastSevenDays
        entries={lastSevenDays}
        showMedellin={showMedellin}
        showBogota={showBogota}
      />

      <ChartAreaInteractive
        dataByProduct={{ [product.code]: chartSeries }}
        products={[{ code: product.code, name: product.name }]}
        hideProductSelector
        defaultProductCode={product.code}
        municipalityFilter={municipalityFilter}
      />

      <ProductPriceTrend
        trend={priceTrend}
        showMedellin={showMedellin}
        showBogota={showBogota}
      />

      <ProductSupplySection
        supply={supply}
        municipalityFilter={municipalityFilter}
      />

      <ProductMonthlyHeatmap
        medellin={monthlyHeatmap.medellin}
        bogota={monthlyHeatmap.bogota}
        showMedellin={showMedellin}
        showBogota={showBogota}
      />
    </div>
  )
}
