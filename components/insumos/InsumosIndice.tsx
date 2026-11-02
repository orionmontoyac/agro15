"use client"

import * as React from "react"
import { ArrowDownIcon, ArrowUpIcon, InfoIcon, XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CambioBadge } from "@/components/insumos/CambioBadge"
import { IndiceLineChart, type IndiceLine } from "@/components/insumos/IndiceLineChart"
import { RangoSelector } from "@/components/insumos/RangoSelector"
import { Sparkline } from "@/components/insumos/Sparkline"
import {
  INSUMO_GRUPOS,
  categoriaLabel,
  formatIndiceFecha,
  formatIndiceValor,
  formatMesLargo,
  impactoEconomico,
  productoLabel,
  rangoStartIndex,
  resumenSerie,
  type InsumoGrupo,
  type InsumoGrupoKey,
  type InsumoIndiceDataset,
  type InsumoIndiceSerie,
  type InsumoRangoKey,
  type SerieResumen,
} from "@/lib/insumos/indice-types"

const LINE_COLORS = [
  "var(--chart-1)",
  "oklch(0.62 0.13 245)",
  "var(--chart-3)",
  "oklch(0.62 0.16 330)",
  "var(--chart-5)",
  "oklch(0.65 0.1 195)",
  "var(--chart-4)",
]
const MAX_LINES = LINE_COLORS.length
const SPARK_MONTHS = 24

type SortKey = "nombre" | "valor" | "mes" | "12m"

type TablaFila = {
  serie: InsumoIndiceSerie
  resumen: SerieResumen
}

