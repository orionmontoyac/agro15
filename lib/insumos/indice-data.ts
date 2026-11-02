import { createClient } from "@/lib/supabase/server"

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
  const supabase = await createClient()
  const rows: IndiceRow[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("insumo_precio_indice")
      .select("fecha, categoria, producto, valor")
    if (options.productos?.length) query = query.in("producto", options.productos)
    const { data, error } = await query
      .order("fecha", { ascending: true })
      .order("producto", { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("insumo_precio_indice load failed:", error.message)
      break
    }
    rows.push(...((data ?? []) as IndiceRow[]))
    if (!data || data.length < PAGE_SIZE) break
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
