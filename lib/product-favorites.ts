const FAVORITES_STORAGE_KEY = "agro15.product-favorites.v1"

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  )
}

export function readFavoriteProductCodes(): string[] {
  if (!canUseStorage()) return []
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((code): code is string => typeof code === "string" && code.length > 0)
      .map((code) => code.trim())
  } catch {
    return []
  }
}

export function writeFavoriteProductCodes(codes: string[]): void {
  if (!canUseStorage()) return
  const unique = [...new Set(codes.map((code) => code.trim()).filter(Boolean))]
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(unique))
}

export function isFavoriteProductCode(
  favorites: string[],
  code: string
): boolean {
  return favorites.includes(code)
}

export function toggleFavoriteProductCode(
  favorites: string[],
  code: string
): string[] {
  if (favorites.includes(code)) {
    return favorites.filter((entry) => entry !== code)
  }
  return [...favorites, code]
}

/** Keep current order, but move favorites to the front. */
export function preferFavoriteProducts<T extends { code: string }>(
  items: T[],
  favorites: string[]
): T[] {
  if (favorites.length === 0) return items
  const favoriteSet = new Set(favorites)
  const favored: T[] = []
  const rest: T[] = []
  for (const item of items) {
    if (favoriteSet.has(item.code)) favored.push(item)
    else rest.push(item)
  }
  return [...favored, ...rest]
}
