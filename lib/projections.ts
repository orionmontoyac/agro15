export type ModoEntrada = "kilos_directo" | "plantas" | "hectareas"

export type YieldReference = {
  unitType: "planta" | "hectarea"
  yieldMin: number
  yieldAvg: number
  yieldMax: number
  cicloMeses: number
  plantasPorHectarea: number | null
}

export type KilosEstimate = {
  kilosMin: number
  kilosAvg: number
  kilosMax: number
}

export type PriceStatRow = {
  windowYears: 1 | 3 | 5
  /** Average of the worst ~20% of daily prices in the window (not absolute min). */
  priceMin: number
  /** Average of the best ~20% of daily prices in the window (not absolute max). */
  priceMax: number
  priceAvg: number
  priceStddev: number | null
  sampleCount: number
}

export type ScenarioKey = "pesimista" | "promedio" | "optimista"

export type ProjectionScenario = {
  periodoAnios: 1 | 3 | 5
  escenario: ScenarioKey
  precioUsado: number
  kilosUsados: number
  ingresoTotal: number
  volatilidadPct: number | null
}

export type MonthlyPriceStat = {
  monthNumber: number
  priceMin: number
  priceMax: number
  priceAvg: number
  priceStddev: number | null
  sampleCount: number
}

export type MonthlyProjectionRow = {
  monthNumber: number
  year: number
  label: string
  priceMin: number
  priceAvg: number
  priceMax: number
  ingresoPesimista: number
  ingresoPromedio: number
  ingresoOptimista: number
  sampleCount: number
  isBestMonth: boolean
  isWorstMonth: boolean
}

export type ProjectionResult = {
  kilos: KilosEstimate
  escenarios: ProjectionScenario[]
  stats: PriceStatRow[]
  monthly: MonthlyProjectionRow[]
}

const MONTH_LABELS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
] as const

/** Next 12 calendar months starting from the following month (Bogotá). */
export function getNextTwelveMonthSlots(from: Date = new Date()): {
  monthNumber: number
  year: number
  label: string
}[] {
  const bogotaParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(from)
  const year = Number(bogotaParts.find((p) => p.type === "year")?.value)
  const month = Number(bogotaParts.find((p) => p.type === "month")?.value)
  if (!year || !month) {
    throw new Error("No se pudo resolver la fecha en America/Bogota")
  }

  const slots: { monthNumber: number; year: number; label: string }[] = []
  for (let offset = 1; offset <= 12; offset++) {
    const absolute = month + offset
    const monthNumber = ((absolute - 1) % 12) + 1
    const slotYear = year + Math.floor((absolute - 1) / 12)
    slots.push({
      monthNumber,
      year: slotYear,
      label: `${MONTH_LABELS_ES[monthNumber - 1]} ${slotYear}`,
    })
  }
  return slots
}

/**
 * Builds next-12-months rows from historical calendar-month price bands.
 * Income uses the projection's kilos min/avg/max × month price bands.
 */
