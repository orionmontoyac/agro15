import type { ModoEntrada, ProjectionResult } from "@/lib/projections"

export const PROYECCIONES_STORAGE_KEY = "agro15.proyecciones.v1"
export const PROYECCIONES_HISTORY_LIMIT = 10

export type LocalProjection = {
  id: string
  product_id: number
  modo_entrada: ModoEntrada
  cantidad_unidades: number
  kilos_min: number
  kilos_avg: number
  kilos_max: number
  resultado: ProjectionResult & {
    product?: { id: number; code: string; name: string }
    input?: { productId: number; modoEntrada: ModoEntrada; cantidad: number }
  }
  created_at: string
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function readLocalProjections(): LocalProjection[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(PROYECCIONES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalProjection[]
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, PROYECCIONES_HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function writeLocalProjections(items: LocalProjection[]): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    PROYECCIONES_STORAGE_KEY,
    JSON.stringify(items.slice(0, PROYECCIONES_HISTORY_LIMIT))
  )
}

export function prependLocalProjection(item: LocalProjection): LocalProjection[] {
  const next = [
    item,
    ...readLocalProjections().filter((entry) => entry.id !== item.id),
  ].slice(0, PROYECCIONES_HISTORY_LIMIT)
  writeLocalProjections(next)
  return next
}
