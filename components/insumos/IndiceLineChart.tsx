"use client"

import * as React from "react"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  formatIndiceFecha,
  formatIndiceValor,
} from "@/lib/insumos/indice-types"

export type IndiceLine = {
  /** Safe key for recharts / CSS vars (e.g. "s0"). */
  key: string
  label: string
  color: string
  valores: (number | null)[]
  emphasis?: boolean
}

type IndiceLineChartProps = {
  fechas: string[]
  lines: IndiceLine[]
}

export function IndiceLineChart({ fechas, lines }: IndiceLineChartProps) {
  const config = React.useMemo(
    () =>
      Object.fromEntries(
        lines.map((l) => [l.key, { label: l.label, color: l.color }])
      ) satisfies ChartConfig,
    [lines]
  )

  const data = React.useMemo(
    () =>
      fechas.map((fecha, i) => {
        const row: Record<string, string | number | null> = { fecha }
        for (const l of lines) row[l.key] = l.valores[i] ?? null
        return row
      }),
    [fechas, lines]
  )

  const hasData = lines.some((l) => l.valores.some((v) => v != null))

  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Sin datos para el rango seleccionado.
      </div>
    )
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[280px] w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="fecha"
          tickLine={false}
          axisLine={false}
          minTickGap={28}
          tickFormatter={(v) => formatIndiceFecha(String(v))}
          tick={{ fontSize: 11 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => String(Math.round(Number(v)))}
          domain={["auto", "auto"]}
        />
        <ReferenceLine
          y={100}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          ifOverflow="hidden"
          label={{
            value: "ene-21 = 100",
            position: "insideBottomLeft",
            fontSize: 10,
            fill: "var(--muted-foreground)",
          }}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const fecha = payload?.[0]?.payload?.fecha
                return fecha ? formatIndiceFecha(String(fecha)) : ""
              }}
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: item.color }}
                    />
                    {config[String(name)]?.label ?? name}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {value == null || value === ""
                      ? "—"
                      : formatIndiceValor(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        {lines.map((l) => (
          <Line
            key={l.key}
            type="monotone"
            dataKey={l.key}
            name={l.key}
            stroke={`var(--color-${l.key})`}
            strokeWidth={l.emphasis ? 2.75 : 1.75}
            dot={false}
            activeDot={{ r: 3.5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
