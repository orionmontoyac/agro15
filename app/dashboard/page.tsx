import { Suspense } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { getInsumoIndiceDataset } from "@/lib/insumos/indice-data"
import { getRainfallData } from "@/lib/rain/rain-data"
import { getDashboardData } from "@/lib/sipsa/dashboard-data"

/** Live rain is part of the page: keep the cached page at most 5 min old. */
export const revalidate = 300

/** One failing source should not take down the whole home page. */
async function safe<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error(`Home: ${label} failed`, error)
    return null
  }
}

const SECTIONS = {
  productos: {
    icon: PackageIcon,
    title: "Productos",
    description: "Precios mayoristas SIPSA · Medellín y Bogotá",
    href: "/products",
    linkLabel: "Ver todos",
  },
  insumos: {
    icon: FlaskConicalIcon,
    title: "Insumos",
    description: "Índice de precios UPRA · base ene-2021 = 100",
    href: "/insumos",
    linkLabel: "Ver detalle",
  },
  lluvias: {
    icon: CloudRainIcon,
    title: "Lluvias",
    description: "Urrao · estación SIATA 641",
    href: "/lluvias",
    linkLabel: "Ver detalle",
  },
} as const

export default function Page() {
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

          {/* Each section streams in on its own; a slow source (e.g. SIATA) doesn't block the others. */}
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-3">
            <Suspense fallback={<SectionSkeleton section="productos" />}>
              <ProductosSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton section="insumos" />}>
              <InsumosSection />
            </Suspense>
            <Suspense fallback={<SectionSkeleton section="lluvias" />}>
              <LluviasSection />
            </Suspense>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

async function ProductosSection() {
  const productos = await safe("productos", getDashboardData)
  return (
    <HomeSection {...SECTIONS.productos}>
      {productos ? (
        <ProductosResumen kpis={productos.kpis} avgChangePct={productos.avgChangePct} />
      ) : (
        <HomeSectionEmpty>
          Sin precios cargados. Ejecuta{" "}
          <code className="rounded bg-muted px-1">npm run sync:sipsa-prices</code>.
        </HomeSectionEmpty>
      )}
    </HomeSection>
  )
}

async function InsumosSection() {
  const insumos = await safe("insumos", () =>
    getInsumoIndiceDataset({ productos: INSUMOS_RESUMEN_PRODUCTOS })
  )
  return (
    <HomeSection
      {...SECTIONS.insumos}
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
  )
}

async function LluviasSection() {
  const lluvias = await safe("lluvias", getRainfallData)
  return (
    <HomeSection
      {...SECTIONS.lluvias}
      description={
        lluvias
          ? `${lluvias.location.municipality} · estación SIATA ${lluvias.location.stationCode ?? "641"}`
          : SECTIONS.lluvias.description
      }
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
  )
}

function SectionSkeleton({ section }: { section: keyof typeof SECTIONS }) {
  return (
    <HomeSection {...SECTIONS[section]}>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 rounded-lg" />
        ))}
      </div>
    </HomeSection>
  )
}
