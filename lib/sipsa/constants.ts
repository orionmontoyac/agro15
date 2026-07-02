export const AGRO15_PRODUCTS = [
  { code: "100", name: "Curuba" },
  { code: "106", name: "Granadilla" },
  { code: "113", name: "Gulupa" },
  { code: "116", name: "Lulo" },
  { code: "148", name: "Tomate de árbol" },
  { code: "89", name: "Aguacate Hass" },
  { code: "215", name: "Fríjol cargamanto rojo" },
  { code: "40", name: "Fríjol verde cargamanto" },
  { code: "46", name: "Tomate chonto regional" },
] as const

export const TRACKED_MUNICIPALITIES = ["05001", "11001"] as const

export const MEDELLIN_CODE = "05001"
export const BOGOTA_CODE = "11001"

export const DEFAULT_PRODUCT_CODE = "106"

export type MunicipalityFilter = "all" | typeof MEDELLIN_CODE | typeof BOGOTA_CODE

export const MUNICIPALITY_FILTER_OPTIONS = [
  { value: "all" as const, label: "Todos los mercados" },
  { value: MEDELLIN_CODE, label: "Medellín" },
  { value: BOGOTA_CODE, label: "Bogotá" },
]
