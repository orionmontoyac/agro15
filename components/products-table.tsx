"use client"

import * as React from "react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProductListRow } from "@/lib/sipsa/products-data"

const PAGE_SIZE = 25

function formatPrice(price: number | null): string {
  if (price === null) return "—"
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function formatChangePct(pct: number | null): string {
  if (pct === null) return "—"
  const sign = pct >= 0 ? "+" : ""
  return `${sign}${pct.toFixed(1)}%`
}

function formatDate(date: string | null): string {
  if (!date) return "—"
  return new Date(date).toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

type ProductsTableProps = {
  products: ProductListRow[]
}

export function ProductsTable({ products }: ProductsTableProps) {
  const [search, setSearch] = React.useState("")
  const [page, setPage] = React.useState(1)

  const filteredProducts = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products

    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query)
    )
  }, [products, search])

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
  }, [search])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o código..."
          className="max-w-sm"
          aria-label="Buscar productos"
        />
        <p className="text-sm text-muted-foreground">
          {filteredProducts.length} de {products.length} productos
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Producto</TableHead>
              <TableHead>Medellín</TableHead>
              <TableHead>Bogotá</TableHead>
              <TableHead>Variación 30d</TableHead>
              <TableHead>Tendencia</TableHead>
              <TableHead>Última fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedProducts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No se encontraron productos
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-mono text-muted-foreground">
                    <Link href={`/products/${product.code}`} className="block">
                      {product.code}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/products/${product.code}`}
                      className="block hover:underline"
                    >
                      {product.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.code}`} className="block">
                      {formatPrice(product.medellinPrice)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.code}`} className="block">
                      {formatPrice(product.bogotaPrice)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.code}`} className="block">
                      {formatChangePct(product.changePct)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.code}`} className="block">
                      <Badge variant="outline">{product.trendLabel}</Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Link href={`/products/${product.code}`} className="block">
                      {formatDate(product.lastDate)}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
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
