import { createClient } from "@/lib/supabase/server"

import { BOGOTA_CODE, MEDELLIN_CODE } from "./constants"

export type SupplyMonthRow = {
  periodMonth: string
  municipalityCode: string
  city: string
  quantityTons: number
}

export type SupplySourceRow = {
  sourceName: string
  quantityTons: number
}

export type ProductSupplySummary = {
  monthly: SupplyMonthRow[]
  latestMonthSources: {
    medellin: SupplySourceRow[]
    bogota: SupplySourceRow[]
  }
  latestMonth: string | null
  hasData: boolean
}

type SupplyDbRow = {
  period_month: string
  quantity_tons: number
  source_id: string | null
  source_name: string | null
  sipsa_municipalities: {
    municipality_code: string
    municipality_name: string
  } | null
}

function normalizeSupplyRow(row: Record<string, unknown>): SupplyDbRow {
  const municipalities = row.sipsa_municipalities
  const municipality =
    Array.isArray(municipalities) && municipalities.length > 0
      ? (municipalities[0] as {
          municipality_code: string
          municipality_name: string
        })
      : municipalities && !Array.isArray(municipalities)
        ? (municipalities as {
            municipality_code: string
            municipality_name: string
          })
        : null

  return {
    period_month: String(row.period_month),
    quantity_tons: Number(row.quantity_tons),
    source_id: row.source_id != null ? String(row.source_id) : null,
    source_name: row.source_name != null ? String(row.source_name) : null,
    sipsa_municipalities: municipality,
  }
}

function cityLabel(code: string, name: string | undefined): string {
  if (code === MEDELLIN_CODE) return "Medellín"
  if (code === BOGOTA_CODE) return "Bogotá"
  return name ?? code
}

export async function getProductSupply(
  productId: number
): Promise<ProductSupplySummary> {
  const supabase = await createClient()
  const start = new Date()
  start.setMonth(start.getMonth() - 12)
  const startIso = start.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("sipsa_supply_monthly")
    .select(
      `
      period_month,
      quantity_tons,
      source_id,
      source_name,
      sipsa_municipalities ( municipality_code, municipality_name )
    `
    )
    .eq("product_id", productId)
    .gte("period_month", startIso)
    .order("period_month", { ascending: true })

  if (error || !data?.length) {
    return {
      monthly: [],
      latestMonthSources: { medellin: [], bogota: [] },
      latestMonth: null,
      hasData: false,
    }
  }

  const rows = data.map((row) =>
    normalizeSupplyRow(row as Record<string, unknown>)
  )

  const monthlyMap = new Map<string, Map<string, number>>()

  for (const row of rows) {
    const code = row.sipsa_municipalities?.municipality_code
    if (!code) continue

    if (!monthlyMap.has(row.period_month)) {
      monthlyMap.set(row.period_month, new Map())
    }
    const cityMap = monthlyMap.get(row.period_month)!
    cityMap.set(code, (cityMap.get(code) ?? 0) + row.quantity_tons)
  }

  const monthly: SupplyMonthRow[] = []
  for (const [periodMonth, cityMap] of monthlyMap.entries()) {
    for (const [municipalityCode, quantityTons] of cityMap.entries()) {
      monthly.push({
        periodMonth,
        municipalityCode,
        city: cityLabel(
          municipalityCode,
          rows.find(
            (r) =>
              r.period_month === periodMonth &&
              r.sipsa_municipalities?.municipality_code === municipalityCode
          )?.sipsa_municipalities?.municipality_name
        ),
        quantityTons,
      })
    }
  }

  monthly.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))

  const latestMonth =
    monthly.length > 0
      ? monthly[monthly.length - 1].periodMonth
      : null

  const latestRows = latestMonth
    ? rows.filter((row) => row.period_month === latestMonth)
    : []

  function sourcesForCity(code: string): SupplySourceRow[] {
    return latestRows
      .filter((row) => row.sipsa_municipalities?.municipality_code === code)
      .map((row) => ({
        sourceName: row.source_name ?? "Sin nombre",
        quantityTons: row.quantity_tons,
      }))
      .sort((a, b) => b.quantityTons - a.quantityTons)
      .slice(0, 5)
  }

  return {
    monthly,
    latestMonthSources: {
      medellin: sourcesForCity(MEDELLIN_CODE),
      bogota: sourcesForCity(BOGOTA_CODE),
    },
    latestMonth,
    hasData: monthly.length > 0,
  }
}
