export const SIPSA_SOAP_URL =
  process.env.SIPSA_SOAP_URL ??
  'https://appweb.dane.gov.co/sipsaWS/SrvSipsaUpraBeanService'

const SOAP_NS = 'http://www.w3.org/2003/05/soap-envelope'
const SERVICE_NS = 'http://servicios.sipsa.co.gov.dane/'

const ABASTECIMIENTO_ENVELOPE = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:ns="${SERVICE_NS}">
  <soap:Body>
    <ns:promedioAbasSipsaMesMadr/>
  </soap:Body>
</soap:Envelope>`

function readTag(block, tag) {
  const match = block.match(new RegExp(`<(?:\\w+:)?${tag}>([^<]*)</(?:\\w+:)?${tag}>`))
  return match?.[1]?.trim() ?? null
}

function parseAbastecimientoXml(xml) {
  const returns = []
  const returnBlocks = xml.match(/<(?:\w+:)?return>[\s\S]*?<\/(?:\w+:)?return>/g) ?? []

  for (const block of returnBlocks) {
    const artiId = readTag(block, 'artiId')
    const cantidadTon = readTag(block, 'cantidadTon')
    if (!artiId || cantidadTon == null) continue

    returns.push({
      artiId,
      artiNombre: readTag(block, 'artiNombre'),
      cantidadTon: Number(cantidadTon),
      fechaMesIni: readTag(block, 'fechaMesIni'),
      fuenId: readTag(block, 'fuenId'),
      fuenNombre: readTag(block, 'fuenNombre'),
      futiId: readTag(block, 'futiId'),
    })
  }

  return returns
}

export async function fetchSipsaAbastecimiento(options = {}) {
  const timeoutMs = options.timeoutMs ?? 300_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(SIPSA_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        Accept: 'application/soap+xml, text/xml, */*',
      },
      body: ABASTECIMIENTO_ENVELOPE,
      signal: controller.signal,
    })

    const body = await response.text()

    if (!response.ok) {
      throw new Error(
        `SIPSA SOAP error ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
      )
    }

    return parseAbastecimientoXml(body)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`SIPSA SOAP request timed out (${timeoutMs}ms)`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export const TRACKED_SUPPLY_MARKETS = [
  {
    label: 'Medellín',
    municipality_code: '05001',
    match: (name) =>
      /medell[ií]n|central mayorista de antioquia/i.test(name ?? ''),
  },
  {
    label: 'Bogotá',
    municipality_code: '11001',
    match: (name) => /bogot[aá]|corabastos/i.test(name ?? ''),
  },
]

export function matchSupplyMarket(fuenNombre) {
  return TRACKED_SUPPLY_MARKETS.find((market) => market.match(fuenNombre)) ?? null
}

export function parsePeriodMonth(fechaMesIni) {
  if (!fechaMesIni) return null
  const date = new Date(fechaMesIni)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function buildInsumosEnvelope(tireId) {
  const argBlock =
    tireId != null
      ? `<ns:consultarInsumosSipsaMesMadr><arg0>${tireId}</arg0></ns:consultarInsumosSipsaMesMadr>`
      : '<ns:consultarInsumosSipsaMesMadr/>'

  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:ns="${SERVICE_NS}">
  <soap:Body>${argBlock}</soap:Body>
</soap:Envelope>`
}

function parseInsumosXml(xml) {
  const returns = []
  const returnBlocks = xml.match(/<(?:\w+:)?return>[\s\S]*?<\/(?:\w+:)?return>/g) ?? []

  for (const block of returnBlocks) {
    const insumoNombre = readTag(block, 'insumoNombre')
    const promedio = readTag(block, 'promedio')
    if (!insumoNombre || promedio == null) continue

    returns.push({
      deptNombre: readTag(block, 'deptNombre'),
      fechaMesIni: readTag(block, 'fechaMesIni'),
      insumoNombre,
      muniId: readTag(block, 'muniId'),
      muniNombre: readTag(block, 'muniNombre'),
      promedio: Number(promedio),
      tireId: readTag(block, 'tireId'),
      tireNombre: readTag(block, 'tireNombre'),
    })
  }

  return returns
}

/** Known SIPSA collection types (tireId / arg0). */
export const SIPSA_INSUMO_TIRE_IDS = [4]

export async function fetchSipsaInsumos(tireId, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(SIPSA_SOAP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        Accept: 'application/soap+xml, text/xml, */*',
      },
      body: buildInsumosEnvelope(tireId),
      signal: controller.signal,
    })

    const body = await response.text()

    if (!response.ok) {
      throw new Error(
        `SIPSA SOAP insumos error ${response.status}${body ? `: ${body.slice(0, 200)}` : ''}`
      )
    }

    return parseInsumosXml(body)
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`SIPSA SOAP insumos timed out (${timeoutMs}ms)`)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchAllSipsaInsumos(options = {}) {
  const tireIds = options.tireIds ?? SIPSA_INSUMO_TIRE_IDS
  const allRows = []
  const seen = new Set()

  for (const tireId of tireIds) {
    const rows = await fetchSipsaInsumos(tireId, options)
    for (const row of rows) {
      const key = `${row.insumoNombre}:${row.muniId}:${row.fechaMesIni}:${row.tireId}`
      if (seen.has(key)) continue
      seen.add(key)
      allRows.push(row)
    }
  }

  return allRows
}

export const TRACKED_INSUMO_MUNICIPALITIES = [
  { label: 'Medellín', municipality_code: '05001' },
  { label: 'Bogotá', municipality_code: '11001' },
]

export function normalizeMunicipalityCode(muniId) {
  if (!muniId) return null
  const digits = String(muniId).replace(/\D/g, '')
  if (digits.length >= 5) return digits.slice(-5).padStart(5, '0')
  return digits.padStart(5, '0')
}
