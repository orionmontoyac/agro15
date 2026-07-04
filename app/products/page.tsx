import { AppShell } from "@/components/app-shell"
import { ProductsTable } from "@/components/products-table"
import { Badge } from "@/components/ui/badge"
import { computeProductTrendSummary, getProductsList } from "@/lib/sipsa/products-data"

export default async function ProductsPage() {
  const products = await getProductsList()
  const summary =
    products.length > 0 ? computeProductTrendSummary(products) : null

  return (
    <AppShell title="Productos">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Catálogo de productos
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Precios SIPSA en Medellín
              </p>
            </div>
            {summary ? (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary" className="tabular-nums">
                  {summary.total} productos
                </Badge>
                <Badge
                  variant="outline"
                  className="border-primary/25 bg-primary/10 text-primary tabular-nums"
                >
                  {summary.subiendo} ↑
                </Badge>
                <Badge
                  variant="outline"
                  className="border-chart-5/25 bg-chart-5/10 text-chart-5 tabular-nums"
                >
                  {summary.bajando} ↓
                </Badge>
                <Badge variant="outline" className="tabular-nums text-muted-foreground">
                  {summary.estable} estables
                </Badge>
              </div>
            ) : null}
          </div>

          {products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No hay productos en el catálogo</p>
              <p className="mt-2 text-sm">
                Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-catalog
                </code>{" "}
                para cargar todos los productos de Medellín y Bogotá desde SIPSA.
              </p>
            </div>
          ) : products.length <= 3 ? (
            <>
              <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                Solo hay {products.length} producto(s) en el catálogo. Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-catalog
                </code>{" "}
                para importar el catálogo completo de Medellín y Bogotá.
              </div>
              <ProductsTable products={products} />
            </>
          ) : (
            <ProductsTable products={products} />
          )}
        </div>
      </div>
    </AppShell>
  )
}
