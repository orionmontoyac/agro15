"use client"

import * as React from "react"
import {
  CalculatorIcon,
  Loader2Icon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProjectionProductOption } from "@/lib/proyecciones-data"
import {
  prependLocalProjection,
  readLocalProjections,
  type LocalProjection,
} from "@/lib/proyecciones-local"
import type { MonthlyProjectionRow, ScenarioKey } from "@/lib/projections"
import { useProductFavorites } from "@/hooks/use-product-favorites"
import { cn } from "@/lib/utils"

function formatCop(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    maximumFractionDigits: 1,
  }).format(value)
}

function formatCompactPrice(price: number): string {
  if (price >= 1000) {
    const thousands = price / 1000
    const formatted =
      thousands >= 10
        ? Math.round(thousands).toString()
        : thousands.toFixed(1).replace(/\.0$/, "")
    return `$${formatted}k`
  }
  return `$${Math.round(price)}`
}

/** Green = high (best selling month), red = low (worst). */
function monthHeatColor(priceAvg: number, min: number, max: number): string {
  if (min === max) return "hsl(142, 45%, 38%)"
  const t = (priceAvg - min) / (max - min)
  const hue = 8 + t * 134
  const saturation = 55 + t * 15
  const lightness = 42 - t * 4
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

function volatilityTone(pct: number | null): "green" | "yellow" | "red" | "muted" {
  if (pct == null) return "muted"
  if (pct < 15) return "green"
  if (pct <= 30) return "yellow"
  return "red"
}

function VolatilityBadge({ pct }: { pct: number | null }) {
  const tone = volatilityTone(pct)
  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums",
        tone === "green" &&
          "border-emerald-500/40 text-emerald-700 dark:text-emerald-400",
        tone === "yellow" &&
          "border-amber-500/40 text-amber-700 dark:text-amber-400",
        tone === "red" && "border-destructive/40 text-destructive",
        tone === "muted" && "text-muted-foreground"
      )}
    >
      {pct == null ? "—" : `${pct.toFixed(1)}%`}
    </Badge>
  )
}

function PriceScenarioCell({
  ingreso,
  precio,
}: {
  ingreso: number
  precio: number
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium tabular-nums">{formatCop(ingreso)}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {formatCop(precio)}/kg
      </span>
    </div>
  )
}

const SCENARIO_LABELS: Record<ScenarioKey, string> = {
  pesimista: "Conservador",
  promedio: "Promedio",
  optimista: "Optimista",
}

type ProyeccionesWorkspaceProps = {
  products: ProjectionProductOption[]
}

