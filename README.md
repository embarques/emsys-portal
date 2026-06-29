# EMSYS Portal

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

## Playwright integration tests

End-to-end tests use **real Firebase login** and the **live EMSYS API** (no auth bypass). Full documentation:

**[PLAYWRIGHT.md](./PLAYWRIGHT.md)**

### Run tests

```bash
# Playwright UI (recommended)
npm run test:integration:accounting:daily-income:ui

# Terminal
npm run test:integration:accounting:daily-income
```

Set `PLAYWRIGHT_TEST_EMAIL` and `PLAYWRIGHT_TEST_PASSWORD` in `.env.local` (see `.env.local.example`).

### Manual verification (same conditions as Playwright)

Use this when a test fails but you want to confirm the app works with the **same auth path** Playwright uses.

Playwright does **not** use `npm run dev` on port 3000. It starts its own server on **port 3100** with `NEXT_PUBLIC_BYPASS_AUTH=false`.

1. **Configure credentials** in `.env.local`:

   ```env
   PLAYWRIGHT_TEST_EMAIL=your-test-user@example.com
   PLAYWRIGHT_TEST_PASSWORD=your-password
   ```

   Optional — pin Daily Income branch (date is picked automatically by the test):

   ```env
   PLAYWRIGHT_DAILY_INCOME_BRANCH=NY
   ```

2. **Stop anything on port 3100** (Playwright UI, a previous manual run):

   ```bash
   lsof -ti :3100 | xargs kill -9
   ```

3. **Start the Playwright-equivalent dev server**:

   ```bash
   NEXT_PUBLIC_BYPASS_AUTH=false NEXT_DIST_DIR=.next-playwright npx next dev -H 127.0.0.1 -p 3100
   ```

4. **Open** [http://127.0.0.1:3100/login](http://127.0.0.1:3100/login) and sign in with `PLAYWRIGHT_TEST_EMAIL` / `PLAYWRIGHT_TEST_PASSWORD` (real Firebase login — not dev bypass).

5. **Open Daily Income**: Accounting → Daily Income (or [http://127.0.0.1:3100/accounting/daily-income](http://127.0.0.1:3100/accounting/daily-income)).

6. **Confirm the closeout** — branch/date should show a green **`OPEN · #…`** badge (e.g. `OPEN · #32571`). **Add transaction** should be enabled.

| Session | Port | Auth | Same as Playwright? |
|---------|------|------|---------------------|
| `npm run dev` + bypass in `.env.local` | 3000 (or custom) | Dev session / auto-login | No |
| Manual Firebase login on port 3100 | 3100 | Firebase JWT | **Yes** |

If Daily Income works manually on port 3100 but the test still fails, check the terminal for `[playwright:api]` lines (HTTP status, `x-company-id`, response body). See [PLAYWRIGHT.md](./PLAYWRIGHT.md) troubleshooting.

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
