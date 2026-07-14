import assert from "node:assert/strict"

import {
  buildMonthlyProjections,
  buildProjections,
  estimateKilos,
  getNextTwelveMonthSlots,
  type MonthlyPriceStat,
  type PriceStatRow,
  type YieldReference,
} from "../lib/projections"

const yieldRef: YieldReference = {
  unitType: "planta",
  yieldMin: 6,
  yieldAvg: 10,
  yieldMax: 15,
  cicloMeses: 12,
  plantasPorHectarea: 1200,
}

const kilosPlantas = estimateKilos(500, yieldRef, "plantas")
assert.equal(kilosPlantas.kilosMin, 3000)
assert.equal(kilosPlantas.kilosAvg, 5000)
assert.equal(kilosPlantas.kilosMax, 7500)

const kilosHa = estimateKilos(2, yieldRef, "hectareas")
assert.equal(kilosHa.kilosMin, 2 * 1200 * 6)
assert.equal(kilosHa.kilosAvg, 2 * 1200 * 10)
assert.equal(kilosHa.kilosMax, 2 * 1200 * 15)

const kilosDirecto = estimateKilos(1000, null, "kilos_directo")
assert.deepEqual(kilosDirecto, {
  kilosMin: 1000,
  kilosAvg: 1000,
  kilosMax: 1000,
})

assert.throws(
  () => estimateKilos(100, null, "plantas"),
  /aún no tiene datos de rendimiento/
)

const stats: PriceStatRow[] = [
  {
    windowYears: 1,
    priceMin: 4000,
    priceMax: 10000,
    priceAvg: 7000,
    priceStddev: 1400,
    sampleCount: 100,
  },
]

const escenarios = buildProjections(stats, kilosPlantas)
assert.equal(escenarios.length, 3)

const pesimista = escenarios.find((e) => e.escenario === "pesimista")!
assert.equal(pesimista.precioUsado, 4000)
assert.equal(pesimista.kilosUsados, 3000)
assert.equal(pesimista.ingresoTotal, 4000 * 3000)
assert.equal(pesimista.volatilidadPct, 20)

const promedio = escenarios.find((e) => e.escenario === "promedio")!
assert.equal(promedio.ingresoTotal, 7000 * 5000)

const optimista = escenarios.find((e) => e.escenario === "optimista")!
assert.equal(optimista.ingresoTotal, 10000 * 7500)

const slots = getNextTwelveMonthSlots(new Date("2026-07-14T12:00:00-05:00"))
assert.equal(slots.length, 12)
assert.equal(slots[0].monthNumber, 8)
assert.equal(slots[0].year, 2026)
assert.equal(slots[11].monthNumber, 7)
assert.equal(slots[11].year, 2027)

const monthlyStats: MonthlyPriceStat[] = [
  {
    monthNumber: 8,
    priceMin: 5000,
    priceAvg: 8000,
    priceMax: 11000,
    priceStddev: 1000,
    sampleCount: 40,
  },
  {
    monthNumber: 1,
    priceMin: 4000,
    priceAvg: 9000,
    priceMax: 12000,
    priceStddev: 1200,
    sampleCount: 40,
  },
]

const monthly = buildMonthlyProjections(
  monthlyStats,
  kilosPlantas,
  new Date("2026-07-14T12:00:00-05:00")
)
assert.equal(monthly.length, 2)
const best = monthly.find((row) => row.isBestMonth)!
assert.equal(best.monthNumber, 1)
assert.equal(best.ingresoPromedio, 9000 * 5000)
const worst = monthly.find((row) => row.isWorstMonth)!
assert.equal(worst.monthNumber, 8)

console.log("projections math ok")
