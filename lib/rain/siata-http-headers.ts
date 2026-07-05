/** Browser-like headers for SIATA HTTP calls (Geoportal + capa_service). */

export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"

/** Postman default — swap User-Agent if you want to mimic Postman instead. */
export const POSTMAN_USER_AGENT = "PostmanRuntime/7.44.0"

const SHARED_BROWSER_HEADERS = {
  "Accept-Language": "es-CO,es;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "User-Agent": BROWSER_USER_AGENT,
  Connection: "keep-alive",
} as const

export function geoportalRainHeaders(): HeadersInit {
  return {
    ...SHARED_BROWSER_HEADERS,
    Accept: "application/json, text/plain, */*",
    Origin: "https://geoportal.siata.gov.co",
    Referer: "https://geoportal.siata.gov.co/",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  }
}

export function siataLayerHeaders(): HeadersInit {
  return {
    ...SHARED_BROWSER_HEADERS,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Origin: "https://siata.gov.co",
    Referer: "https://siata.gov.co/siata_nuevo/",
    "X-Requested-With": "XMLHttpRequest",
  }
}
