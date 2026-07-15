import { createClient } from "@/lib/supabase/server"

export type ProjectionProductOption = {
  id: number
  code: string
  name: string
  hasYieldReference: boolean
  unitType: "planta" | "hectarea" | null
}

type RpcProjectionProduct = {
  id: number
  product_code: string
  product_name: string
  unit_type: string | null
  has_yield_reference: boolean
}

export async function getProjectionProductOptions(): Promise<
  ProjectionProductOption[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("get_projection_products")

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as RpcProjectionProduct[]).map((row) => ({
    id: Number(row.id),
    code: row.product_code,
    name: row.product_name,
    hasYieldReference: Boolean(row.has_yield_reference),
    unitType:
      row.unit_type === "planta" || row.unit_type === "hectarea"
        ? row.unit_type
        : null,
  }))
}
