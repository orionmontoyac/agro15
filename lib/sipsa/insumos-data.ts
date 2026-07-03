import { createClient } from "@/lib/supabase/server"

import { BOGOTA_CODE, MEDELLIN_CODE } from "./constants"

export type InsumoListRow = {
  insumoName: string
  category: string | null
  medellinPrice: number | null
  bogotaPrice: number | null
  lastMonth: string | null
}

export type InsumoMonthlyPoint = {
  periodMonth: string
  medellin: number | null
  bogota: number | null
}

export type InsumosPageData = {
  rows: InsumoListRow[]
  categories: string[]
  latestMonth: string | null
  hasData: boolean
}

type InsumoDbRow = {
  insumo_name: string
  municipality_code: string
  period_month: string
  average_price: number
  collection_type_name: string | null
}

function cityLabel(code: string): string {
  if (code === MEDELLIN_CODE) return "Medellín"
  if (code === BOGOTA_CODE) return "Bogotá"
  return code
}

function aggregateListRows(rows: InsumoDbRow[]): InsumoListRow[] {
  const byInsumo = new Map<
    string,
    {
      category: string | null
      medellin: { price: number; month: string } | null
      bogota: { price: number; month: string } | null
    }
  >()

  for (const row of rows) {
    if (!byInsumo.has(row.insumo_name)) {
      byInsumo.set(row.insumo_name, {
        category: row.collection_type_name,
        medellin: null,
        bogota: null,
      })
    }

    const entry = byInsumo.get(row.insumo_name)!
    const point = { price: Number(row.average_price), month: row.period_month }

    if (row.municipality_code === MEDELLIN_CODE) {
      if (!entry.medellin || row.period_month > entry.medellin.month) {
        entry.medellin = point
      }
    } else if (row.municipality_code === BOGOTA_CODE) {
      if (!entry.bogota || row.period_month > entry.bogota.month) {
        entry.bogota = point
      }
    }
  }

  return [...byInsumo.entries()]
    .map(([insumoName, data]) => {
      const months = [data.medellin?.month, data.bogota?.month].filter(
        (m): m is string => Boolean(m)
      )
      const lastMonth =
        months.length > 0
          ? months.sort((a, b) => b.localeCompare(a))[0]
          : null

      return {
        insumoName,
        category: data.category,
        medellinPrice: data.medellin?.price ?? null,
        bogotaPrice: data.bogota?.price ?? null,
        lastMonth,
      }
    })
    .sort((a, b) => a.insumoName.localeCompare(b.insumoName, "es"))
}

export async function getInsumosPageData(): Promise<
  InsumosPageData & { historyByInsumo: Record<string, InsumoMonthlyPoint[]> }
> {
  const supabase = await createClient()
  const start = new Date()
  start.setMonth(start.getMonth() - 36)
  const startIso = start.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("sipsa_insumos_monthly")
    .select(
      "insumo_name, municipality_code, period_month, average_price, collection_type_name"
    )
    .in("municipality_code", [MEDELLIN_CODE, BOGOTA_CODE])
    .gte("period_month", startIso)
    .order("period_month", { ascending: true })

  if (error || !data?.length) {
    return {
      rows: [],
      categories: [],
      latestMonth: null,
      hasData: false,
      historyByInsumo: {},
    }
  }

  const dbRows = data as InsumoDbRow[]
  const rows = aggregateListRows(dbRows)
  const categories = [
    ...new Set(
      dbRows
        .map((row) => row.collection_type_name)
        .filter((name): name is string => Boolean(name))
    ),
  ].sort((a, b) => a.localeCompare(b, "es"))

  const latestMonth =
    rows.length > 0
      ? rows
          .map((row) => row.lastMonth)
          .filter((m): m is string => Boolean(m))
          .sort((a, b) => b.localeCompare(a))[0] ?? null
      : null

  const historyByInsumo: Record<string, InsumoMonthlyPoint[]> = {}

  for (const row of dbRows) {
    if (!historyByInsumo[row.insumo_name]) {
      historyByInsumo[row.insumo_name] = []
    }

    let point = historyByInsumo[row.insumo_name].find(
      (entry) => entry.periodMonth === row.period_month
    )

    if (!point) {
      point = {
        periodMonth: row.period_month,
        medellin: null,
        bogota: null,
      }
      historyByInsumo[row.insumo_name].push(point)
    }

    const price = Number(row.average_price)
    if (row.municipality_code === MEDELLIN_CODE) {
      point.medellin = price
    } else if (row.municipality_code === BOGOTA_CODE) {
      point.bogota = price
    }
  }

  for (const history of Object.values(historyByInsumo)) {
    history.sort((a, b) => a.periodMonth.localeCompare(b.periodMonth))
  }

  return {
    rows,
    categories,
    latestMonth,
    hasData: rows.length > 0,
    historyByInsumo,
  }
}

export async function getInsumoHistory(
  insumoName: string
): Promise<InsumoMonthlyPoint[]> {
  const supabase = await createClient()
  const start = new Date()
  start.setMonth(start.getMonth() - 24)
  const startIso = start.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from("sipsa_insumos_monthly")
    .select("municipality_code, period_month, average_price")
    .eq("insumo_name", insumoName)
    .in("municipality_code", [MEDELLIN_CODE, BOGOTA_CODE])
    .gte("period_month", startIso)
    .order("period_month", { ascending: true })

  if (error || !data?.length) return []

  const byMonth = new Map<string, InsumoMonthlyPoint>()

  for (const row of data) {
    const month = row.period_month as string
    if (!byMonth.has(month)) {
      byMonth.set(month, { periodMonth: month, medellin: null, bogota: null })
    }
    const point = byMonth.get(month)!
    const price = Number(row.average_price)

    if (row.municipality_code === MEDELLIN_CODE) {
      point.medellin = price
    } else if (row.municipality_code === BOGOTA_CODE) {
      point.bogota = price
    }
  }

  return [...byMonth.values()].sort((a, b) =>
    a.periodMonth.localeCompare(b.periodMonth)
  )
}

export { cityLabel as insumoCityLabel }
