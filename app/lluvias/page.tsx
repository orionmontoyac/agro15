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
              Consulta la lluvia reciente, el historial diario de los últimos 30
              días y el acumulado mensual en Urrao, Antioquia. Datos oficiales
              SIATA para apoyar decisiones agrícolas.
            </p>
          </div>

          {!rainfall ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">
                No hay datos de lluvia disponibles
              </p>
              <p className="mt-2 text-sm">
                No se pudo conectar con SIATA en este momento. Intenta de nuevo
                más tarde.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 md:gap-6">
              <RainCurrentCards data={rainfall} />
              {rainfall.daily.length > 0 && (
                <RainDailyChart
                  daily={rainfall.daily}
                  stationName={rainfall.location.stationName}
                />
              )}
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
