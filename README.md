# agro15

Next.js dashboard starter with [shadcn/ui](https://ui.shadcn.com) and the **dashboard-01** block.

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — the home page redirects to `/dashboard`.

## Theming

The app uses CSS variables for semantic tokens (`background`, `foreground`, `primary`, sidebar, chart colors, etc.) defined in `app/globals.css`.

- **Light / dark / system** — use the theme toggle in the dashboard header, or press `d` to toggle light/dark.
- Tokens are mapped to Tailwind utilities via `@theme inline` (e.g. `bg-background`, `text-foreground`).

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify: **Add new site → Import from Git** and select the repository.
3. Build settings are defined in `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Plugin: `@netlify/plugin-nextjs`
4. Deploy. No environment variables are required for the starter dashboard.

## Deploy to GitHub

```bash
git init
git add .
git commit -m "Initial agro15 dashboard scaffold with shadcn/ui"
gh repo create agro15 --public --source=. --remote=origin
git push -u origin main
```

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start development server |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run lint` | Run ESLint               |