export function ProyeccionesWorkspace({ products }: ProyeccionesWorkspaceProps) {
  const { isFavorite, sortWithFavorites } = useProductFavorites()
  const orderedProducts = React.useMemo(
    () => sortWithFavorites(products),
    [products, sortWithFavorites]
  )
  const defaultProduct =
    orderedProducts.find((p) => p.code === "106") ?? orderedProducts[0] ?? null

  const [productId, setProductId] = React.useState<string>(
    defaultProduct ? String(defaultProduct.id) : ""
  )
  const selected = orderedProducts.find((p) => String(p.id) === productId) ?? null

  const [cantidad, setCantidad] = React.useState("500")
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [active, setActive] = React.useState<LocalProjection | null>(null)
  const [history, setHistory] = React.useState<LocalProjection[]>([])
  const [selectedMonth, setSelectedMonth] =
    React.useState<MonthlyProjectionRow | null>(null)

  React.useEffect(() => {
    const local = readLocalProjections()
    setHistory(local)
    if (local[0]) setActive(local[0])
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const parsedCantidad = Number(cantidad)
    if (!Number.isFinite(parsedCantidad) || parsedCantidad <= 0) {
      setFormError("Ingresa una cantidad válida mayor a 0.")
      return
    }

    if (!productId) {
      setFormError("Selecciona un producto.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/proyeccion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: Number(productId),
          modoEntrada: "kilos_directo",
          cantidad: parsedCantidad,
        }),
      })
      const json = (await response.json()) as {
        projection?: LocalProjection
        error?: string
      }
      if (!response.ok || !json.projection) {
        setFormError(json.error ?? "No se pudo calcular la proyección")
        return
      }
      setActive(json.projection)
      setHistory(prependLocalProjection(json.projection))
    } finally {
      setSubmitting(false)
    }
  }

  const result = active?.resultado ?? null
  const monthly = result?.monthly ?? []
  const bestMonth = monthly.find((row) => row.isBestMonth) ?? null
  const worstMonth = monthly.find((row) => row.isWorstMonth) ?? null
  const monthPriceMin = monthly.reduce(
    (min, row) => Math.min(min, row.priceAvg),
    Number.POSITIVE_INFINITY
  )
  const monthPriceMax = monthly.reduce(
    (max, row) => Math.max(max, row.priceAvg),
    0
  )
  const byPeriod = React.useMemo(() => {
    if (!result) return []
    return ([1, 3, 5] as const).map((years) => {
      const rows = result.escenarios.filter((e) => e.periodoAnios === years)
      const vol = rows[0]?.volatilidadPct ?? null
      return { years, rows, vol }
    })
  }, [result])

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <Card className="bg-linear-to-t from-primary/10 to-card shadow-xs dark:bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalculatorIcon className="size-4" />
            Nueva proyección
          </CardTitle>
          <CardDescription>
            Estima ingresos con precios SIPSA históricos (1, 3 y 5 años). Tu
            historial queda en este dispositivo; Agro15 también guarda una copia
            interna para análisis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Producto</Label>
                <Select
                  value={productId || null}
                  onValueChange={(value) => {
                    if (value !== null) setProductId(value)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona producto">
                      {selected?.name ?? "Selecciona producto"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {orderedProducts.map((product) => (
                      <SelectItem key={product.id} value={String(product.id)}>
                        {isFavorite(product.code) ? "★ " : ""}
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cantidad">Cantidad (kg)</Label>
                <Input
                  id="cantidad"
                  type="number"
                  min="0"
                  step="any"
                  value={cantidad}
                  onChange={(event) => setCantidad(event.target.value)}
                  required
                />
              </div>
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}

            <div>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2Icon
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <CalculatorIcon data-icon="inline-start" />
                )}
                Calcular proyección
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {active && result ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Resultado · {active.resultado.product?.name ?? "Producto"}
            </CardTitle>
            <CardDescription>
              Kilos estimados: min {formatNumber(Number(active.kilos_min))} · avg{" "}
              {formatNumber(Number(active.kilos_avg))} · max{" "}
              {formatNumber(Number(active.kilos_max))}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Volatilidad</TableHead>
                  <TableHead>Conservador</TableHead>
                  <TableHead>Promedio</TableHead>
                  <TableHead>Optimista</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPeriod.map(({ years, rows, vol }) => {
                  const scenario = (key: ScenarioKey) =>
                    rows.find((row) => row.escenario === key)
                  const renderScenario = (key: ScenarioKey) => {
                    const row = scenario(key)
                    if (!row) return "—"
                    return (
                      <PriceScenarioCell
                        ingreso={row.ingresoTotal}
                        precio={row.precioUsado}
                      />
                    )
                  }
                  return (
                    <TableRow key={years}>
                      <TableCell className="font-medium align-top">
                        {years} año(s)
                      </TableCell>
                      <TableCell className="align-top">
                        <VolatilityBadge pct={vol} />
                      </TableCell>
                      <TableCell className="align-top">
                        {renderScenario("pesimista")}
                      </TableCell>
                      <TableCell className="align-top">
                        {renderScenario("promedio")}
                      </TableCell>
                      <TableCell className="align-top">
                        {renderScenario("optimista")}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              Escenarios: {SCENARIO_LABELS.pesimista} = promedio del 20% de
              precios más bajos × kilos mín; promedio = precio avg × kilos avg;
              optimista = promedio del 20% de precios más altos × kilos máx.
              Cada celda muestra ingreso y precio/kg. Volatilidad = stddev/avg
              del precio en la ventana.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {active && monthly.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Próximos 12 meses</CardTitle>
                <CardDescription>
                  Promedio histórico por mes. Tocá un mes para ver detalle.
                  {bestMonth
                    ? ` Mejor: ${bestMonth.label}.`
                    : ""}
                  {worstMonth ? ` Peor: ${worstMonth.label}.` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <TrendingUpIcon className="size-3.5 text-emerald-500" />
                  Precio alto
                </span>
                <span className="inline-flex items-center gap-1">
                  <TrendingDownIcon className="size-3.5 text-destructive" />
                  Precio bajo
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-12 lg:gap-1.5">
              {monthly.map((row) => {
                const bg = monthHeatColor(
                  row.priceAvg,
                  monthPriceMin,
                  monthPriceMax
                )
                return (
                  <button
                    key={`${row.year}-${row.monthNumber}`}
                    type="button"
                    onClick={() => setSelectedMonth(row)}
                    className={cn(
                      "relative flex min-h-[80px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 py-2.5 text-center text-white shadow-xs transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-[92px] lg:rounded-lg lg:px-1 lg:py-2",
                      row.isBestMonth && "ring-2 ring-emerald-300/70",
                      row.isWorstMonth && "ring-2 ring-red-300/70"
                    )}
                    style={{ backgroundColor: bg }}
                    aria-label={`${row.label}, promedio ${formatCop(row.priceAvg)} por kilo`}
                  >
                    {row.isBestMonth ? (
                      <TrendingUpIcon className="absolute top-1 right-1 size-3 opacity-90 lg:size-2.5" />
                    ) : null}
                    {row.isWorstMonth ? (
                      <TrendingDownIcon className="absolute top-1 left-1 size-3 opacity-90 lg:size-2.5" />
                    ) : null}
                    <span className="text-[10px] font-medium uppercase tracking-wide opacity-90 lg:text-[9px]">
                      {row.label}
                    </span>
                    <span className="text-base font-semibold tabular-nums leading-none lg:text-sm">
                      {formatCompactPrice(row.priceAvg)}
                    </span>
                    <span className="text-[10px] tabular-nums opacity-85 lg:text-[9px]">
                      peor {formatCompactPrice(row.priceMin)}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Color según precio promedio histórico del mes (verde = más alto,
              rojo = más bajo). Cada celda muestra promedio y escenario peor
              (20% bajo).
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Sheet
        open={selectedMonth != null}
        onOpenChange={(open) => {
          if (!open) setSelectedMonth(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selectedMonth ? (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMonth.label}</SheetTitle>
                <SheetDescription>
                  Detalle del mes con tus kilos proyectados.
                  {selectedMonth.isBestMonth ? " Mejor mes del periodo." : ""}
                  {selectedMonth.isWorstMonth ? " Peor mes del periodo." : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4 pb-6">
                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Conservador</p>
                    <PriceScenarioCell
                      ingreso={selectedMonth.ingresoPesimista}
                      precio={selectedMonth.priceMin}
                    />
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Promedio</p>
                    <PriceScenarioCell
                      ingreso={selectedMonth.ingresoPromedio}
                      precio={selectedMonth.priceAvg}
                    />
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Optimista</p>
                    <PriceScenarioCell
                      ingreso={selectedMonth.ingresoOptimista}
                      precio={selectedMonth.priceMax}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Basado en {selectedMonth.sampleCount} observaciones diarias
                  históricas de ese mes. Ingresos = precio × kilos de tu
                  proyección.
                </p>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Card>
        <CardHeader>
          <CardTitle>Mis proyecciones</CardTitle>
          <CardDescription>
            Últimas 10 en este navegador (localStorage). Clic para ver el
            resultado guardado sin recalcular.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no hay proyecciones en este dispositivo.
            </p>
          ) : (
            history.map((item) => {
              const title =
                item.resultado.product?.name ?? `Producto #${item.product_id}`
              const created = new Date(item.created_at).toLocaleString("es-CO")
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(item)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60",
                    active?.id === item.id && "border-primary/40 bg-primary/5"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{title}</span>
                    <span className="text-xs text-muted-foreground">
                      {created}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.modo_entrada} ·{" "}
                    {formatNumber(Number(item.cantidad_unidades))} · avg{" "}
                    {formatNumber(Number(item.kilos_avg))} kg
                  </p>
                </button>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
