"use client"

import { StarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type FavoriteStarButtonProps = {
  productCode: string
  productName: string
  isFavorite: boolean
  onToggle: (code: string) => void
  className?: string
  size?: "icon-sm" | "icon" | "icon-xs"
}

export function FavoriteStarButton({
  productCode,
  productName,
  isFavorite,
  onToggle,
  className,
  size = "icon-sm",
}: FavoriteStarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn(
        "relative z-10 shrink-0 text-muted-foreground hover:text-amber-500",
        isFavorite && "text-amber-500 hover:text-amber-500",
        className
      )}
      aria-label={
        isFavorite
          ? `Quitar ${productName} de favoritos`
          : `Agregar ${productName} a favoritos`
      }
      aria-pressed={isFavorite}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onToggle(productCode)
      }}
      onKeyDown={(event) => {
        // Keep Enter/Space on the row from navigating while focusing the star.
        event.stopPropagation()
      }}
    >
      <StarIcon
        className={cn("size-4", isFavorite && "fill-current")}
        aria-hidden
      />
    </Button>
  )
}
