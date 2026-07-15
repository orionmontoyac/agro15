import Link from "next/link"
import {
  CalculatorIcon,
  CloudRainIcon,
  FlaskConicalIcon,
  PackageIcon,
} from "lucide-react"

import { AppShell } from "@/components/app-shell"
import { SectionCards } from "@/components/section-cards"
import { buttonVariants } from "@/components/ui/button"
import { getDashboardData } from "@/lib/sipsa/dashboard-data"
import { cn } from "@/lib/utils"

const quickLinks = [
  {
    title: "Productos",
    href: "/products",
    description: "Lista de precios",
    icon: PackageIcon,
  },
  {
    title: "Lluvias",
    href: "/lluvias",
    description: "Monitoreo SIATA",
    icon: CloudRainIcon,
  },
  {
    title: "Insumos",
    href: "/insumos",
    description: "Fertilizantes",
    icon: FlaskConicalIcon,
  },
  {
    title: "Proyecciones",
    href: "/proyecciones",
    description: "Ingresos estimados",
    icon: CalculatorIcon,
  },
] as const

export default async function Page() {
  const dashboardData = await getDashboardData()

  return (
    <AppShell>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="flex flex-col gap-4 px-4 lg:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Bienvenido a Agro15</h2>
                <p className="text-sm text-muted-foreground">
                  Consulta precios mayoristas de productos agrícolas en Colombia,
                  con datos oficiales de SIPSA en Medellín y Bogotá.
                </p>
              </div>
              <nav
                aria-label="Accesos rápidos"
                className="flex flex-wrap gap-2 sm:shrink-0"
              >
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "lg" }),
                      "h-auto gap-2 px-3 py-2"
                    )}
                  >
                    <link.icon data-icon="inline-start" />
                    <span className="flex flex-col items-start leading-tight">
                      <span>{link.title}</span>
                      <span className="text-[0.7rem] font-normal text-muted-foreground">
                        {link.description}
                      </span>
                    </span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>

          {!dashboardData ? (
            <div className="px-4 py-12 text-center text-muted-foreground lg:px-6">
              <p className="text-lg font-medium">
                No hay datos de precios disponibles
              </p>
              <p className="mt-2 text-sm">
                Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-catalog
                </code>{" "}
                y luego{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-prices -- &lt;código&gt; --years 3
                </code>{" "}
                para cargar precios SIPSA.
              </p>
            </div>
          ) : (
            <SectionCards
              kpis={dashboardData.kpis}
              avgChangePct={dashboardData.avgChangePct}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}
