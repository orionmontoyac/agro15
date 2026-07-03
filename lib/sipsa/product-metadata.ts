import type { Metadata } from "next"

export type ProductMetadataSource = {
  product_code: string
  product_name: string
}

export function buildProductPageMetadata(
  product: ProductMetadataSource
): Metadata {
  const shareTitle = `${product.product_name} — Precios SIPSA`
  const description = `Precios actuales e históricos de ${product.product_name} en mercados mayoristas de Medellín y Bogotá. Código SIPSA ${product.product_code}.`

  return {
    title: product.product_name,
    description,
    openGraph: {
      title: shareTitle,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: shareTitle,
      description,
    },
  }
}

export const productNotFoundMetadata: Metadata = {
  title: "Producto no encontrado",
  description: "El producto solicitado no está en el catálogo SIPSA.",
  robots: { index: false, follow: false },
}