export function InsumosIndice({ dataset }: { dataset: InsumoIndiceDataset }) {
  const { fechas, series } = dataset
  const byProducto = React.useMemo(
    () => new Map(series.map((s) => [s.producto, s])),
    [series]
  )

  const [grupoKey, setGrupoKey] = React.useState<InsumoGrupoKey>("fertilizantes")
  const [rango, setRango] = React.useState<InsumoRangoKey>("3A")
  /** Extra individual products pinned to the chart, per group. */
  const [extras, setExtras] = React.useState<Record<string, string[]>>({})
  const [sort, setSort] = React.useState<{ key: SortKey; desc: boolean }>({
    key: "12m",
    desc: true,
  })
  const explorerRef = React.useRef<HTMLDivElement>(null)

  const grupo = INSUMO_GRUPOS.find((g) => g.key === grupoKey) ?? INSUMO_GRUPOS[0]
  const grupoExtras = extras[grupo.key] ?? []

  const general = byProducto.get("Indice_total")
  const generalResumen = general ? resumenSerie(fechas, general.valores) : null

  // ---- Chart lines -------------------------------------------------------
  const start = rangoStartIndex(fechas, rango)
  const fechasRango = fechas.slice(start)

  const lineProductos = [grupo.total, ...grupo.subtotales, ...grupoExtras]
    .filter((p, i, arr) => arr.indexOf(p) === i && byProducto.has(p))
    .slice(0, MAX_LINES)

  const lines: IndiceLine[] = lineProductos.map((producto, i) => ({
    key: `s${i}`,
    label: productoLabel(producto),
    color: LINE_COLORS[i],
    valores: byProducto.get(producto)!.valores.slice(start),
    emphasis: producto === grupo.total,
  }))

  // ---- Table rows --------------------------------------------------------
  const filas: TablaFila[] = (() => {
    const productos =
      grupo.categorias.length > 0
        ? series.filter(
            (s) =>
              grupo.categorias.includes(s.categoria) &&
              !s.producto.startsWith("Total_")
          )
        : grupo.subtotales
            .map((p) => byProducto.get(p))
            .filter((s): s is InsumoIndiceSerie => Boolean(s))
    const rows = productos.map((serie) => ({
      serie,
      resumen: resumenSerie(fechas, serie.valores),
    }))
    const val = (r: TablaFila): number | string | null => {
      switch (sort.key) {
        case "nombre":
          return productoLabel(r.serie.producto)
        case "valor":
          return r.resumen.valorActual
        case "mes":
          return r.resumen.cambioMes
        case "12m":
          return r.resumen.cambio12m
      }
    }
    return rows.sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      const cmp =
        typeof va === "string"
          ? va.localeCompare(String(vb), "es")
          : va - (vb as number)
      return sort.desc ? -cmp : cmp
    })
  })()

  const toggleExtra = (producto: string) => {
    if (producto === grupo.total || grupo.subtotales.includes(producto)) return
    setExtras((prev) => {
      const current = prev[grupo.key] ?? []
      const next = current.includes(producto)
        ? current.filter((p) => p !== producto)
        : [...current, producto].slice(
            -(MAX_LINES - 1 - grupo.subtotales.length)
          )
      return { ...prev, [grupo.key]: next }
    })
  }

  const selectGrupo = (key: InsumoGrupoKey, scroll: boolean) => {
    setGrupoKey(key)
    if (scroll) {
      explorerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  if (series.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Índice de precios de agroinsumos</CardTitle>
          <CardDescription>
            No hay datos cargados todavía. Ejecuta{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              npm run sync:insumo-indice -- --full
            </code>
            .
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {/* ---- Headline ---------------------------------------------------- */}
      <div className="flex flex-col gap-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3">
        <InfoIcon className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
        <p className="text-muted-foreground">
          Índices UPRA con base <strong className="text-foreground">ene-2021 = 100</strong>
          : un valor de 150 significa que el insumo cuesta 50% más que en enero
          de 2021.
          {generalResumen?.valorActual != null && generalResumen.fechaActual ? (
            <>
              {" "}
              En {formatMesLargo(generalResumen.fechaActual)} el índice agrícola
              total fue{" "}
              <strong className="text-foreground tabular-nums">
                {formatIndiceValor(generalResumen.valorActual)}
              </strong>{" "}
              (<CambioBadge value={generalResumen.cambio12m} icon={false} /> en 12
              meses).
            </>
          ) : null}
        </p>
      </div>

      {/* ---- Group summary cards ---------------------------------------- */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {INSUMO_GRUPOS.map((g) => (
          <GrupoCard
            key={g.key}
            grupo={g}
            fechas={fechas}
            serie={byProducto.get(g.total)}
            active={g.key === grupo.key}
            onSelect={() => selectGrupo(g.key, true)}
          />
        ))}
      </div>

      {/* ---- Explorer ---------------------------------------------------- */}
      <Card ref={explorerRef} className="scroll-mt-20">
        <CardHeader className="grid-cols-1 gap-3 [&>*]:min-w-0">
          <Tabs
            value={grupo.key}
            onValueChange={(v) => selectGrupo(v as InsumoGrupoKey, false)}
          >
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList>
                {INSUMO_GRUPOS.map((g) => (
                  <TabsTrigger key={g.key} value={g.key} className="px-3">
                    {g.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>{grupo.label}</CardTitle>
              <CardDescription>{grupo.description}</CardDescription>
            </div>
            <RangoSelector value={rango} onChange={setRango} />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
            {lines.map((l, i) => {
              const producto = lineProductos[i]
              const removable = grupoExtras.includes(producto)
              return (
                <span key={l.key} className="inline-flex items-center gap-1.5">
                  <span
                    className={cn("h-0.5 w-4 rounded-full", l.emphasis && "h-1")}
                    style={{ background: l.color }}
                  />
                  <span className={cn(l.emphasis && "font-medium")}>{l.label}</span>
                  {removable ? (
                    <button
                      type="button"
                      onClick={() => toggleExtra(producto)}
                      className="rounded text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar ${l.label} de la gráfica`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  ) : null}
                </span>
              )
            })}
          </div>

          <IndiceLineChart fechas={fechasRango} lines={lines} />

          {grupo.categorias.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Toca un producto en la tabla para añadirlo a la gráfica.
            </p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <SortHead label="Producto" k="nombre" sort={sort} setSort={setSort} />
                <SortHead
                  label="Índice"
                  k="valor"
                  sort={sort}
                  setSort={setSort}
                  className="text-right"
                />
                <SortHead
                  label="Mes"
                  k="mes"
                  sort={sort}
                  setSort={setSort}
                  className="hidden text-right sm:table-cell"
                />
                <SortHead
                  label="12 meses"
                  k="12m"
                  sort={sort}
                  setSort={setSort}
                  className="text-right"
                />
                <TableHead className="hidden w-32 md:table-cell">
                  Últimos 24 meses
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map(({ serie, resumen }) => {
                const pinned = lineProductos.includes(serie.producto)
                const clickable =
                  serie.producto !== grupo.total &&
                  !grupo.subtotales.includes(serie.producto)
                const impacto = impactoEconomico(resumen.cambio12m)
                return (
                  <TableRow
                    key={serie.producto}
                    data-state={pinned && clickable ? "selected" : undefined}
                    className={cn(clickable && "cursor-pointer")}
                    onClick={clickable ? () => toggleExtra(serie.producto) : undefined}
                  >
                    <TableCell className="max-w-[10rem] sm:max-w-none">
                      <div className="truncate font-medium">
                        {productoLabel(serie.producto)}
                      </div>
                      {grupo.categorias.length > 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {categoriaLabel(serie.categoria)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {resumen.valorActual == null
                        ? "—"
                        : formatIndiceValor(resumen.valorActual)}
                    </TableCell>
                    <TableCell className="hidden text-right sm:table-cell">
                      <CambioBadge value={resumen.cambioMes} icon={false} />
                    </TableCell>
                    <TableCell className="text-right">
                      <CambioBadge value={resumen.cambio12m} />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "hidden md:table-cell",
                        impacto === "bad" && "text-destructive",
                        impacto === "good" && "text-emerald-600 dark:text-emerald-400",
                        impacto === "neutral" && "text-muted-foreground"
                      )}
                    >
                      <Sparkline
                        values={serie.valores.slice(-SPARK_MONTHS)}
                        className="h-8"
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function GrupoCard({
  grupo,
  fechas,
  serie,
  active,
  onSelect,
}: {
  grupo: InsumoGrupo
  fechas: string[]
  serie: InsumoIndiceSerie | undefined
  active: boolean
  onSelect: () => void
}) {
  const resumen = serie ? resumenSerie(fechas, serie.valores) : null
  const impacto = impactoEconomico(resumen?.cambio12m ?? null)

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-xs transition-colors hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active && "border-primary/60 ring-1 ring-primary/30"
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{grupo.label}</span>
        {resumen?.fechaActual ? (
          <span className="text-xs text-muted-foreground">
            {formatIndiceFecha(resumen.fechaActual)}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {resumen?.valorActual == null ? "—" : formatIndiceValor(resumen.valorActual)}
          </div>
          <div className="mt-1 flex flex-col text-xs text-muted-foreground">
            <span>
              12 meses <CambioBadge value={resumen?.cambio12m ?? null} icon={false} />
            </span>
            <span>
              Mes <CambioBadge value={resumen?.cambioMes ?? null} icon={false} />
            </span>
          </div>
        </div>
        <div
          className={cn(
            "w-24 shrink-0",
            impacto === "bad" && "text-destructive",
            impacto === "good" && "text-emerald-600 dark:text-emerald-400",
            impacto === "neutral" && "text-muted-foreground"
          )}
        >
          <Sparkline values={serie?.valores.slice(-SPARK_MONTHS) ?? []} reference={100} />
        </div>
      </div>
    </button>
  )
}

function SortHead({
  label,
  k,
  sort,
  setSort,
  className,
}: {
  label: string
  k: SortKey
  sort: { key: SortKey; desc: boolean }
  setSort: (s: { key: SortKey; desc: boolean }) => void
  className?: string
}) {
  const active = sort.key === k
  const Icon = sort.desc ? ArrowDownIcon : ArrowUpIcon
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() =>
          setSort({ key: k, desc: active ? !sort.desc : k !== "nombre" })
        }
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {label}
        {active ? <Icon className="size-3" /> : null}
      </button>
    </TableHead>
  )
}
