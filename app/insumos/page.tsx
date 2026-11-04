import { AppShell } from "@/components/app-shell"
import { InsumosIndice } from "@/components/insumos/InsumosIndice"
import { InsumosTable } from "@/components/insumos-table"
import { getInsumoIndiceDataset } from "@/lib/insumos/indice-data"
import { formatMesLargo } from "@/lib/insumos/indice-types"
import { getInsumosPageData } from "@/lib/sipsa/insumos-data"

/** UPRA / SIPSA-I insumo data is monthly; refresh every 6 h. */
export const revalidate = 21600

export default async function InsumosPage() {
  const [data, indice] = await Promise.all([
    getInsumosPageData(),
    getInsumoIndiceDataset(),
  ])

  return (
    <AppShell title="Insumos">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <div>
            <h2 className="text-lg font-semibold">Precios de agroinsumos</h2>
            <p className="text-sm text-muted-foreground">
              Cuánto han subido fertilizantes, plaguicidas y alimentos
              balanceados para animales en el mercado minorista nacional.
            </p>
          </div>

          <InsumosIndice dataset={indice} />

          <p className="-mt-2 text-xs text-muted-foreground md:-mt-4">
            Fuente: UPRA –{" "}
            <a
              href="https://upra.gov.co/es-co/destacados/indice-de-precios-de-agroinsumos"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Índice de precios de agroinsumos
            </a>{" "}
            (datos.gov.co{" "}
            <a
              href="https://www.datos.gov.co/d/gwbi-fnzs"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              agrícolas
            </a>
            ,{" "}
            <a
              href="https://www.datos.gov.co/d/wgj6-cvyj"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ABA
            </a>
            )
            {indice.latestFecha
              ? ` · último dato ${formatMesLargo(indice.latestFecha)}`
              : null}{" "}
            · se actualiza semanalmente
          </p>

          <div className="pt-2">
            <h3 className="text-base font-semibold">
              Precios locales SIPSA-I
            </h3>
            <p className="text-sm text-muted-foreground">
              Precios promedio mensuales en pesos publicados por DANE en
              Medellín y Bogotá.
            </p>
          </div>

          {!data.hasData ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">Sin datos de insumos locales</p>
              <p className="mt-2 text-sm">
                Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:sipsa-insumos
                </code>{" "}
                para cargar precios desde el boletín mensual DANE (SIPSA-I).
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
