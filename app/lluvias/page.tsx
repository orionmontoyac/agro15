import { AppShell } from "@/components/app-shell"
import { RainCurrentCards } from "@/components/rain-current-cards"
import { RainDailyChart } from "@/components/rain-daily-chart"
import { RainMonthlyChart } from "@/components/rain-monthly-chart"
import { getRainfallData } from "@/lib/rain/rain-data"

export default async function LluviasPage() {
  const rainfall = await getRainfallData()

  return (
    <AppShell title="Lluvias">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <div>
            <h2 className="text-lg font-semibold">Monitoreo de lluvias</h2>
            <p className="text-sm text-muted-foreground">
              Lluvia diaria y acumulados en Urrao (estación SIATA 641), vía
              Geoportal SIATA. La lluvia actual (5 min) se actualiza en vivo
              cuando el servicio SIATA responde.
            </p>
          </div>

          {!rainfall ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">
                No hay datos de lluvia disponibles
              </p>
              <p className="mt-2 text-sm">
                Ejecuta{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">
                  npm run sync:siata-rain
                </code>{" "}
                para cargar el historial diario desde Geoportal SIATA.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-6">
              <RainCurrentCards data={rainfall} />
              {rainfall.daily.length > 0 ? (
                <RainDailyChart daily={rainfall.daily} />
              ) : null}
              {rainfall.monthly.length > 0 && (
                <RainMonthlyChart monthly={rainfall.monthly} />
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}
