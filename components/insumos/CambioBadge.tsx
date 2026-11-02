import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatPct, impactoEconomico } from "@/lib/insumos/indice-types"

/** % change colored by impact on the producer: up = red (costs more). */
export function CambioBadge({
  value,
  className,
  icon = true,
}: {
  value: number | null
  className?: string
  icon?: boolean
}) {
  const impacto = impactoEconomico(value)
  const Icon =
    impacto === "bad" ? TrendingUpIcon : impacto === "good" ? TrendingDownIcon : MinusIcon

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium tabular-nums",
        impacto === "bad" && "text-destructive",
        impacto === "good" && "text-emerald-600 dark:text-emerald-400",
        impacto === "neutral" && "text-muted-foreground",
        className
      )}
    >
      {icon && value != null ? <Icon className="size-3.5 shrink-0" /> : null}
      {formatPct(value)}
    </span>
  )
}
