import { AppShell } from "@/components/app-shell"
import { SectionCards } from "@/components/section-cards"
import { getDashboardData } from "@/lib/sipsa/dashboard-data"

export default async function Page() {
  const dashboardData = await getDashboardData()

  return (
    <AppShell>
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
          <div className="px-4 lg:px-6">
            <h2 className="text-lg font-semibold">Bienvenido a Agro15</h2>
            <p className="text-sm text-muted-foreground">
              Consulta precios mayoristas de productos agrícolas en Colombia,
              con datos oficiales de SIPSA en Medellín y Bogotá.
            </p>
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
