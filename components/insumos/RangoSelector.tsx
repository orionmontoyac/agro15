"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  INSUMO_RANGO_OPTIONS,
  type InsumoRangoKey,
} from "@/lib/insumos/indice-types"

type RangoSelectorProps = {
  value: InsumoRangoKey
  onChange: (value: InsumoRangoKey) => void
}

export function RangoSelector({ value, onChange }: RangoSelectorProps) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(next) => {
        const selected = next[0] as InsumoRangoKey | undefined
        if (selected) onChange(selected)
      }}
      variant="outline"
      size="sm"
      className="w-full justify-stretch sm:w-auto"
    >
      {INSUMO_RANGO_OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.key}
          value={opt.key}
          className="flex-1 px-3 sm:flex-none"
          aria-label={`Rango ${opt.label}`}
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
