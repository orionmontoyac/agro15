"use client"

import * as React from "react"

import { InsumoPriceChart } from "@/components/insumo-price-chart"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { InsumoListRow, InsumoMonthlyPoint } from "@/lib/sipsa/insumos-data"

const PAGE_SIZE = 20

function formatPrice(price: number | null): string {
  if (price === null) return "—"
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(price)
}

function formatMonth(date: string | null): string {
  if (!date) return "—"
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  })
}

type InsumosTableProps = {
  rows: InsumoListRow[]
  categories: string[]
  latestMonth: string | null
  historyByInsumo: Record<string, InsumoMonthlyPoint[]>
}

export function InsumosTable({
  rows,
  categories,
  latestMonth,
  historyByInsumo,
}: InsumosTableProps) {
  const [search, setSearch] = React.useState("")
  const [category, setCategory] = React.useState<string>("all")
  const [selectedInsumo, setSelectedInsumo] = React.useState<string | null>(
    rows[0]?.insumoName ?? null
  )
  const [page, setPage] = React.useState(1)

  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (category !== "all" && row.category !== category) return false
      if (!query) return true
      return row.insumoName.toLowerCase().includes(query)
    })
  }, [rows, search, category])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  React.useEffect(() => {
    setPage(1)
  }, [search, category])

  React.useEffect(() => {
    if (
      selectedInsumo &&
      !filtered.some((row) => row.insumoName === selectedInsumo)
    ) {
      setSelectedInsumo(filtered[0]?.insumoName ?? null)
    }
  }, [filtered, selectedInsumo])

  const selectedHistory = selectedInsumo
    ? (historyByInsumo[selectedInsumo] ?? [])
    : []

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar insumo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="max-w-sm"
        />
        {categories.length > 0 && (
          <Select
            value={category}
            onValueChange={(value) => {
              if (value != null) setCategory(value)
            }}
          >
            <SelectTrigger className="w-full sm:w-52" size="sm">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {latestMonth ? (
        <p className="text-sm text-muted-foreground">
          Precios mensuales SIPSA · último mes con datos:{" "}
          <span className="font-medium text-foreground">
            {formatMonth(latestMonth)}
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Medellín</TableHead>
                  <TableHead className="text-right">Bogotá</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No hay insumos que coincidan con la búsqueda.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow
                      key={row.insumoName}
                      className={
                        selectedInsumo === row.insumoName
                          ? "bg-muted/50 cursor-pointer"
                          : "cursor-pointer"
                      }
                      onClick={() => setSelectedInsumo(row.insumoName)}
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{row.insumoName}</span>
                          {row.category ? (
                            <Badge variant="outline" className="w-fit text-xs">
                              {row.category}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(row.medellinPrice)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPrice(row.bogotaPrice)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="underline-offset-4 hover:underline disabled:opacity-50"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="underline-offset-4 hover:underline disabled:opacity-50"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        <Card className="lg:col-span-2 bg-linear-to-t from-primary/5 to-card shadow-xs dark:bg-card">
          <CardHeader>
            <CardTitle className="text-base">Historial mensual</CardTitle>
            <CardDescription>
              {selectedInsumo ?? "Selecciona un insumo"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedInsumo ? (
              <InsumoPriceChart
                insumoName={selectedInsumo}
                history={selectedHistory}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Haz clic en un insumo para ver su evolución de precio.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
