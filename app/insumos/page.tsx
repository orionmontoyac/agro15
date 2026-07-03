import { AppShell } from "@/components/app-shell"
import { InsumosTable } from "@/components/insumos-table"
import { getInsumosPageData } from "@/lib/sipsa/insumos-data"

export default async function InsumosPage() {
  const data = await getInsumosPageData()

  return (
    <AppShell title="Insumos">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <div>
            <h2 className="text-lg font-semibold">Precios de insumos agrícolas</h2>
            <p className="text-sm text-muted-foreground">
              Promedios mensuales de insumos (SIPSA-I) publicados por DANE en
              Medellín y Bogotá — fertilizantes, fitosanitarios, insumos
              pecuarios y más.
            </p>
          </div>

          {!data.hasData ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Sin datos de insumos</p>
              <p className="mt-2 text-sm">
                Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-insumos
                </code>{" "}
                para cargar precios desde el boletín mensual DANE (SIPSA-I).
              </p>
              <p className="mt-2 text-xs">
                Para historial 2021–2026:{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-insumos -- --historical
                </code>
              </p>
            </div>
          ) : (
            <InsumosTable
              rows={data.rows}
              categories={data.categories}
              latestMonth={data.latestMonth}
              historyByInsumo={data.historyByInsumo}
            />
          )}
        </div>
      </div>
    </AppShell>
  )
}
