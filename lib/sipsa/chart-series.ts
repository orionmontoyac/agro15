export type ChartPoint = {
  date: string
  medellin?: number
  bogota?: number
  medellinMin?: number
  medellinMax?: number
  bogotaMin?: number
  bogotaMax?: number
}

function chartDateToTime(date: string): number {
  return new Date(`${date}T12:00:00`).getTime()
}

function enumerateDates(rangeStart: string, rangeEnd: string): string[] {
  const dates: string[] = []
  const start = chartDateToTime(rangeStart)
  const end = chartDateToTime(rangeEnd)

  for (let time = start; time <= end; time += 86400000) {
    dates.push(new Date(time).toISOString().slice(0, 10))
  }

  return dates
}

type ChartSeriesKey = "medellin" | "bogota"

function fillSeriesKey(
  points: ChartPoint[],
  key: ChartSeriesKey,
  allDates: string[]
): Map<string, number> {
  const known = points
    .filter((point) => point[key] != null && !Number.isNaN(point[key]))
    .map((point) => ({
      date: point.date,
      value: point[key]!,
      time: chartDateToTime(point.date),
    }))
    .sort((a, b) => a.time - b.time)

  if (known.length === 0) return new Map()

  const filled = new Map<string, number>()

  for (const date of allDates) {
    const time = chartDateToTime(date)
    const exact = known.find((entry) => entry.date === date)

    if (exact) {
      filled.set(date, exact.value)
      continue
    }

    const previous = [...known].reverse().find((entry) => entry.time <= time)
    const next = known.find((entry) => entry.time >= time)

    if (previous && next) {
      if (previous.time === next.time) {
        filled.set(date, previous.value)
      } else {
        const ratio = (time - previous.time) / (next.time - previous.time)
        filled.set(date, previous.value + ratio * (next.value - previous.value))
      }
    } else if (previous) {
      filled.set(date, previous.value)
    } else if (next) {
      filled.set(date, next.value)
    }
  }

  return filled
}

/** Fills missing calendar days by interpolating from the nearest known prices. */
export function fillChartSeriesGaps(
  points: ChartPoint[],
  rangeStart: string,
  rangeEnd: string
): ChartPoint[] {
  if (points.length === 0) return []

  const start = rangeStart <= rangeEnd ? rangeStart : points[0].date
  const end = rangeEnd >= start ? rangeEnd : points[points.length - 1].date
  const allDates = enumerateDates(start, end)

  const medellin = fillSeriesKey(points, "medellin", allDates)
  const bogota = fillSeriesKey(points, "bogota", allDates)

  return allDates
    .map((date) => ({
      date,
      ...(medellin.has(date) ? { medellin: medellin.get(date) } : {}),
      ...(bogota.has(date) ? { bogota: bogota.get(date) } : {}),
    }))
    .filter((point) => point.medellin != null || point.bogota != null)
}

export function getChartRangeStartIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

export function getChartRangeEndIso(): string {
  return new Date().toISOString().slice(0, 10)
}
