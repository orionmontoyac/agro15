# agro15

Next.js app for SIPSA wholesale prices (Medellín & Bogotá), insumos, abastecimiento, and SIATA rain in Urrao.

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm
- A Supabase project with migrations applied
- `.env.local` (copy from `.env.example`)

Required for sync scripts:

```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Also set the public Supabase keys for the Next.js app (`NEXT_PUBLIC_SUPABASE_*`).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## App scripts

| Command              | Description                |
| -------------------- | -------------------------- |
| `npm run dev`        | Start development server   |
| `npm run build`      | Production build           |
| `npm run start`      | Start production server    |
| `npm run lint`       | Run ESLint                 |
| `npm run format`     | Format with Prettier       |
| `npm run typecheck`  | TypeScript check           |
| `npm run test:projections` | Run projection unit checks |

## Data sync scripts

All sync commands load env from `.env.local`. Dates are treated as **America/Bogota**.

### Recommended first-time order

```bash
# 1. Catalog (departments, municipalities, products)
npm run sync:sipsa-catalog

# 2. Daily prices (example: Granadilla)
npm run sync:sipsa-prices -- 106 --years 3

# 3. Fill gaps for all tracked products
npm run sync:sipsa-prices-all-update

# 4. Weekly / monthly price aggregates
npm run sync:sipsa-aggregates

# 5. Monthly supply (abastecimiento)
npm run sync:sipsa-supply

# 6. Insumo prices
npm run sync:sipsa-insumos -- --historical

# 6b. UPRA insumo price index
npm run sync:insumo-indice -- --full

