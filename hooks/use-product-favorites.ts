"use client"

import * as React from "react"

import {
  isFavoriteProductCode,
  preferFavoriteProducts,
  readFavoriteProductCodes,
  toggleFavoriteProductCode,
  writeFavoriteProductCodes,
} from "@/lib/product-favorites"

export function useProductFavorites() {
  const [favorites, setFavorites] = React.useState<string[]>([])
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    setFavorites(readFavoriteProductCodes())
    setReady(true)
  }, [])

  const isFavorite = React.useCallback(
    (code: string) => isFavoriteProductCode(favorites, code),
    [favorites]
  )

  const toggleFavorite = React.useCallback((code: string) => {
    setFavorites((current) => {
      const next = toggleFavoriteProductCode(current, code)
      writeFavoriteProductCodes(next)
      return next
    })
  }, [])

  const sortWithFavorites = React.useCallback(
    <T extends { code: string }>(items: T[]) =>
      preferFavoriteProducts(items, favorites),
    [favorites]
  )

  return {
    favorites,
    ready,
    isFavorite,
    toggleFavorite,
    sortWithFavorites,
  }
}
