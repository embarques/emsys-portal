# Playwright Integration Tests

End-to-end integration tests for the EMSYS portal. Tests run against a dedicated Next.js dev server on **port 3100** with **EMSYS API dev-session auth** (`POST /auth/token`) and live API requests through the **`/api/proxy`** dev proxy.

---

## ⚠️ Daily Income not opening in the UI?

Daily Income opens when you run a test under **`chromium`** (e.g. `opens the route in a workspace tab` or `registers an invoice transaction`). Auth runs automatically in **`global-setup.ts`** before any test — you will not see a separate login test in the sidebar.

| Step | What happens |
|------|----------------|
| `global-setup` | Mints EMSYS API dev session → saves `playwright/.auth/user.json` |
| `chromium` tests | Reuse saved session → navigate to Daily Income |

---

## Quick start (Playwright UI — recommended)

Most local runs use **Playwright UI** so you can watch the browser, step through failures, and open traces.

From the repository root:

```bash
# Daily income tests (opens Playwright UI)
npm run test:integration:accounting:daily-income:ui
```

All integration tests in UI mode:

```bash
npm run test:integration:ui
```

### What you see in the UI

The left sidebar lists tests under the **`chromium`** project (12 daily income tests: page load, auth headers, workspace tab, register invoice, 8 transaction types).

Auth runs once in **`global-setup.ts`** before tests start (not visible as a sidebar test). If global setup fails, check the terminal for `POST /auth/token` errors.

### Typical UI workflow

1. Run `npm run test:integration:accounting:daily-income:ui`
2. Wait for Playwright UI to open in the browser
3. Click **Run all** (or pick a test under **chromium**)
4. Watch the test browser on the right — the first run logs in via global setup, then tests open Daily Income
5. On failure: click the test → **Trace**, **Screenshot**, or **Video** tabs (terminal runs only; UI disables heavy artifacts)

Run a single test (e.g. register invoice):

1. Open UI with the command above
2. Filter or find `registers an invoice transaction` under **chromium**
3. Click the ▶ button on that test only

### Terminal alternative

If you prefer CLI output instead of the UI:

```bash
npm run test:integration:accounting:daily-income
```

List tests without running:

```bash
npx playwright test tests/integration/accounting/daily-income --list
```
Other useful commands:

```bash
npm run test:integration                              # all integration tests
npm run test:integration:accounting                   # all accounting tests
npm run test:integration:accounting:accounts          # chart of accounts only
npm run test:integration:accounting:daily-income:transactions   # all 8 transaction types
npm run test:integration:accounting:daily-income:transaction:register-invoice  # one type
```

---

## Prerequisites

### 1. Test credentials (`.env.local`)

Copy the example file if you do not have one yet:

```bash
cp .env.local.example .env.local
```

Set a dedicated test account (never commit real credentials):

```env
PLAYWRIGHT_TEST_EMAIL=your-test-user@example.com
PLAYWRIGHT_TEST_PASSWORD=your-test-password
PLAYWRIGHT_TEST_COMPANY_ID=your-emsys-company-id
```

The test user must:

- Exist in Firebase Authentication (email/password provider) — used by `POST /auth/token`
- Have access in the EMSYS API for `PLAYWRIGHT_TEST_COMPANY_ID` (roles, permissions for the pages under test)

### 2. Daily Income branch and closeout behavior

Daily income tests pick the **date automatically** (today, then walk back up to 14 days). They **create** a closeout when the page shows “No closeout for this date”, **reuse** one when the API returns **HTTP 409** (already exists), or **reopen** a CLOSED one.

Pin the branch in `.env.local`:

```env
PLAYWRIGHT_DAILY_INCOME_BRANCH=NY
```

