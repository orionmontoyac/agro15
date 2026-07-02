import Link from "next/link"
import { notFound } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { ProductDetailContent } from "@/components/product-detail-content"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { getProductDetail } from "@/lib/sipsa/products-data"

type ProductDetailPageProps = {
  params: Promise<{ code: string }>
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { code } = await params
  const detail = await getProductDetail(code)

  if (!detail) {
    notFound()
  }

  const {
    product,
    medellin,
    bogota,
    chartSeries,
    lastSevenDays,
    priceTrend,
    hasPriceData,
  } = detail

  return (
    <AppShell title={product.name}>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/products" />}>
                  Productos
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{product.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div>
            <p className="text-sm text-muted-foreground">
              Código SIPSA: {product.code}
            </p>
          </div>

          {!hasPriceData ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Sin datos de precios</p>
              <p className="mt-2 text-sm">
                Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-prices -- {product.code} --years 3
                </code>{" "}
                para cargar precios SIPSA de este producto.
              </p>
            </div>
          ) : (
            <ProductDetailContent
              product={product}
              medellin={medellin}
              bogota={bogota}
              chartSeries={chartSeries}
              lastSevenDays={lastSevenDays}
              priceTrend={priceTrend}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}
