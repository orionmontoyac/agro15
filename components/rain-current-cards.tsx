import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  computeDaysWithoutRain,
  formatDaysWithoutRainLabel,
  getCurrentMonthAccumulation,
  getRecentRainStatus,
  type RainfallData,
} from "@/lib/rain/rain-data"
import { BOGOTA_TIME_ZONE } from "@/lib/rain/dates"
import {
  CalendarIcon,
  CloudRainIcon,
  CloudSunIcon,
  DropletsIcon,
  SunIcon,
} from "lucide-react"

function formatRainMm(value: number): string {
  return `${value.toFixed(1)} mm`
}

function formatUpdatedAt(value: string): string {
  const normalized = value.includes("T") ? value : value.replace(" ", "T")
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString("es-CO", {
    timeZone: BOGOTA_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

type RainCurrentCardsProps = {
  data: RainfallData
}

export function RainCurrentCards({ data }: RainCurrentCardsProps) {
  const currentMonthLabel = new Date().toLocaleDateString("es-CO", {
    timeZone: BOGOTA_TIME_ZONE,
    month: "long",
  })

  const monthTotal = getCurrentMonthAccumulation(data.monthly)
  const isRainingNow = (data.current?.rainMm5m ?? 0) > 0
  const isDryPeriod = data.periods != null && data.periods.rainMm72h === 0
  const daysWithoutRain = computeDaysWithoutRain(
    data.daily,
    data.current?.rainMm5m
  )
  const isLongDrySpell = daysWithoutRain != null && daysWithoutRain >= 3

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      <Card className="bg-linear-to-t from-primary/10 to-card shadow-xs dark:bg-card">
        <CardHeader className="gap-2">
          <CardDescription className="flex items-center gap-2">
            <CloudRainIcon className="size-4" />
            Lluvia actual (5 min)
          </CardDescription>
          <CardTitle
            className={cn(
              "text-3xl font-semibold tabular-nums",
              isRainingNow && "text-primary"
            )}
          >
            {data.current != null
              ? formatRainMm(data.current.rainMm5m)
              : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {isRainingNow
            ? "Está lloviendo en este momento"
            : `Sin lluvia reciente en ${data.location.municipality}`}
        </CardFooter>
      </Card>

      <Card className="bg-linear-to-t from-primary/8 to-card shadow-xs dark:bg-card">
        <CardHeader className="gap-2">
          <CardDescription className="flex items-center gap-2">
            <DropletsIcon className="size-4" />
            Acumulado (30 días)
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {data.periods != null
              ? formatRainMm(data.periods.rainMm30d)
              : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          Total registrado en los últimos 30 días
        </CardFooter>
      </Card>

      <Card
        className={cn(
          "bg-linear-to-t to-card shadow-xs dark:bg-card",
          isDryPeriod ? "from-chart-5/15" : "from-primary/8"
        )}
      >
        <CardHeader className="gap-2">
          <CardDescription className="flex items-center gap-2">
            {isDryPeriod ? (
              <SunIcon className="size-4" />
            ) : (
              <CloudRainIcon className="size-4" />
            )}
            Lluvia (72 horas)
          </CardDescription>
          <CardTitle
            className={cn(
              "text-3xl font-semibold tabular-nums",
              isDryPeriod && "text-chart-5"
            )}
          >
            {data.periods != null
              ? formatRainMm(data.periods.rainMm72h)
              : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {getRecentRainStatus(data.periods)}
        </CardFooter>
      </Card>

      <Card
        className={cn(
          "bg-linear-to-t to-card shadow-xs dark:bg-card",
          isLongDrySpell ? "from-chart-5/15" : "from-primary/8"
        )}
      >
        <CardHeader className="gap-2">
          <CardDescription className="flex items-center gap-2">
            {isLongDrySpell ? (
              <SunIcon className="size-4" />
            ) : (
              <CloudSunIcon className="size-4" />
            )}
            Días sin lluvia
          </CardDescription>
          <CardTitle
            className={cn(
              "text-3xl font-semibold tabular-nums",
              isLongDrySpell && "text-chart-5"
            )}
          >
            {daysWithoutRain != null ? daysWithoutRain : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {formatDaysWithoutRainLabel(daysWithoutRain)}
        </CardFooter>
      </Card>

      <Card className="bg-linear-to-t from-primary/8 to-card shadow-xs dark:bg-card">
        <CardHeader className="gap-2">
          <CardDescription className="flex items-center gap-2">
            <CalendarIcon className="size-4" />
            Acumulado del mes
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {monthTotal != null ? formatRainMm(monthTotal) : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="flex flex-col items-start gap-1 text-sm text-muted-foreground">
          <span className="capitalize">
            {currentMonthLabel} · {data.location.municipality}
            {data.location.stationCode
              ? ` · Est. ${data.location.stationCode}`
              : ""}
          </span>
          {data.current?.updatedAt && (
            <span>Actualizado {formatUpdatedAt(data.current.updatedAt)}</span>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