# 7. SIATA rain (Urrao station 641)
npm run sync:siata-rain
```

### `sync:sipsa-catalog`

Upserts `sipsa_departments`, `sipsa_municipalities`, and `sipsa_products` for Medellín (`05001`) and Bogotá (`11001`).

```bash
npm run sync:sipsa-catalog
npm run sync:sipsa-catalog -- --offline   # seed Agro15 catalog without SIPSA REST API
```

If `sen.dane.gov.co` is down, online mode retries then falls back to offline seed. Price sync falls back to the DANE daily Excel anexo for Granadilla, Lulo, and Tomate de árbol (`--source excel` to force).

### `sync:sipsa-prices`

Fetches daily wholesale prices for one product in Medellín and Bogotá.

```bash
npm run sync:sipsa-prices -- 106                 # last 30 days
npm run sync:sipsa-prices -- 106 --days 7
npm run sync:sipsa-prices -- 106 --years 3       # last 3 calendar years
npm run sync:sipsa-prices -- 116 --update        # from last stored date → today
npm run sync:sipsa-prices -- 106 --update --source excel   # DANE daily Excel only
npm run sync:sipsa-prices-granadilla             # shorthand for product 106
```

**Sources:** `auto` (default: API, Excel fallback), `api`, `excel`.

**Prerequisite:** catalog rows must exist (`npm run sync:sipsa-catalog`).

Tracked Agro15 product codes:

| Code | Product                  | Excel bulletin |
| ---- | ------------------------ | -------------- |
| 100  | Curuba                   | no             |
| 106  | Granadilla               | yes            |
| 113  | Gulupa                   | no             |
| 116  | Lulo                     | yes            |
| 148  | Tomate de árbol          | yes            |
| 89   | Aguacate Hass            | no             |
| 215  | Fríjol cargamanto rojo   | no             |
| 40   | Fríjol verde cargamanto  | no             |
| 46   | Tomate chonto regional   | no             |

### `sync:sipsa-prices-all-update`

Runs `--update` for every Agro15 product code above.

```bash
npm run sync:sipsa-prices-all-update
npm run sync:sipsa-prices-all-update -- --source excel
```

### `sync:sipsa-aggregates`

Syncs weekly and/or monthly price aggregates for all tracked products.

```bash
npm run sync:sipsa-aggregates            # week + month
npm run sync:sipsa-aggregates -- week
npm run sync:sipsa-aggregates -- month
```

### `sync:sipsa-supply`

Syncs monthly abastecimiento (supply volumes) via SIPSA SOAP (`appweb.dane.gov.co`).

```bash
npm run sync:sipsa-supply
```

### `sync:sipsa-insumos`

Syncs SIPSA-I insumo prices from DANE XLSX files (Medellín & Bogotá).

```bash
npm run sync:sipsa-insumos                       # latest monthly bulletin
npm run sync:sipsa-insumos -- --historical       # full 2021–2026 series (large)
npm run sync:sipsa-insumos -- --try-soap         # also try legacy SOAP API
```

### `sync:insumo-indice`

Syncs two UPRA price indices (base ene-2021 = 100) from datos.gov.co into `insumo_precio_indice`:

- [`gwbi-fnzs`](https://www.datos.gov.co/d/gwbi-fnzs): Índice de precios de insumos agrícolas (fertilizantes, plaguicidas, otros; 57 series)
- [`wgj6-cvyj`](https://www.datos.gov.co/d/wgj6-cvyj): Índice de precios de alimentos balanceados para animales (ABA; total + acuicultura, avicultura, bovinos, porcicultura; `categoria = alimentos_balanceados`)

The `/insumos` page reads the whole table server-side and shows group summary cards, a per-group chart, and a product table. By default it re-fetches from 3 months before the latest stored month, because UPRA revises recent months.

```bash
npm run sync:insumo-indice             # incremental
npm run sync:insumo-indice -- --full   # full series since 2018-12
npm run seed:insumo-indice -- path.csv # offline fallback from a CSV export
```

Optional: `SOCRATA_APP_TOKEN` raises the datos.gov.co rate limits.

### `sync:siata-rain`

Syncs daily (and related) rain for Urrao SIATA station `641`. Future Bogotá calendar days from SIATA are skipped.

```bash
npm run sync:siata-rain
npm run sync:siata-rain -- 641    # explicit station code (default 641)
```

### `probe:sipsa-soap`

Quick connectivity check against the SIPSA SOAP abastecimiento endpoint (no Supabase write).

```bash
npm run probe:sipsa-soap
```

## Optional env vars

See `.env.example` for the full list. Common overrides:

| Variable | Purpose |
| -------- | ------- |
| `SIPSA_BASE_URL` | SIPSA REST base (prices / catalog) |
| `SIPSA_FETCH_TIMEOUT_MS` | REST timeout (default `60000`) |
| `SIPSA_FETCH_RETRIES` | REST retries (default `4`) |
| `SIPSA_SOAP_URL` | SOAP endpoint (supply / insumos probe) |
| `SOCRATA_APP_TOKEN` | Optional datos.gov.co app token (insumo index sync) |
| `CRON_SECRET` | Protect Netlify scheduled / edge sync endpoints |

## Netlify scheduled syncs

Configured for production (see `.env.example` comments):

- SIPSA prices — 2× daily
- SIPSA aggregates — daily check
- SIPSA supply — on the 11th monthly
- SIPSA insumos — on the 12th monthly
- UPRA insumo + ABA price indices — weekly (Monday 12:00 UTC)
- SIATA rain — every 6 hours

Optional edge endpoint: `POST /api/siata-rain/sync` (may require `CRON_SECRET`).

## Troubleshooting

| Symptom | What to try |
| ------- | ----------- |
| `Product … not found in Supabase` | `npm run sync:sipsa-catalog` (or `--offline`) |
| `SIPSA host unreachable` / `other side closed` | `sen.dane.gov.co` is down; retry later. Catalog can use `--offline`. |
| Rain chart shows a future day | Re-sync rain; display already clamps to Bogotá today. |
| Empty rain page | `npm run sync:siata-rain` |

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from Git**.
3. Build settings are in `netlify.toml` (`npm run build`, publish `.next`, `@netlify/plugin-nextjs`).
4. Set Supabase env vars in the Netlify UI (public + service role for scheduled functions).
