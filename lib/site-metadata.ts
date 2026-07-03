import type { Metadata } from "next"

export const SITE_NAME = "Agro15"

export const DEFAULT_TITLE =
  "Agro15 — Precios agrícolas, insumos y lluvias en Colombia"

export const DEFAULT_DESCRIPTION =
  "Consulta precios SIPSA de frutas en Medellín y Bogotá, insumos agrícolas, abastecimiento y lluvias en Urrao. Datos oficiales del DANE y SIATA."

export const SOCIAL_IMAGE = {
  url: "/logo.png",
  width: 1254,
  height: 1254,
  alt: SITE_NAME,
} as const

export function getMetadataBase(): URL {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    "http://localhost:3000"

  return new URL(raw.endsWith("/") ? raw : `${raw}/`)
}

export function buildOpenGraph(
  title: string = DEFAULT_TITLE,
  description: string = DEFAULT_DESCRIPTION
): NonNullable<Metadata["openGraph"]> {
  return {
    title,
    description,
    siteName: SITE_NAME,
    type: "website",
    locale: "es_CO",
    images: [SOCIAL_IMAGE],
  }
}

export function buildTwitter(
  title: string = DEFAULT_TITLE,
  description: string = DEFAULT_DESCRIPTION
): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title,
    description,
    images: [SOCIAL_IMAGE.url],
  }
}
