import { createPublicClient } from "@/lib/supabase/public"

import type { InsumoIndiceDataset, InsumoIndiceSerie } from "./indice-types"

type IndiceRow = {
  fecha: string
  categoria: string
  producto: string
  valor: number | string | null
}

/** PostgREST caps responses at 1000 rows; page through the whole table. */
const PAGE_SIZE = 1000

/**
 * Load UPRA index series (insumos agrícolas + alimentos balanceados)
 * as month-aligned arrays. ~6k rows for everything, compact enough to ship to
 * the client. Pass `productos` to load only some series.
 */
export async function getInsumoIndiceDataset(
  options: { productos?: string[] } = {}
): Promise<InsumoIndiceDataset> {
  const supabase = createPublicClient()
  const productos = options.productos?.length ? options.productos : null

  // Count first, then fetch all pages in parallel instead of one after another.
  let countQuery = supabase
    .from("insumo_precio_indice")
    .select("id", { count: "exact", head: true })
  if (productos) countQuery = countQuery.in("producto", productos)
  const { count, error: countError } = await countQuery
  if (countError) {
    console.error("insumo_precio_indice count failed:", countError.message)
  }

  const pageCount = Math.ceil((count ?? 0) / PAGE_SIZE)
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => {
      let query = supabase
        .from("insumo_precio_indice")
        .select("fecha, categoria, producto, valor")
      if (productos) query = query.in("producto", productos)
      return query
        .order("fecha", { ascending: true })
        .order("producto", { ascending: true })
        .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1)
    })
  )

  const rows: IndiceRow[] = []
  for (const { data, error } of pages) {
    if (error) {
      console.error("insumo_precio_indice load failed:", error.message)
      continue
    }
    rows.push(...((data ?? []) as IndiceRow[]))
  }

  const fechas = [...new Set(rows.map((r) => r.fecha))].sort()
  const fechaIndex = new Map(fechas.map((f, i) => [f, i]))
  const byProducto = new Map<string, InsumoIndiceSerie>()

  for (const row of rows) {
    let serie = byProducto.get(row.producto)
    if (!serie) {
      serie = {
        producto: row.producto,
        categoria: row.categoria,
        valores: new Array<number | null>(fechas.length).fill(null),
      }
      byProducto.set(row.producto, serie)
    }
    const idx = fechaIndex.get(row.fecha)
    if (idx != null && row.valor != null) serie.valores[idx] = Number(row.valor)
  }

  return {
    fechas,
    series: [...byProducto.values()],
    latestFecha: fechas.at(-1) ?? null,
  }
}
