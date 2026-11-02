import Link from "next/link"

import { CambioBadge } from "@/components/insumos/CambioBadge"
import { Sparkline } from "@/components/insumos/Sparkline"
import {
  INSUMO_GRUPOS,
  formatIndiceValor,
  formatMesLargo,
  impactoEconomico,
  resumenSerie,
  type InsumoIndiceDataset,
} from "@/lib/insumos/indice-types"
import { cn } from "@/lib/utils"

/** Series needed for the home summary. */
export const INSUMOS_RESUMEN_PRODUCTOS = [
  "Indice_total",
  ...INSUMO_GRUPOS.map((g) => g.total),
]

const SPARK_MONTHS = 24

export function InsumosResumen({ dataset }: { dataset: InsumoIndiceDataset }) {
  const byProducto = new Map(dataset.series.map((s) => [s.producto, s]))
  const total = byProducto.get("Indice_total")
  const totalResumen = total ? resumenSerie(dataset.fechas, total.valores) : null

  return (
    <>
      {totalResumen?.valorActual != null ? (
        <div className="rounded-lg border bg-background/40 px-3 py-2.5">
          <div className="text-xs text-muted-foreground">
            Índice agrícola total
            {totalResumen.fechaActual ? ` · ${formatMesLargo(totalResumen.fechaActual)}` : ""}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatIndiceValor(totalResumen.valorActual)}
            </span>
            <span className="text-sm">
              <CambioBadge value={totalResumen.cambio12m} /> en 12 meses
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Los insumos cuestan{" "}
            {formatIndiceValor(Math.abs(totalResumen.valorActual - 100))}%{" "}
            {totalResumen.valorActual >= 100 ? "más" : "menos"} que en enero de 2021.
          </p>
        </div>
      ) : null}

      <ul className="-mx-2 flex flex-col">
        {INSUMO_GRUPOS.map((g) => {
          const serie = byProducto.get(g.total)
          if (!serie) return null
          const r = resumenSerie(dataset.fechas, serie.valores)
          const impacto = impactoEconomico(r.cambio12m)
          return (
            <li key={g.key}>
              <Link
                href="/insumos"
                className="grid grid-cols-[minmax(0,1fr)_4.5rem_auto] items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{g.label}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Mes <CambioBadge value={r.cambioMes} icon={false} />
                  </div>
                </div>
                <div
                  className={cn(
                    impacto === "bad" && "text-destructive",
                    impacto === "good" && "text-emerald-600 dark:text-emerald-400",
                    impacto === "neutral" && "text-muted-foreground"
                  )}
                >
                  <Sparkline values={serie.valores.slice(-SPARK_MONTHS)} className="h-8" />
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">
                    {r.valorActual == null ? "—" : formatIndiceValor(r.valorActual)}
                  </div>
                  <div className="text-xs">
                    <CambioBadge value={r.cambio12m} icon={false} />
                  </div>
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
