import Link from "next/link"
import {
  CalculatorIcon,
  CloudRainIcon,
  FlaskConicalIcon,
  PackageIcon,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { HomeSection, HomeSectionEmpty } from "@/components/home/HomeSection"
import {
  INSUMOS_RESUMEN_PRODUCTOS,
  InsumosResumen,
} from "@/components/home/InsumosResumen"
import { LluviasResumen } from "@/components/home/LluviasResumen"
import { ProductosResumen } from "@/components/home/ProductosResumen"
import { getInsumoIndiceDataset } from "@/lib/insumos/indice-data"
import { getRainfallData } from "@/lib/rain/rain-data"
import { getDashboardData } from "@/lib/sipsa/dashboard-data"

/** One failing source should not take down the whole home page. */
async function safe<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`Home: ${label} failed`, error)
    return null
  }
}

export default async function Page() {
  const [productos, insumos, lluvias] = await Promise.all([
    safe("productos", getDashboardData),
    safe("insumos", () =>
      getInsumoIndiceDataset({ productos: INSUMOS_RESUMEN_PRODUCTOS })
    ),
    safe("lluvias", getRainfallData),
  ])

  return (
    <AppShell title="Inicio">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">Bienvenido a Agro15</h2>
              <p className="text-sm text-muted-foreground">
                Resumen rápido de precios de productos, costo de insumos y
                lluvias en Urrao.
              </p>
            </div>
            <Link
              href="/proyecciones"
              className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline sm:self-auto"
            >
              <CalculatorIcon className="size-4" />
              Proyectar ingresos
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
            <HomeSection
              icon={PackageIcon}
              title="Productos"
              description="Precios mayoristas SIPSA · Medellín y Bogotá"
              href="/products"
              linkLabel="Ver todos"
            >
              {productos ? (
                <ProductosResumen
                  kpis={productos.kpis}
                  avgChangePct={productos.avgChangePct}
                />
              ) : (
                <HomeSectionEmpty>
                  Sin precios cargados. Ejecuta{" "}
                  <code className="rounded bg-muted px-1">npm run sync:sipsa-prices</code>.
                </HomeSectionEmpty>
              )}
            </HomeSection>

            <HomeSection
              icon={FlaskConicalIcon}
              title="Insumos"
              description="Índice de precios UPRA · base ene-2021 = 100"
              href="/insumos"
              linkLabel="Ver detalle"
              footer="12 meses: rojo = más caro para el productor"
            >
              {insumos && insumos.series.length > 0 ? (
                <InsumosResumen dataset={insumos} />
              ) : (
                <HomeSectionEmpty>
                  Sin datos del índice. Ejecuta{" "}
                  <code className="rounded bg-muted px-1">npm run sync:insumo-indice</code>.
                </HomeSectionEmpty>
              )}
            </HomeSection>

            <HomeSection
              icon={CloudRainIcon}
              title="Lluvias"
              description={
                lluvias
                  ? `${lluvias.location.municipality} · estación SIATA ${lluvias.location.stationCode ?? "641"}`
                  : "Estación SIATA"
              }
              href="/lluvias"
              linkLabel="Ver detalle"
            >
              {lluvias ? (
                <LluviasResumen data={lluvias} />
              ) : (
                <HomeSectionEmpty>
                  Sin datos de lluvia. Ejecuta{" "}
                  <code className="rounded bg-muted px-1">npm run sync:siata-rain</code>.
                </HomeSectionEmpty>
              )}
            </HomeSection>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
