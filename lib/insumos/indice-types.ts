export type InsumoIndiceSerie = {
  producto: string
  categoria: string
  /** Aligned with `InsumoIndiceDataset.fechas`; null = sin reporte. */
  valores: (number | null)[]
}

export type InsumoIndiceDataset = {
  /** Sorted ascending, first day of month (YYYY-MM-01). */
  fechas: string[]
  series: InsumoIndiceSerie[]
  latestFecha: string | null
}

export type InsumoRangoKey = "6M" | "1A" | "3A" | "Todo"

export const INSUMO_RANGO_OPTIONS: { key: InsumoRangoKey; label: string }[] = [
  { key: "6M", label: "6M" },
  { key: "1A", label: "1A" },
  { key: "3A", label: "3A" },
  { key: "Todo", label: "Todo" },
]

export type InsumoGrupoKey =
  | "fertilizantes"
  | "plaguicidas"
  | "otros"
  | "alimentos_balanceados"

export type InsumoGrupo = {
  key: InsumoGrupoKey
  label: string
  description: string
  /** Group headline series. */
  total: string
  /** Sub-index series drawn by default in the chart. */
  subtotales: string[]
  /** Categorias whose individual products belong to this group. */
  categorias: string[]
}

export const INSUMO_GRUPOS: InsumoGrupo[] = [
  {
    key: "fertilizantes",
    label: "Fertilizantes",
    description: "Simples (urea, DAP, KCl…) y compuestos (15-15-15, 25-4-24…).",
    total: "Total_Fertilizantes",
    subtotales: ["Total_Simples", "Total_Compuestos"],
    categorias: ["fertilizantes_simples", "fertilizantes_compuestos"],
  },
  {
    key: "plaguicidas",
    label: "Plaguicidas",
    description: "Herbicidas, fungicidas e insecticidas más usados.",
    total: "Total_Plaguicidas",
    subtotales: ["Total_Herbicidas", "Total_Fungicidas", "Total_Insecticidas"],
    categorias: ["herbicidas", "fungicidas", "insecticidas"],
  },
  {
    key: "alimentos_balanceados",
    label: "Alimentos balanceados",
    description: "Concentrados para acuicultura, avicultura, bovinos y porcicultura.",
    total: "Total_Alimentos_balanceados",
    subtotales: [
      "ABA Acuicultura",
      "ABA Avicultura",
      "ABA Bovinos",
      "ABA Porcicultura",
    ],
    categorias: [],
  },
  {
    key: "otros",
    label: "Otros insumos",
    description: "Coadyuvantes, reguladores fisiológicos y molusquicidas.",
    total: "Total_Otros",
    subtotales: ["Total_Coadyuvantes", "Total_Reguladores", "Total_Molusquicidas"],
    categorias: [],
  },
]

export const CATEGORIA_LABELS: Record<string, string> = {
  total: "Total",
  fertilizantes: "Fertilizantes",
  plaguicidas: "Plaguicidas",
  otros: "Otros",
  fertilizantes_simples: "Simple",
  fertilizantes_compuestos: "Compuesto",
  herbicidas: "Herbicida",
  fungicidas: "Fungicida",
  insecticidas: "Insecticida",
  coadyuvantes: "Coadyuvante",
  reguladores: "Regulador",
  molusquicidas: "Molusquicida",
  alimentos_balanceados: "Alimento balanceado",
}

const PRODUCTO_LABELS: Record<string, string> = {
  Indice_total: "Índice total agrícola",
  Total_Fertilizantes: "Fertilizantes",
  Total_Plaguicidas: "Plaguicidas",
  Total_Otros: "Otros insumos",
  Total_Simples: "Fertilizantes simples",
  Total_Compuestos: "Fertilizantes compuestos",
  Total_Herbicidas: "Herbicidas",
  Total_Fungicidas: "Fungicidas",
  Total_Insecticidas: "Insecticidas",
  Total_Coadyuvantes: "Coadyuvantes",
  Total_Reguladores: "Reguladores fisiológicos",
  Total_Molusquicidas: "Molusquicidas",
  Total_Alimentos_balanceados: "Alimentos balanceados",
  "ABA Acuicultura": "Acuicultura",
  "ABA Avicultura": "Avicultura",
  "ABA Bovinos": "Bovinos",
  "ABA Porcicultura": "Porcicultura",
  SAM: "SAM (sulfato de amonio)",
  "KCL 0-0-60": "KCl 0-0-60",
}

export function categoriaLabel(categoria: string): string {
  return CATEGORIA_LABELS[categoria] ?? categoria
}

export function productoLabel(producto: string): string {
  return PRODUCTO_LABELS[producto] ?? producto.replaceAll("_", " ")
}

/** Index of the first month inside the range, given the dataset's months. */
export function rangoStartIndex(fechas: string[], rango: InsumoRangoKey): number {
  if (rango === "Todo" || fechas.length === 0) return 0
  const months = rango === "6M" ? 6 : rango === "1A" ? 12 : 36
  // Anchor on latest published month, not today: UPRA publishes with ~2 months lag.
  return Math.max(0, fechas.length - 1 - months)
}

export function formatIndiceValor(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(value)
}

export function formatPct(value: number | null, withSign = true): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const abs = new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(Math.abs(value))
  if (!withSign) return `${abs}%`
  if (Math.abs(value) < 0.05) return `${abs}%`
  return `${value > 0 ? "+" : "−"}${abs}%`
}

export function formatIndiceFecha(fecha: string): string {
  const [y, m] = fecha.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CO", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
}

export function formatMesLargo(fecha: string): string {
  const [y, m] = fecha.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
}

/**
 * Economic impact for farmers: higher input prices are worse.
 */
export function impactoEconomico(
  changePct: number | null
): "bad" | "good" | "neutral" {
  if (changePct === null || Math.abs(changePct) < 0.05) return "neutral"
  return changePct > 0 ? "bad" : "good"
}

function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null
  return ((to - from) / from) * 100
}

export type SerieResumen = {
  valorActual: number | null
  fechaActual: string | null
  /** % change vs previous month. */
  cambioMes: number | null
  /** % change vs same month last year. */
  cambio12m: number | null
  /** % change vs base (ene-2021 = 100). */
  cambioBase: number | null
}

/** Headline stats from the latest non-null value. */
export function resumenSerie(
  fechas: string[],
  valores: (number | null)[]
): SerieResumen {
  let last = -1
  for (let i = valores.length - 1; i >= 0; i--) {
    if (valores[i] != null) {
      last = i
      break
    }
  }
  if (last < 0) {
    return {
      valorActual: null,
      fechaActual: null,
      cambioMes: null,
      cambio12m: null,
      cambioBase: null,
    }
  }
  const actual = valores[last]
  return {
    valorActual: actual,
    fechaActual: fechas[last] ?? null,
    cambioMes: pctChange(valores[last - 1] ?? null, actual),
    cambio12m: pctChange(valores[last - 12] ?? null, actual),
    cambioBase: actual == null ? null : actual - 100,
  }
}
