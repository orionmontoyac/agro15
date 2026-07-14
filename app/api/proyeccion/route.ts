import { z } from "zod"

import {
  buildProjectionResult,
  estimateKilos,
  type ModoEntrada,
  type MonthlyPriceStat,
  type PriceStatRow,
  type YieldReference,
} from "@/lib/projections"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const bodySchema = z.object({
  productId: z.number().int().positive(),
  modoEntrada: z.enum(["kilos_directo", "plantas", "hectareas"]),
  cantidad: z.number().positive(),
})

type YieldRow = {
  unit_type: "planta" | "hectarea"
  yield_min: number
  yield_avg: number
  yield_max: number
  ciclo_meses: number
  plantas_por_hectarea: number | null
}

type RpcPriceStat = {
  window_years: number
  price_min: number | null
  price_max: number | null
  price_avg: number | null
  price_stddev: number | null
  sample_count: number | null
}

type RpcMonthlyPriceStat = {
  month_number: number
  price_min: number | null
  price_max: number | null
  price_avg: number | null
  price_stddev: number | null
  sample_count: number | null
}

function mapYield(row: YieldRow): YieldReference {
  return {
    unitType: row.unit_type,
    yieldMin: Number(row.yield_min),
    yieldAvg: Number(row.yield_avg),
    yieldMax: Number(row.yield_max),
    cicloMeses: Number(row.ciclo_meses),
    plantasPorHectarea:
      row.plantas_por_hectarea == null
        ? null
        : Number(row.plantas_por_hectarea),
  }
}

function mapStats(rows: RpcPriceStat[]): PriceStatRow[] {
  return rows.map((row) => {
    const years = Number(row.window_years)
    if (years !== 1 && years !== 3 && years !== 5) {
      throw new Error(`Ventana de precio inválida: ${years}`)
    }
    return {
      windowYears: years,
      priceMin: Number(row.price_min ?? 0),
      priceMax: Number(row.price_max ?? 0),
      priceAvg: Number(row.price_avg ?? 0),
      priceStddev:
        row.price_stddev == null ? null : Number(row.price_stddev),
      sampleCount: Number(row.sample_count ?? 0),
    }
  })
}

function mapMonthlyStats(rows: RpcMonthlyPriceStat[]): MonthlyPriceStat[] {
  return rows
    .map((row) => ({
      monthNumber: Number(row.month_number),
      priceMin: Number(row.price_min ?? 0),
      priceMax: Number(row.price_max ?? 0),
      priceAvg: Number(row.price_avg ?? 0),
      priceStddev:
        row.price_stddev == null ? null : Number(row.price_stddev),
      sampleCount: Number(row.sample_count ?? 0),
    }))
    .filter((row) => row.monthNumber >= 1 && row.monthNumber <= 12)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      { error: "Input inválido", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { productId, modoEntrada, cantidad } = parsed.data

  const { data: product, error: productError } = await supabase
    .from("sipsa_products")
    .select("id, product_code, product_name")
    .eq("id", productId)
    .maybeSingle()

  if (productError || !product) {
    return Response.json({ error: "Producto no encontrado" }, { status: 404 })
  }

  let yieldRef: YieldReference | null = null
  const { data: yieldRow, error: yieldError } = await supabase
    .from("product_yield_reference")
    .select(
      "unit_type, yield_min, yield_avg, yield_max, ciclo_meses, plantas_por_hectarea"
    )
    .eq("product_id", productId)
    .maybeSingle()

  if (yieldError) {
    return Response.json({ error: yieldError.message }, { status: 500 })
  }

  if (yieldRow) {
    yieldRef = mapYield(yieldRow as YieldRow)
  }

  let kilos
  try {
    kilos = estimateKilos(cantidad, yieldRef, modoEntrada as ModoEntrada)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo estimar kilos"
    return Response.json({ error: message }, { status: 400 })
  }

  const [{ data: statsRaw, error: statsError }, { data: monthlyRaw, error: monthlyError }] =
    await Promise.all([
      supabase.rpc("get_price_stats", { p_product_id: productId }),
      supabase.rpc("get_monthly_price_stats", { p_product_id: productId }),
    ])

  if (statsError) {
    return Response.json({ error: statsError.message }, { status: 500 })
  }
  if (monthlyError) {
    return Response.json({ error: monthlyError.message }, { status: 500 })
  }

  const stats = mapStats((statsRaw ?? []) as RpcPriceStat[])
  if (stats.every((s) => s.sampleCount === 0)) {
    return Response.json(
      { error: "Este producto no tiene precios históricos suficientes." },
      { status: 400 }
    )
  }

  const monthlyStats = mapMonthlyStats((monthlyRaw ?? []) as RpcMonthlyPriceStat[])
  const resultado = buildProjectionResult(stats, kilos, monthlyStats)
  const snapshot = {
    product: {
      id: product.id,
      code: product.product_code,
      name: product.product_name,
    },
    input: { productId, modoEntrada, cantidad },
    yieldReference: yieldRef,
    ...resultado,
  }

  // Internal Agro15 log (service role). User history lives in localStorage.
  const admin = createAdminClient()
  const { data: saved, error: saveError } = await admin
    .from("cultivo_proyecciones")
    .insert({
      product_id: productId,
      modo_entrada: modoEntrada,
      cantidad_unidades: cantidad,
      kilos_min: kilos.kilosMin,
      kilos_avg: kilos.kilosAvg,
      kilos_max: kilos.kilosMax,
      resultado: snapshot,
    })
    .select(
      "id, product_id, modo_entrada, cantidad_unidades, kilos_min, kilos_avg, kilos_max, resultado, created_at"
    )
    .single()

  if (saveError) {
    return Response.json({ error: saveError.message }, { status: 500 })
  }

  return Response.json({ projection: saved })
}