export function buildMonthlyProjections(
  monthlyStats: MonthlyPriceStat[],
  kilos: KilosEstimate,
  from: Date = new Date()
): MonthlyProjectionRow[] {
  const byMonth = new Map(
    monthlyStats.map((row) => [row.monthNumber, row] as const)
  )
  const slots = getNextTwelveMonthSlots(from)
  const rows: MonthlyProjectionRow[] = []

  for (const slot of slots) {
    const stat = byMonth.get(slot.monthNumber)
    if (!stat || stat.sampleCount === 0) continue
    rows.push({
      monthNumber: slot.monthNumber,
      year: slot.year,
      label: slot.label,
      priceMin: stat.priceMin,
      priceAvg: stat.priceAvg,
      priceMax: stat.priceMax,
      ingresoPesimista: stat.priceMin * kilos.kilosMin,
      ingresoPromedio: stat.priceAvg * kilos.kilosAvg,
      ingresoOptimista: stat.priceMax * kilos.kilosMax,
      sampleCount: stat.sampleCount,
      isBestMonth: false,
      isWorstMonth: false,
    })
  }

  if (rows.length === 0) return rows

  let bestIdx = 0
  let worstIdx = 0
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].priceAvg > rows[bestIdx].priceAvg) bestIdx = i
    if (rows[i].priceAvg < rows[worstIdx].priceAvg) worstIdx = i
  }
  rows[bestIdx] = { ...rows[bestIdx], isBestMonth: true }
  if (worstIdx !== bestIdx) {
    rows[worstIdx] = { ...rows[worstIdx], isWorstMonth: true }
  }
  return rows
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser un número positivo`)
  }
}

/**
 * Convierte cantidad de entrada a kilos estimados según yield reference.
 * - kilos_directo: los tres valores = cantidad
 * - plantas / hectareas: multiplica por yield_min/avg/max (con conversión ha→plantas si aplica)
 */
export function estimateKilos(
  cantidad: number,
  yieldRef: YieldReference | null,
  modoEntrada: ModoEntrada
): KilosEstimate {
  assertPositive(cantidad, "cantidad")

  if (modoEntrada === "kilos_directo") {
    return {
      kilosMin: cantidad,
      kilosAvg: cantidad,
      kilosMax: cantidad,
    }
  }

  if (!yieldRef) {
    throw new Error(
      "Este producto aún no tiene datos de rendimiento, usa modo kilos directos."
    )
  }

  let unidades = cantidad

  if (modoEntrada === "hectareas") {
    if (yieldRef.unitType === "hectarea") {
      unidades = cantidad
    } else {
      const density = yieldRef.plantasPorHectarea
      if (density == null || density <= 0) {
        throw new Error(
          "No hay densidad plantas/ha para convertir hectáreas a plantas."
        )
      }
      unidades = cantidad * density
    }
  } else if (modoEntrada === "plantas") {
    if (yieldRef.unitType === "hectarea") {
      throw new Error(
        "Este producto solo tiene rendimiento por hectárea; usa modo hectáreas o kilos directos."
      )
    }
    unidades = cantidad
  }

  return {
    kilosMin: unidades * yieldRef.yieldMin,
    kilosAvg: unidades * yieldRef.yieldAvg,
    kilosMax: unidades * yieldRef.yieldMax,
  }
}

function volatilityPct(avg: number, stddev: number | null): number | null {
  if (stddev == null || !Number.isFinite(stddev) || avg <= 0) return null
  return (stddev / avg) * 100
}

function pickPrice(
  stat: PriceStatRow,
  escenario: ScenarioKey
): number {
  if (escenario === "pesimista") return stat.priceMin
  if (escenario === "optimista") return stat.priceMax
  return stat.priceAvg
}

function pickKilos(kilos: KilosEstimate, escenario: ScenarioKey): number {
  if (escenario === "pesimista") return kilos.kilosMin
  if (escenario === "optimista") return kilos.kilosMax
  return kilos.kilosAvg
}

/**
 * Construye la matriz periodos (1/3/5) × escenarios (pesimista/promedio/optimista).
 * ingresoTotal = precio × kilos del escenario correspondiente.
 */
export function buildProjections(
  stats: PriceStatRow[],
  kilos: KilosEstimate
): ProjectionScenario[] {
  const scenarios: ScenarioKey[] = ["pesimista", "promedio", "optimista"]
  const rows: ProjectionScenario[] = []

  for (const stat of stats) {
    const vol = volatilityPct(stat.priceAvg, stat.priceStddev)
    for (const escenario of scenarios) {
      const precioUsado = pickPrice(stat, escenario)
      const kilosUsados = pickKilos(kilos, escenario)
      rows.push({
        periodoAnios: stat.windowYears,
        escenario,
        precioUsado,
        kilosUsados,
        ingresoTotal: precioUsado * kilosUsados,
        volatilidadPct: vol,
      })
    }
  }

  return rows
}

export function buildProjectionResult(
  stats: PriceStatRow[],
  kilos: KilosEstimate,
  monthlyStats: MonthlyPriceStat[] = []
): ProjectionResult {
  return {
    kilos,
    stats,
    escenarios: buildProjections(stats, kilos),
    monthly: buildMonthlyProjections(monthlyStats, kilos),
  }
}
