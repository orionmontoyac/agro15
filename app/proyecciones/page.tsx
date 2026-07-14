import { AppShell } from "@/components/app-shell"
import { ProyeccionesWorkspace } from "@/components/proyecciones-workspace"
import { getProjectionProductOptions } from "@/lib/proyecciones-data"

export default async function ProyeccionesPage() {
  const products = await getProjectionProductOptions()

  return (
    <AppShell title="Proyecciones">
      <div className="@container/main flex flex-1 flex-col gap-2">
        <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
          <div>
            <h2 className="text-lg font-semibold">Proyección de ingresos</h2>
            <p className="text-sm text-muted-foreground">
              Convierte plantas o hectáreas a kilos (cuando hay rendimiento de
              referencia) y estima ingresos con precios SIPSA de 1, 3 y 5 años.
            </p>
          </div>

          {products.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-lg font-medium">No hay productos con precios</p>
              <p className="mt-2 text-sm">
                Sincroniza precios SIPSA para habilitar proyecciones.
              </p>
            </div>
          ) : (
            <ProyeccionesWorkspace products={products} />
          )}
        </div>
      </div>
    </AppShell>
  )
}
