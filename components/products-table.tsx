"use client"

import * as React from "react"
import { ChevronRightIcon, MinusIcon, SearchIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"
import { useRouter } from "next/navigation"

import { ProductPriceSparkline } from "@/components/product-price-sparkline"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import {
  getContextDateLabel,
  isTodayOrYesterday,
} from "@/lib/sipsa/date-labels"
import type { ProductListRow } from "@/lib/sipsa/products-data"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 25

type SortOption = "recent" | "name" | "change-desc" | "change-asc"
type TrendFilter = "all" | "Subiendo" | "Bajando" | "Estable" | "con-precios"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Más reciente" },
  { value: "name", label: "Nombre (A–Z)" },
  { value: "change-desc", label: "Mayor variación" },
  { value: "change-asc", label: "Menor variación" },
]

function formatPriceCompact(price: number): string {
  if (price >= 1000) {
    const k = price / 1000
    const formatted =
      k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, "")
    return `$${formatted}k`
  }
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(price)
}

function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

function formatPriceRangeCompact(min: number, max: number): string {
  return `${formatPriceCompact(min)}–${formatPriceCompact(max)}`
}

function shortenMarketLabel(marketName: string | null): string | null {
  if (!marketName) return null
  const first = marketName.split(",")[0]?.trim()
  return first || marketName
}

function hasAnyPrice(product: ProductListRow): boolean {
  return product.medellinPrice !== null
}

function sortProducts(products: ProductListRow[], sort: SortOption): ProductListRow[] {
  const sorted = [...products]

  switch (sort) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name, "es"))
    case "change-desc":
      return sorted.sort((a, b) => {
        if (a.changePct === null && b.changePct === null) return 0
        if (a.changePct === null) return 1
        if (b.changePct === null) return -1
        return b.changePct - a.changePct
      })
    case "change-asc":
      return sorted.sort((a, b) => {
        if (a.changePct === null && b.changePct === null) return 0
        if (a.changePct === null) return 1
        if (b.changePct === null) return -1
        return a.changePct - b.changePct
      })
    case "recent":
    default:
      return sorted.sort((a, b) => {
        if (a.lastDate === null && b.lastDate === null) {
          return a.name.localeCompare(b.name, "es")
        }
        if (a.lastDate === null) return 1
        if (b.lastDate === null) return -1
        const byDate = b.lastDate.localeCompare(a.lastDate)
        if (byDate !== 0) return byDate
        return a.name.localeCompare(b.name, "es")
      })
  }
}

function trendStyles(trendLabel: string) {
  if (trendLabel === "Subiendo") {
    return {
      badge: "border-primary/25 bg-primary/10 text-primary",
      icon: TrendingUpIcon,
    }
  }
  if (trendLabel === "Bajando") {
    return {
      badge: "border-chart-5/25 bg-chart-5/10 text-chart-5",
      icon: TrendingDownIcon,
    }
  }
  return {
    badge: "border-border bg-muted/40 text-muted-foreground",
    icon: MinusIcon,
  }
}

function TrendBadge({ product }: { product: ProductListRow }) {
  const { badge, icon: Icon } = trendStyles(product.trendLabel)

  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 gap-1 border px-2 py-0.5 tabular-nums", badge)}
    >
      <Icon className="size-3" />
      {formatChangePct(product.changePct)}
    </Badge>
  )
}

function CityPrice({
  label,
  price,
}: {
  label: string
  price: number
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="truncate font-medium tabular-nums text-foreground">
        {formatPriceCompact(price)}
        <span className="text-[10px] font-normal text-muted-foreground">/kg</span>
      </span>
    </div>
  )
}

function MarketsCell({ product }: { product: ProductListRow }) {
  if (product.medellinPrice === null) {
    return (
      <span className="text-xs text-muted-foreground italic">Sin precios</span>
    )
  }

  const hasRange =
    product.displayPriceMin != null && product.displayPriceMax != null

  return (
    <div className="min-w-[100px] max-w-[160px]">
      <CityPrice label="Med" price={product.medellinPrice} />
      {hasRange ? (
        <p className="mt-1.5 line-clamp-1 text-[11px] leading-tight text-muted-foreground">
          Rango {formatPriceRangeCompact(product.displayPriceMin!, product.displayPriceMax!)}
        </p>
      ) : null}
    </div>
  )
}

function UpdatedCell({ product }: { product: ProductListRow }) {
  const dateIso = product.displayPriceDate ?? product.lastDate
  if (!dateIso) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const dateLabel = getContextDateLabel(dateIso)
  const marketShort = shortenMarketLabel(product.marketName)

  return (
    <div
      className="min-w-[100px] max-w-[160px]"
      title={product.marketName ?? undefined}
    >
      {isTodayOrYesterday(dateLabel.primary) ? (
        <Badge
          variant="outline"
          className={cn(
            "h-5 px-1.5 text-[10px] font-semibold uppercase tracking-wide",
            dateLabel.primary === "HOY" && "border-primary/30 bg-primary/10 text-primary"
          )}
        >
          {dateLabel.primary}
        </Badge>
      ) : (
        <span className="text-xs font-medium tabular-nums">{dateLabel.primary}</span>
      )}
      <p className="mt-1 line-clamp-1 text-[11px] leading-tight text-muted-foreground capitalize">
        {marketShort ?? dateLabel.secondary}
      </p>
    </div>
  )
}

