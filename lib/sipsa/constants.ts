export const AGRO15_PRODUCTS = [
  { code: "106", name: "Granadilla" },
  { code: "89", name: "Aguacate Hass" },
  { code: "100", name: "Curuba" },
  { code: "40", name: "Fríjol verde cargamanto" },
  { code: "113", name: "Gulupa" },
  { code: "116", name: "Lulo" },
  { code: "46", name: "Tomate chonto regional" },
  { code: "148", name: "Tomate de árbol" },
  { code: "215", name: "Fríjol cargamanto rojo" },
  { code: "214", name: "Fríjol cargamanto blanco" },
  { code: "94", name: "Banano Urabá" },
  { code: "29", name: "Cebolla junca" },
  { code: "6", name: "Coliflor" },
  { code: "104", name: "Feijoa" },
  { code: "233", name: "Maíz pira" },
  { code: "159", name: "Papa criolla limpia" },
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