| Variable | Meaning |
|----------|---------|
| `PLAYWRIGHT_TEST_COMPANY_ID` | EMSYS company id sent as `x-company-id` on every API request (**required**) |
| `PLAYWRIGHT_DAILY_INCOME_BRANCH` | Branch **code** from the Daily Income dropdown (e.g. `NY`, `RD`), not the full label |
| `PLAYWRIGHT_DAILY_INCOME_DATE` | *(Optional, debug only)* Force a specific ISO date — normally leave unset |
| `PLAYWRIGHT_DAILY_INCOME_INVOICE_NUMBER` | *(Optional)* Pin a specific invoice in the register-invoice wizard |

**Permissions:** The test user needs API permission to **create**, **search**, and **reopen** daily income closeouts, and to **create journals** for transaction tests.

Why dev and Playwright differ:

| | Normal dev (`npm run dev`, port 3000) | Playwright (port 3100) |
|--|----------------------------------------|-------------------------|
| Auth | Often manual dev session in `.env.local` | Auto dev session from `PLAYWRIGHT_TEST_*` |
| API path | Browser → `/api/proxy/…` → EMSYS API | Same proxy path |
| Build dir | `.next` | `.next-playwright` |

If create fails with **HTTP 403**, see [Closeout API responses](#closeout-api-responses) below — curl with `Authorization: Bearer` often proves permissions are fine and the browser hit a timing issue.

### 3. Firebase config (`.env`) — optional for Playwright

Playwright uses `POST /auth/token`, not the Firebase client login page. Firebase env vars are still loaded by Next.js but are not required for the integration test auth path unless you change the auth setup.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### 4. API base URL (`.env`)

Tests hit the configured EMSYS API:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.embarqueros.com/v1
```

For a local API during manual dev, use `npm run dev:local`. Playwright starts its own server and uses whatever is in `.env` unless you override env when running tests.

### 5. Browser binary

The `pretest:integration` script installs Chromium automatically:

```bash
npx playwright install chromium
```

---

## How authentication works

Auth runs once per test run in **`global-setup.ts`** (before any spec). All tests use the **`chromium`** project with a saved session.

| Step | File | Purpose |
|------|------|---------|
| Global setup | `tests/integration/global-setup.ts` | Mint EMSYS API token and save session |
| Tests | `*.spec.ts` under `chromium` | Reuse saved session for every test |

### Auth setup flow

1. **Global setup** calls `POST /auth/token` with `PLAYWRIGHT_TEST_EMAIL` / `PLAYWRIGHT_TEST_PASSWORD`
2. Stores the token and `PLAYWRIGHT_TEST_COMPANY_ID` in `sessionStorage` (`emsys:dev-session`)
3. Waits for `GET /users/permissions` to return **200** with `x-company-id`
4. Saves browser state to `playwright/.auth/user.json` (including `sessionStorage`)

### Test run flow

1. **`chromium`** tests load `storageState: playwright/.auth/user.json`
2. `gotoWorkspace()` injects the dev session before navigation and waits for permissions **200**
3. Browser API calls go to `http://127.0.0.1:3100/api/proxy/…` with `Authorization: Bearer <token>` and `x-company-id`

### Dev bypass is enabled for tests

Playwright sets `NEXT_PUBLIC_BYPASS_AUTH=true` and maps `PLAYWRIGHT_TEST_*` → `NEXT_PUBLIC_DEV_*` when starting its dev server. This matches local dev-session login, not the Firebase `/login` page.

---

## Dev server used by Playwright

Playwright does **not** use your `npm run dev` server on port 3000. It starts its own instance:

| Setting              | Value                          |
|----------------------|--------------------------------|
| URL                  | `http://127.0.0.1:3100`        |
| Command              | `npx next dev -H 127.0.0.1 -p 3100` |
| Build output         | `.next-playwright/`            |
| Auth env             | `NEXT_PUBLIC_BYPASS_AUTH=true` + `PLAYWRIGHT_TEST_*` → `NEXT_PUBLIC_DEV_*` |
| API in browser       | `/api/proxy/*` → `NEXT_PUBLIC_API_BASE_URL` (see `next.config.js`) |
| Reuse existing server| `PLAYWRIGHT_REUSE_SERVER=true` to reuse port 3100; otherwise Playwright starts fresh |

You do not need to run `npm run dev` in another terminal before integration tests.

### Browser vs curl (debugging API failures)

| | Playwright / browser | Copy-paste curl from test output |
|--|----------------------|----------------------------------|
| URL | `http://127.0.0.1:3100/api/proxy/income-statements` | `https://api.embarqueros.com/v1/income-statements` (direct API) |
| Headers | Added by Axios from dev session | Must include `Authorization: Bearer …` and `x-company-id` |

Both paths hit the same EMSYS API when headers are correct. If **curl works** but the test logged **HTTP 403**, the API permissions are usually fine — see [Closeout API responses](#closeout-api-responses).

---

## Manual verification (same conditions as Playwright)

Use this to reproduce what the tests see **before** debugging Playwright itself.

### Steps

1. **Set credentials** in `.env.local`:

   ```env
   PLAYWRIGHT_TEST_EMAIL=your-test-user@example.com
   PLAYWRIGHT_TEST_PASSWORD=your-password
   PLAYWRIGHT_TEST_COMPANY_ID=your-company-id
   PLAYWRIGHT_DAILY_INCOME_BRANCH=NY
   ```

2. **Free port 3100** (if needed):

   ```bash
   lsof -ti :3100 | xargs kill -9
   ```

3. **Start the Playwright-equivalent server** (from repo root):

   ```bash
   NEXT_PUBLIC_BYPASS_AUTH=true \
   NEXT_PUBLIC_DEV_EMAIL="$PLAYWRIGHT_TEST_EMAIL" \
   NEXT_PUBLIC_DEV_PASSWORD="$PLAYWRIGHT_TEST_PASSWORD" \
   NEXT_PUBLIC_DEV_COMPANY_ID="$PLAYWRIGHT_TEST_COMPANY_ID" \
   NEXT_DIST_DIR=.next-playwright \
   npx next dev -H 127.0.0.1 -p 3100
   ```

4. Open [http://127.0.0.1:3100](http://127.0.0.1:3100) — dev session should auto-login (or use Dev session login with the same credentials).

5. **Open Daily Income** — sidebar **Accounting → Daily Income**.

6. **Verify the closeout**:
   - Branch and date match your env vars (or today + pinned branch).
   - Status badge shows **`OPEN · #…`**.
   - **Add transaction** is enabled.

7. **Optional — Network tab**:
   - `POST …/api/proxy/income-statements/search` → **200**
   - `Authorization: Bearer …` and `x-company-id` on every EMSYS request

Re-run the test:

```bash
npm run test:integration:accounting:daily-income -- --grep "registers an invoice"
```

Watch `[playwright:auth]`, `[playwright:daily-income]`, and `[playwright:api]` in the terminal.

---

## Available test suites

Tests target the **desktop workspace tab UI** (`?tab=N` URLs, tab bar, keep-alive panels). Helpers live in `tests/integration/workspace.fixture.ts`.

| Script | Spec file | What it covers |
|--------|-----------|----------------|
| `test:integration:accounting:daily-income` | `tests/integration/accounting/daily-income*.spec.ts` | Daily Income page, auth headers, closeout UI, register-invoice flow |
| `test:integration:accounting:daily-income:transactions` | `daily-income-transaction-types.spec.ts` | All 8 transaction types (form + submit) |
| `test:integration:accounting:daily-income:transaction:*` | same | One transaction type per npm script (see [Transaction type tests](#transaction-type-tests-one-per-journal-type)) |
| `test:integration:accounting:accounts` | `chart-of-accounts.spec.ts` | Chart of Accounts list, create/delete account via API |
| `test:integration:accounting` | both accounting specs | All accounting integration tests |
| `test:integration` | all specs under `tests/integration/` | Full integration suite |

---

## Running specific tests

### In Playwright UI (recommended)

```bash
# All daily income tests (cleans stale artifacts, single worker)
npm run test:integration:accounting:daily-income:ui

# Register invoice only
npm run test:integration:accounting:daily-income:register-invoice:ui
```

These scripts run `clean:playwright:ui` first and use `--workers=1` so trace/video zip files do not corrupt the UI viewer.

```bash
# Everything in UI mode
npm run test:integration:ui
```

In the UI sidebar, run individual tests under **chromium** with the ▶ button. Use the filter box to find tests by name (e.g. `register invoice`).

### In the terminal

```bash
# One test by title (grep)
npx playwright test tests/integration/accounting/daily-income -g "registers an invoice"

# Headed browser (watch without the UI app)
npm run test:integration:accounting:daily-income -- --headed

# Step-through debugger
npm run test:integration:accounting:daily-income -- --debug
```

---

## Reports and failure artifacts

On failure, Playwright retains:

- **Screenshots** — `test-results/`
- **Videos** — `test-results/`
- **Traces** — `test-results/` (open with `npx playwright show-trace <path-to-trace.zip>`)

HTML report:

```bash
npx playwright show-report
```

Report output directory: `playwright-report/` (gitignored).

---

## Troubleshooting

### Closeout API responses

When creating a daily income closeout (`POST /income-statements`), the EMSYS API returns:

| HTTP | Meaning | What the test does |
|------|---------|-------------------|
| **201** | Created | Continues with **OPEN · #…** badge |
| **409** | Already exists for branch + date | **Valid** — cancels dialog, refreshes date picker, loads existing closeout (reopens if CLOSED) |
| **403** | Forbidden (often auth not ready yet in browser) | Retries other dates/branches; use curl from output to verify permissions |
| **401** | Missing/invalid bearer | Check dev session / `PLAYWRIGHT_TEST_*` credentials |

Example **409** body (expected when you already created the closeout manually or in a prior run):

```json
{
  "success": false,
  "message": "Request failed",
  "error": "income statement already exists for this branch and date. Suggested solution: Resolve the reported conflict and try again."
}
```

If curl with `Authorization: Bearer` succeeds on the same payload, permissions are fine — the UI may have shown “No closeout for this date” before the search finished, and the test now recovers from **409** automatically.

**Reference numbers** in transaction tests must stay ≤ 20 characters (`PW-NY-1730000000000` format).

### Transaction type tests (one per journal type)

`daily-income-transaction-types.spec.ts` runs **eight separate tests** — one for each transaction type in the Add transaction wizard:

| Slug | Transaction type |
|------|------------------|
| `register-invoice` | Register invoice |
| `register-payment` | Register payment |
| `register-expense` | Register expense |
| `register-income` | Register income |
| `apply-discount` | Apply discount |
| `apply-surcharge` | Apply surcharge |
| `transfer-account` | Transfer account |
| `register-loan` | Register loan |

Each test title includes the slug in brackets (e.g. `[register-invoice] fills form and submits journal transaction`) so you can run them independently.

**Run all transaction-type tests**

```bash
npm run test:integration:accounting:daily-income:transactions
```

**Run a single transaction type**

```bash
npm run test:integration:accounting:daily-income:transaction:register-invoice
npm run test:integration:accounting:daily-income:transaction:register-payment
# … or any other script from package.json

# Generic --grep (works for any slug):
npx playwright test tests/integration/accounting/daily-income-transaction-types.spec.ts --grep "\[register-expense\]"
```

**Curl on API failure**

When any EMSYS API call fails (e.g. `POST /journals`, `POST /income-statements`), the terminal prints a bordered **COPY CURL** block you can paste directly into your shell. The same command is attached to the Playwright report (`.sh` file under **Attachments** in the HTML report or UI mode).

Curl commands use the **direct API URL** (`https://api.embarqueros.com/v1/…`) with full headers:

```bash
curl -sS -X POST 'https://api.embarqueros.com/v1/income-statements' \
  -H 'Authorization: Bearer eyJhbGci…' \
  -H 'x-company-id: 64d5c0b0d1eab2aaf30b1819' \
  -H 'Content-Type: application/json' \
  --data-raw '{"date":"2026-06-29T00:00:00Z",...}'
```

| Note | Detail |
|------|--------|
| `Authorization` header | Must be `Authorization: Bearer <token>` — not `-H 'Bearer …'` alone |
| Token lifetime | Firebase / dev tokens expire in ~1 hour; re-run the test for a fresh curl |
| Company context | `x-company-id` must match `PLAYWRIGHT_TEST_COMPANY_ID` in `.env.local` |

If curl returns `missing bearer token`, the header must be `Authorization: Bearer <token>` — not `-H 'Bearer …'` alone. Fresh curls from a test run include the correct format.

**409 responses** do not print curl (expected conflict, not a bug).

Account-based types (`register-expense`, `register-income`, `transfer-account`, `register-loan`) skip automatically if chart accounts are not available from the API.

---

### Register invoice transaction test (multi-branch retry)

`daily-income-register-invoice.spec.ts` exercises the full flow:

1. EMSYS API dev session (via `global-setup.ts`)
2. Open Daily Income in a workspace tab
3. Find, create, or reopen an **OPEN** closeout (today, or walk back up to 14 days; **409 → reuse existing**)
4. **Add transaction** → **Register invoice** → fill form → **Save transaction**

**API permissions required** for the Playwright test user:

- Search/create/reopen daily income closeouts (`/income-statements`)
- Create journal entries (`POST /journals`)
- Read employees and invoices for form dropdowns

#### “Unable to find or open an OPEN daily closeout”

The test tried today and the last 14 days on the configured branch (or all branches). Create/reopen was attempted when the page showed “No closeout for this date” or **CLOSED**, but none succeeded.

**Typical causes**

| Symptom | Cause | Fix |
|---------|-------|-----|
| `HTTP 403` on create | Auth not ready in browser, or transient proxy/API issue | Re-run; curl with `Authorization: Bearer` proves permissions are fine |
| `HTTP 409` on create | Closeout **already exists** for that branch/date (valid API response) | Test reloads the date picker and uses the existing closeout; or pick another date |
| Works in dev on port 3000 but not in tests | Different port, build dir, or credentials | Run [manual verification on port 3100](#manual-verification-same-conditions-as-playwright) |

**Steps**

1. Follow [Manual verification](#manual-verification-same-conditions-as-playwright) on port **3100**.
2. Set `PLAYWRIGHT_DAILY_INCOME_BRANCH` in `.env.local` (date is picked by the test).
3. Re-run and read `[playwright:daily-income]` / `[playwright:api]` lines in the terminal.

The error message includes the last HTTP status and whether the forbidden banner appeared on the page.

#### Closeout loads but `POST /journals` returns HTTP 403

The test reaches Daily Income, shows **`OPEN · #…`**, fills the register-invoice wizard, then fails on save.

**Typical causes**

| Symptom | Cause | Fix |
|---------|-------|-----|
| `OPEN closeout loaded` then journal 403 | API rejects journal writes or business rule | Try **Add transaction → Register invoice → Save** on port **3100**; check curl from test output |
| Works on port 3000, fails on 3100 | Different server build or credentials | Use port **3100** with `PLAYWRIGHT_TEST_*` env vars |
| Terminal shows `branch._id` in search body | Stale dev server on port 3100 with old frontend code | Stop anything on 3100 and re-run tests (Playwright starts a fresh server by default). To reuse a server: `PLAYWRIGHT_REUSE_SERVER=true npm run test:integration:...` only after rebuilding |

The terminal logs the full journal request body under `[playwright:api]` when save fails, plus a **COPY CURL** block and an attachment you can paste into your terminal.

Run only this test in the UI:

```bash
npm run test:integration:accounting:daily-income:ui
```

Then filter for `registers an invoice` and click ▶ on that test.

Or in the terminal:

```bash
npm run test:integration:accounting:daily-income -- --grep "registers an invoice"
```

### Tests say "did not run" or global setup fails

Global setup runs before specs. If it fails, no `chromium` tests run.

1. Check the **terminal** (not only the UI) for global setup errors (`POST /auth/token`, permissions timeout).
2. Confirm tests are discovered:
   ```bash
   npx playwright test tests/integration/accounting/daily-income --list
   ```
3. Fix credentials or API reachability (see below).
4. Close a leftover Playwright UI window or process on port 3100 (see below).

### "PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set"

Add both variables to `.env.local` (not only `.env`).

### Auth setup hangs or fails

- Confirm `PLAYWRIGHT_TEST_EMAIL`, `PLAYWRIGHT_TEST_PASSWORD`, and `PLAYWRIGHT_TEST_COMPANY_ID` in `.env.local`
- Confirm `NEXT_PUBLIC_API_BASE_URL` in `.env` is reachable (`POST /auth/token` must return 200)
- Delete cached session and re-run: `rm -rf playwright/.auth/user.json`

### Tests redirect to `/login`

Delete the cached session and re-run so auth setup runs fresh:

```bash
rm -rf playwright/.auth/user.json
npm run test:integration:accounting:daily-income
```

### API / permissions errors

- Check `NEXT_PUBLIC_API_BASE_URL` points at the environment you expect
- Ensure the test user has permissions for the feature (e.g. daily income, chart of accounts)

### Port 3100 already in use

Stop Playwright UI or any process on port 3100:

```bash
lsof -ti :3100 | xargs kill -9
```

Locally, Playwright **reuses** an existing server on port 3100 by default (set `PLAYWRIGHT_REUSE_SERVER=false` to force a fresh start). In CI it always starts fresh.

### UI errors: corrupt zip / “unexpected number of bytes”

This is a **known Playwright UI bug** ([playwright#41351](https://github.com/microsoft/playwright/issues/41351)): login can succeed (dashboard loads) but teardown fails while zipping live traces, so the UI shows a red **X** at **0.0s** with:

- `apiRequestContext._wrapApiCall: file data stream has unexpected number of bytes`
- `End of central directory record signature not found`

**Fix:** always use the npm UI scripts (they set `PLAYWRIGHT_TRACING_NO_WEBSOCKET_FRAMES=1` and clean artifacts), or run manually:

```bash
npm run clean:playwright:ui
PLAYWRIGHT_TRACING_NO_WEBSOCKET_FRAMES=1 npx playwright test --ui --workers=1
```

Do **not** run bare `npx playwright test --ui` without that env var.

`clean:playwright:ui` removes `test-results/`, `playwright-report/`, `blob-report/`, and `playwright/.auth/user.json`, then recreates the auth directory.

UI mode also disables trace/video recording and the HTML reporter in `playwright.config.ts`. Use terminal runs (without `--ui`) for failure screenshots and traces.

---

## Key files

| Path | Role |
|------|------|
| `playwright.config.ts` | Port, web server, global setup, reporters |
| `tests/integration/global-setup.ts` | One-time EMSYS API dev session per run |
| `tests/integration/auth.fixture.ts` | Credentials, `POST /auth/token`, session injection |
| `tests/integration/workspace.fixture.ts` | `gotoWorkspace()`, curl helpers (`Authorization: Bearer`), API response matching |
| `tests/integration/accounting/daily-income.fixture.ts` | Closeout helpers (409 recovery, date walk-back), transaction wizard helpers |
| `playwright/.auth/user.json` | Cached login session (gitignored) |
| `.env.local.example` | Template for `PLAYWRIGHT_TEST_*` and optional closeout vars |

---

## Gitignored artifacts

Do not commit:

- `playwright/.auth/` — saved auth session (may contain tokens)
- `playwright-report/`
- `test-results/`
- `.next-playwright/`
