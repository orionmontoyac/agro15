import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  getCurrentMonthAccumulation,
  getCurrentMonthFromDaily,
  getDaysWithoutRain,
  getLast30DaysTotal,
  type RainfallData,
} from "@/lib/rain/rain-data"
import {
  CalendarIcon,
  CloudOffIcon,
  CloudRainIcon,
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
    month: "long",
  })

  const total30Days = getLast30DaysTotal(data.daily)
  const monthTotal =
    data.daily.length > 0
      ? getCurrentMonthFromDaily(data.daily)
      : getCurrentMonthAccumulation(data.monthly)

  const drySpell = getDaysWithoutRain(data.daily)
  const isRainingNow = (data.current?.rainMm5m ?? 0) > 0

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
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
            {data.daily.length > 0 ? formatRainMm(total30Days) : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          Total registrado en los últimos 30 días
        </CardFooter>
      </Card>

      <Card
        className={cn(
          "bg-linear-to-t to-card shadow-xs dark:bg-card",
          drySpell.days > 7
            ? "from-chart-5/15"
            : drySpell.days > 0
              ? "from-primary/8"
              : "from-primary/10"
        )}
      >
        <CardHeader className="gap-2">
          <CardDescription className="flex items-center gap-2">
            {drySpell.days > 0 ? (
              <SunIcon className="size-4" />
            ) : (
              <CloudOffIcon className="size-4" />
            )}
            Días sin lluvia
          </CardDescription>
          <CardTitle
            className={cn(
              "text-3xl font-semibold tabular-nums",
              drySpell.days > 7 && "text-chart-5"
            )}
          >
            {data.daily.length > 0 ? drySpell.days : "—"}
          </CardTitle>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          {drySpell.lastRainLabel && drySpell.lastRainMm != null
            ? `Última lluvia: ${drySpell.lastRainLabel} · ${formatRainMm(drySpell.lastRainMm)}`
            : drySpell.days > 0
              ? "Sin lluvia registrada en el periodo de 30 días"
              : "Lluvia registrada hoy o ayer"}
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
          </span>
          {data.current?.updatedAt && (
            <span>Actualizado {formatUpdatedAt(data.current.updatedAt)}</span>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
