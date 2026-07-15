"use client"

import { FavoriteStarButton } from "@/components/favorite-star-button"
import { useProductFavorites } from "@/hooks/use-product-favorites"

type ProductFavoriteControlProps = {
  productCode: string
  productName: string
}

export function ProductFavoriteControl({
  productCode,
  productName,
}: ProductFavoriteControlProps) {
  const { isFavorite, toggleFavorite } = useProductFavorites()

  return (
    <FavoriteStarButton
      productCode={productCode}
      productName={productName}
      isFavorite={isFavorite(productCode)}
      onToggle={toggleFavorite}
      size="icon"
      className="size-9"
    />
  )
}
