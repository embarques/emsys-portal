# Atlas Admin - Pulse Style Sidebar Sample

Original Next.js + Tailwind + shadcn-style sample dashboard.

## Run locally

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

## Test from iPhone / another device on your network

The dev command binds Next.js to all interfaces:

```bash
npm run dev
```

Then open your computer LAN IP from your phone, for example:

```txt
http://10.1.5.142:3000
```

If your LAN IP changes, update `allowedDevOrigins` in `next.config.js`.

## Using local API Server

The portal can talk to either the **remote development API** or a **local API** on your machine.

| Command | API target |
|---------|------------|
| `npm run dev` or `npm run dev:remote` | `NEXT_PUBLIC_API_BASE_URL` from `.env` |
| `npm run dev:local` | `http://localhost:8080/v1` (set in script) |

Set the remote API URL in `.env`:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.embarqueros.com/v1
```

Use `npm run dev:local` only when pointing at a local API on port 8080.

### Remote development API (default)

```bash
npm run dev
```

### Local API on port 8080

Start your local EMSYS API first, then:

```bash
npm run dev:local
```

### Direct API calls (no Next.js proxy)

The browser calls `NEXT_PUBLIC_API_BASE_URL` directly (for example `https://api.embarqueros.com/v1/customers`). The EMSYS API must allow the portal origin in CORS (for local dev: `http://localhost:3000`).

### Env files

| File | Purpose |
|------|---------|
| `.env` | Shared config including `NEXT_PUBLIC_API_BASE_URL` for remote/dev API |
| `.env.local` | Personal overrides (dev bypass, credentials) |

Copy `.env.local.example` to `.env.local` if you need local-only auth settings.

Restart the dev server after changing env files.

### API developer docs

| Doc | Purpose |
|-----|---------|
| [`API_PAYLOADS.md`](./API_PAYLOADS.md) | POST/PUT request bodies for every EMSYS endpoint (canonical copy/paste reference) |
| [`API-List-Query.md`](./API-List-Query.md) | GET list query format (`page`, `limit`, `sort`, filters) |
| [`API-Permission.md`](./API-Permission.md) | Route permissions and sidebar gating |

Write payload builders live in `src/lib/api/payloads.ts` and each feature's `src/lib/<feature>/api/*-api.ts` file.

## Included

- Pulse-style sidebar behavior
- Expanded desktop sidebar
- Collapsed icon rail sidebar
- Topbar collapse/expand button placed to the right of the sidebar
- Smaller windows show the icon rail
- Light/dark/system theme toggle
- Search popup menu
- User profile dropdown
- Sample dashboard pages
- Workspace root warning fixed with `turbopack.root`
