import {
  CloudRainIcon,
  DropletsIcon,
  SunIcon,
} from "lucide-react"

import { addDaysToIsoDate, getBogotaDateIso } from "@/lib/rain/dates"
import {
  computeDaysWithoutRain,
  formatDaysWithoutRainLabel,
  getCurrentMonthAccumulation,
  type RainfallData,
} from "@/lib/rain/rain-data"
import { cn } from "@/lib/utils"

const BAR_DAYS = 14

function mm(value: number | null | undefined): string {
  return value == null ? "—" : `${value.toFixed(1)} mm`
}

export function LluviasResumen({ data }: { data: RainfallData }) {
  const rainingNow = (data.current?.rainMm5m ?? 0) > 0
  const daysWithoutRain = computeDaysWithoutRain(data.daily, data.current?.rainMm5m)
  const monthTotal = getCurrentMonthAccumulation(data.monthly)

  // Last BAR_DAYS Bogotá calendar days, oldest → newest; missing days = null.
  const today = getBogotaDateIso()
  const byDate = new Map(data.daily.map((d) => [d.date, d.rainMm]))
  const bars = Array.from({ length: BAR_DAYS }, (_, i) => {
    const date = addDaysToIsoDate(today, i - (BAR_DAYS - 1))
    return { date, rainMm: byDate.get(date) ?? null }
  })
  const maxBar = Math.max(1, ...bars.map((b) => b.rainMm ?? 0))
  const total14 = bars.reduce((sum, b) => sum + (b.rainMm ?? 0), 0)

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border bg-background/40 px-3 py-2.5",
          rainingNow && "border-primary/40"
        )}
      >
        {rainingNow ? (
          <CloudRainIcon className="size-6 shrink-0 text-primary" />
        ) : daysWithoutRain != null && daysWithoutRain >= 3 ? (
          <SunIcon className="size-6 shrink-0 text-chart-3" />
        ) : (
          <DropletsIcon className="size-6 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium">
            {rainingNow
              ? `Lloviendo ahora · ${mm(data.current?.rainMm5m)} (5 min)`
              : `Sin lluvia ahora en ${data.location.municipality}`}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDaysWithoutRainLabel(daysWithoutRain)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="24 horas" value={mm(data.periods?.rainMm24h)} />
        <Stat label="72 horas" value={mm(data.periods?.rainMm72h)} />
        <Stat label="30 días" value={mm(data.periods?.rainMm30d)} />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>Últimos {BAR_DAYS} días</span>
          <span className="tabular-nums">{mm(total14)}</span>
        </div>
        <div
          className="flex h-16 items-end gap-1"
          role="img"
          aria-label={`Lluvia diaria de los últimos ${BAR_DAYS} días`}
        >
          {bars.map((b) => (
            <div
              key={b.date}
              title={`${b.date}: ${mm(b.rainMm)}`}
              className={cn(
                "flex-1 rounded-sm",
                b.rainMm == null
                  ? "h-px bg-border"
                  : b.rainMm === 0
                    ? "h-0.5 bg-muted-foreground/30"
                    : "bg-primary/80"
              )}
              style={
                b.rainMm != null && b.rainMm > 0
                  ? { height: `${Math.max(6, (b.rainMm / maxBar) * 100)}%` }
                  : undefined
              }
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[0.65rem] text-muted-foreground">
          <span>hace {BAR_DAYS - 1} d</span>
          <span>hoy</span>
        </div>
      </div>

      {monthTotal != null ? (
        <p className="text-xs text-muted-foreground">
          Acumulado del mes:{" "}
          <span className="font-medium text-foreground tabular-nums">{mm(monthTotal)}</span>
        </p>
      ) : null}
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/40 px-2 py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-[0.7rem] text-muted-foreground">{label}</div>
    </div>
  )
}