type ProductsTableProps = {
  products: ProductListRow[]
}

export function ProductsTable({ products }: ProductsTableProps) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [sort, setSort] = React.useState<SortOption>("recent")
  const [trendFilter, setTrendFilter] = React.useState<TrendFilter>("all")

  const sortLabel =
    SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Ordenar"

  const filteredProducts = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = products

    if (query) {
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.code.toLowerCase().includes(query)
      )
    }

    if (trendFilter === "con-precios") {
      result = result.filter(hasAnyPrice)
    } else if (trendFilter !== "all") {
      result = result.filter((product) => product.trendLabel === trendFilter)
    }

    return sortProducts(result, sort)
  }, [products, search, sort, trendFilter])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PAGE_SIZE)
  )
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  const paginatedProducts = filteredProducts.slice(
    pageStart,
    pageStart + PAGE_SIZE
  )

  React.useEffect(() => {
    setPage(1)
  }, [search, sort, trendFilter])

  function navigateToProduct(code: string) {
    router.push(`/products/${code}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border bg-card/40 p-3 shadow-xs md:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 lg:max-w-sm">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre o código..."
                className="h-9 bg-background pl-8"
                aria-label="Buscar productos"
              />
            </div>
            <div className="flex items-center justify-between gap-3 lg:justify-end">
              <p className="text-xs text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground">
                  {filteredProducts.length}
                </span>{" "}
                de {products.length}
              </p>
              <Select
                value={sort}
                onValueChange={(value) => {
                  if (value != null) setSort(value as SortOption)
                }}
              >
                <SelectTrigger
                  className="h-9 w-full min-w-[140px] bg-background sm:w-44"
                  size="sm"
                  aria-label="Ordenar productos"
                >
                  <SelectValue>{sortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ToggleGroup
            multiple={false}
            value={[trendFilter]}
            onValueChange={(value) => {
              setTrendFilter((value[0] ?? "all") as TrendFilter)
            }}
            variant="outline"
            className="h-auto w-full flex-wrap gap-1 bg-transparent *:data-[slot=toggle-group-item]:h-8 *:data-[slot=toggle-group-item]:rounded-md *:data-[slot=toggle-group-item]:px-2.5 *:data-[slot=toggle-group-item]:text-xs sm:w-auto"
            aria-label="Filtrar por tendencia"
          >
            <ToggleGroupItem value="all">Todos</ToggleGroupItem>
            <ToggleGroupItem value="Subiendo">Subiendo</ToggleGroupItem>
            <ToggleGroupItem value="Bajando">Bajando</ToggleGroupItem>
            <ToggleGroupItem value="Estable">Estable</ToggleGroupItem>
            <ToggleGroupItem value="con-precios">Con precios</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card/30 shadow-xs">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-9 px-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Producto
              </TableHead>
              <TableHead className="h-9 px-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Medellín
              </TableHead>
              <TableHead className="hidden h-9 px-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase sm:table-cell">
                Tendencia
              </TableHead>
              <TableHead className="h-9 px-4 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Actualizado
              </TableHead>
              <TableHead className="h-9 w-10 px-2" aria-hidden />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="h-28 px-4 text-center text-sm text-muted-foreground"
                >
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow
                  key={product.id}
                  className="group cursor-pointer border-l-2 border-l-transparent hover:border-l-primary/60 hover:bg-muted/30"
                  tabIndex={0}
                  role="link"
                  aria-label={`Ver ${product.name}`}
                  onClick={() => navigateToProduct(product.code)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      navigateToProduct(product.code)
                    }
                  }}
                >
                  <TableCell className="px-4 py-2.5 align-middle whitespace-normal">
                    <div className="flex min-w-[120px] max-w-[200px] flex-col gap-1">
                      <p className="line-clamp-2 text-sm leading-snug font-medium">
                        {product.name}
                      </p>
                      <Badge
                        variant="secondary"
                        className="w-fit px-1.5 py-0 font-mono text-[10px] font-normal text-muted-foreground"
                      >
                        {product.code}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle whitespace-normal">
                    <MarketsCell product={product} />
                  </TableCell>
                  <TableCell className="hidden px-4 py-2.5 align-middle sm:table-cell">
                    <div className="flex w-[132px] items-center gap-2.5">
                      <div className="h-9 w-[72px] shrink-0 overflow-hidden rounded-md bg-muted/30 ring-1 ring-border/40">
                        <ProductPriceSparkline
                          points={product.recentPrices}
                          trendLabel={product.trendLabel}
                          className="h-9 w-full"
                        />
                      </div>
                      <TrendBadge product={product} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 align-middle whitespace-normal">
                    <div className="flex items-center justify-between gap-2 sm:hidden">
                      <UpdatedCell product={product} />
                      <TrendBadge product={product} />
                    </div>
                    <div className="hidden sm:block">
                      <UpdatedCell product={product} />
                    </div>
                  </TableCell>
                  <TableCell className="px-2 py-2.5 text-muted-foreground/40 group-hover:text-muted-foreground">
                    <ChevronRightIcon
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 px-1">
          <p className="text-xs text-muted-foreground tabular-nums">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
