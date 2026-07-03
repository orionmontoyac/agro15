import type { Metadata } from "next"

import { buildOpenGraph, buildTwitter } from "@/lib/site-metadata"

export type ProductMetadataSource = {
  product_code: string
  product_name: string
}

export function buildProductPageMetadata(
  product: ProductMetadataSource
): Metadata {
  const shareTitle = `${product.product_name} — Precios SIPSA en Medellín y Bogotá`
  const description = `Precios actuales e históricos de ${product.product_name} en mercados mayoristas de Medellín y Bogotá. Código SIPSA ${product.product_code}. Datos oficiales del DANE.`

  return {
    title: product.product_name,
    description,
    openGraph: buildOpenGraph(shareTitle, description),
    twitter: buildTwitter(shareTitle, description),
  }
}

export const productNotFoundMetadata: Metadata = {
  title: "Producto no encontrado",
  description: "El producto solicitado no está en el catálogo SIPSA.",
  robots: { index: false, follow: false },
}
