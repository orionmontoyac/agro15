import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { getContextDateLabel } from "@/lib/sipsa/date-labels"
import type { MergedDailyPriceEntry } from "@/lib/sipsa/products-data"

function formatPrice(price: number): string {
  return (
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(price) + "/kg"
  )
}

function priceColorClass(
  price: number,
  maxPrice: number,
  minPrice: number
): string {
  if (maxPrice === minPrice) return ""
  if (price === maxPrice) return "text-primary"
  if (price === minPrice) return "text-chart-5"
  return ""
}

type ProductLastSevenDaysProps = {
  entries: MergedDailyPriceEntry[]
  showMedellin: boolean
  showBogota: boolean
}

export function ProductLastSevenDays({
  entries,
  showMedellin,
  showBogota,
}: ProductLastSevenDaysProps) {
  if (entries.length === 0) return null

  const medellinPrices = showMedellin
    ? entries
        .map((entry) => entry.medellin)
        .filter((price): price is number => price != null)
    : []
  const bogotaPrices = showBogota
    ? entries
        .map((entry) => entry.bogota)
        .filter((price): price is number => price != null)
    : []

  if (medellinPrices.length === 0 && bogotaPrices.length === 0) return null

  const medellinMax =
    medellinPrices.length > 0 ? Math.max(...medellinPrices) : null
  const medellinMin =
    medellinPrices.length > 0 ? Math.min(...medellinPrices) : null
  const bogotaMax = bogotaPrices.length > 0 ? Math.max(...bogotaPrices) : null
  const bogotaMin = bogotaPrices.length > 0 ? Math.min(...bogotaPrices) : null

  const cityLabel =
    showMedellin && showBogota
      ? "Medellín y Bogotá"
      : showMedellin
        ? "Medellín"
        : "Bogotá"

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">
          Últimos 7 precios — {cityLabel}
        </h3>
        <p className="text-sm text-muted-foreground">
          Comparación diaria por ciudad ·{" "}
          <span className="text-primary">verde</span> = mayor precio,{" "}
          <span className="text-chart-5">tierra</span> = menor precio
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {entries.map((entry) => {
          const hasMedellin = showMedellin && entry.medellin != null
          const hasBogota = showBogota && entry.bogota != null

          if (!hasMedellin && !hasBogota) return null

          const dateLabel = getContextDateLabel(entry.date)

          return (
            <Card key={entry.date} className="bg-linear-to-t from-primary/8 to-card shadow-xs dark:bg-card">
              <CardHeader className="gap-2 pb-4">
                <CardDescription
                  className={cn(
                    dateLabel.primary === "HOY" && "font-semibold text-primary",
                    dateLabel.primary === "Ayer" && "font-medium"
                  )}
                >
                  {dateLabel.primary}
                </CardDescription>
                <p className="text-xs text-muted-foreground capitalize">
                  {dateLabel.secondary}
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  {hasMedellin && (
                    <div>
                      <p className="text-xs text-muted-foreground">Medellín</p>
                      <CardTitle
                        className={cn(
                          "text-base font-semibold tabular-nums",
                          medellinMax != null &&
                            medellinMin != null &&
                            priceColorClass(
                              entry.medellin!,
                              medellinMax,
                              medellinMin
                            )
                        )}
                      >
                        {formatPrice(entry.medellin!)}
                      </CardTitle>
                    </div>
                  )}
                  {hasBogota && (
                    <div>
                      <p className="text-xs text-muted-foreground">Bogotá</p>
                      <CardTitle
                        className={cn(
                          "text-base font-semibold tabular-nums",
                          bogotaMax != null &&
                            bogotaMin != null &&
                            priceColorClass(entry.bogota!, bogotaMax, bogotaMin)
                        )}
                      >
                        {formatPrice(entry.bogota!)}
                      </CardTitle>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
