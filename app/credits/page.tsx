import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { AppShell } from "@/components/app-shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Créditos",
  description:
    "Conoce Agro15, cómo está construida la aplicación y quién la desarrolló.",
}

const DATA_SOURCES = [
  {
    name: "SIPSA (DANE)",
    detail: "Precios mayoristas diarios, semanales y mensuales de frutas en Medellín y Bogotá.",
  },
  {
    name: "SIPSA-I (DANE)",
    detail: "Precios de insumos agrícolas publicados en boletines oficiales.",
  },
  {
    name: "SIATA",
    detail: "Datos de lluvia en Urrao, Antioquia, para apoyo a decisiones de campo.",
  },
]

const STACK = [
  "Next.js 16 (App Router)",
  "React 19",
  "TypeScript",
  "Supabase (Postgres)",
  "Tailwind CSS y shadcn/ui",
  "Recharts",
  "Netlify (despliegue y sincronización programada)",
]

export default function CreditsPage() {
  return (
    <AppShell title="Créditos">
      <div className="@container/main flex flex-1 flex-col">
        <div className="relative overflow-hidden border-b bg-linear-to-b from-primary/10 via-background to-background">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-10 text-center md:py-14 lg:px-6">
            <div className="relative flex h-40 w-full max-w-sm items-center justify-center md:h-52 md:max-w-md">
              <Image
                src="/logo.png"
                alt="Agro15"
                width={512}
                height={512}
                priority
                className="max-h-full w-auto max-w-full object-contain drop-shadow-sm"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Agro15
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Precios, lluvias e insumos para productores agrícolas en
                Colombia — con datos oficiales y visualizaciones claras.
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 lg:px-6">
          <Card>
            <CardHeader>
              <CardTitle>Qué es Agro15</CardTitle>
              <CardDescription>
                Una herramienta para consultar información agrícola en un solo
                lugar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                Agro15 reúne precios mayoristas de frutas (SIPSA), niveles de
                abastecimiento, insumos agrícolas (SIPSA-I) y lluvias locales
                (SIATA). Está pensada para productores, técnicos y equipos que
                necesitan contexto de mercado en Medellín, Bogotá y Urrao sin
                navegar múltiples fuentes dispersas.
              </p>
              <p>
                En el panel de inicio ves tendencias recientes; en cada producto
                encuentras historial, rangos diarios y comparación entre ciudades;
                en insumos consultas fertilizantes y fitosanitarios; y en lluvias
                monitoreas acumulados e historial mensual.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cómo está construida</CardTitle>
              <CardDescription>
                Aplicación web moderna con sincronización automática de datos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                El frontend está desarrollado con Next.js y React. Los datos se
                almacenan en Supabase y se actualizan mediante scripts de
                sincronización con APIs y publicaciones del DANE, ejecutados de
                forma programada en producción.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {STACK.map((item) => (
                  <li
                    key={item}
                    className="rounded-lg border bg-muted/40 px-3 py-2 text-foreground"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fuentes de datos</CardTitle>
              <CardDescription>
                Información pública procesada y presentada para facilitar su
                lectura.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {DATA_SOURCES.map((source) => (
                  <li
                    key={source.name}
                    className="rounded-lg border px-4 py-3"
                  >
                    <p className="font-medium text-foreground">{source.name}</p>
                    <p className="mt-1 text-muted-foreground">{source.detail}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-linear-to-br from-primary/5 to-card">
            <CardHeader>
              <CardTitle>Créditos</CardTitle>
              <CardDescription>Desarrollo y contacto</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-lg font-semibold text-foreground">
                  Ingeniero Orion Montoya C
                </p>
                <p className="mt-1 text-muted-foreground">
                  Diseño, desarrollo e integración de datos de Agro15.
                </p>
              </div>
              <Link
                href="mailto:orionmontoyac@gmail.com"
                className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
              >
                orionmontoyac@gmail.com
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
