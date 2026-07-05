# Playwright Integration Tests

End-to-end integration tests for the EMSYS portal. Tests run against a dedicated Next.js dev server on **port 3100** with **EMSYS API dev-session auth** (`POST /auth/token`) and live API requests through the **`/api/proxy`** dev proxy.

---

## ⚠️ Daily Income not opening in the UI?

Daily Income opens when you run a test under **`chromium`** (e.g. `opens the route in a workspace tab` or `registers an invoice`). Auth runs automatically in **`global-setup.ts`** before any test — you will not see a separate login test in the sidebar. The project currently has **16 integration tests** (chart of accounts + daily income + invoice create).

| Step | What happens |
|------|----------------|
| `global-setup` | Mints EMSYS API dev session → saves `playwright/.auth/user.json` |
| `chromium` tests | Reuse saved session → navigate to Daily Income |

---

## Quick start (Playwright UI — recommended)

Most local runs use **Playwright UI** so you can watch the browser, step through failures, and re-run individual tests.

### Prerequisites

1. Copy credentials into `.env.local` (see [Prerequisites](#prerequisites) below).
2. Install Chromium (runs automatically via `pretest:integration` on first test run):

```bash
npx playwright install chromium
```

### Open Playwright UI

From the repository root:

```bash
# Invoice create wizard (recommended while working on the add-invoice flow)
npm run test:integration:invoices:invoice-create:ui

# Daily income — register invoice
npm run test:integration:accounting:daily-income:register-invoice:ui

# All daily income tests
npm run test:integration:accounting:daily-income:ui

# Full integration suite
npm run test:integration:ui
```

These UI scripts run `clean:playwright:ui` first (clears stale traces and auth cache) and use `--workers=1` so the UI viewer stays stable.

### How to run tests in the UI

1. Run one of the commands above — Playwright UI opens in your browser (usually `http://localhost:9323` or similar).
2. In the **left sidebar**, expand the **`chromium`** project.
3. **Run all tests**: click the ▶ button at the top of the sidebar.
4. **Run one test**: hover a test name → click its ▶ button.
5. **Filter tests**: use the search box (e.g. `creates an invoice`, `register invoice`, `[register-expense]`, `chart of accounts`).
6. **Watch execution**: the browser panel on the right shows each step (login via global setup, then navigation).
7. **On failure**: select the test → open **Trace**, **Screenshot**, or **Video** (terminal runs retain more artifacts than UI mode).

Auth runs once in **`global-setup.ts`** before specs start — you will not see a separate login test in the sidebar. If setup fails, read the **terminal** for `POST /auth/token` errors.

### Create invoice in the UI

```bash
npm run test:integration:invoices:invoice-create:ui
```

In the sidebar, run:

`Invoice create wizard › creates an invoice from the directory, saves to the API, and resets the wizard`

The test verifies:

- Opens **Invoices** and clicks **Add invoice** (desktop workspace tab)
- Completes the **4-step wizard**: details → sender/receiver → line items → preview
- Saves via **`POST /invoices`** (not `/invoices/search`)
- Success toast: **`Invoice "PW-INV-…" was added.`**
- Wizard resets to step 1 with a suggested next invoice number
- Switches back to the Invoices directory tab and finds the new invoice number in search

**Data requirements:** at least one **container** and one **sender** in the API. When `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set, the sender must have a **verified** address (the test tries senders until validation passes).

**Permissions:** the test user needs API permission to **create invoices** (`canCreateInvoice` or equivalent). If `POST /invoices` returns **HTTP 403**, the test **skips** with a clear message (same pattern as daily-income journal tests).

Helpers live in `tests/integration/invoices/invoices.fixture.ts`.

### Register invoice in the UI (Daily Income)

```bash
npm run test:integration:accounting:daily-income:register-invoice:ui
```

In the sidebar, run:

`Daily income register invoice › registers an invoice, shows success toast, and keeps the wizard open for the next entry`

The test verifies:

- OPEN closeout is found or created
- Register invoice wizard (employee, invoice number, cost, amount, balance, payment method)
- Success toast: **`New invoice #xxxx created and payment registered.`**
- Wizard stays open with **employee retained** and invoice fields cleared for the next entry

### Terminal alternative

```bash
# Invoice create wizard (terminal)
npm run test:integration:invoices:invoice-create

# Register invoice — Daily Income (terminal)
npm run test:integration:accounting:daily-income:register-invoice

# All invoice integration tests
npm run test:integration:invoices

# All daily income tests
npm run test:integration:accounting:daily-income

# List tests without running
npx playwright test tests/integration --list
```

Other useful commands:

```bash
npm run test:integration                              # all integration tests
npm run test:integration:invoices:invoice-create:ui   # invoice create in UI
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

### 2b. Invoice create wizard

The invoice create test (`tests/integration/invoices/invoice-create.spec.ts`) exercises the **Invoices** workspace add flow — not Daily Income register-invoice.

| Requirement | Details |
|-------------|---------|
| Containers | At least one container must load in the step-1 picker |
| Senders | At least one active sender; verified address when Google Maps is configured |
| Permissions | **`POST /invoices`** must succeed for the test user (otherwise the spec skips on HTTP 403) |

Run it:

```bash
npm run test:integration:invoices:invoice-create:ui   # UI (recommended)
npm run test:integration:invoices:invoice-create      # terminal
```

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
npm run test:integration:accounting:daily-income:register-invoice
```

Watch `[playwright:auth]`, `[playwright:daily-income]`, and `[playwright:api]` in the terminal.

---

## Available tests (full list)

**15 tests** in the **`chromium`** project (`npx playwright test tests/integration --list`):

### Chart of accounts (`chart-of-accounts.spec.ts`)

| Test | What it covers |
|------|----------------|
| `renders the live paginated chart of accounts directory` | List loads from `GET /chart-accounts` |
| `creates and deletes an account through the authenticated API` | Create + delete via API |
| `opens the route in a workspace tab` | Workspace tab URL and tab bar |

### Daily income — page & auth (`daily-income.spec.ts`)

| Test | What it covers |
|------|----------------|
| `uses bearer authentication for EMSYS API requests` | `Authorization: Bearer` + `x-company-id` on API calls |
| `renders closeout totals and transaction directory only when a closeout exists` | Stat cards / table hidden without closeout |
| `opens the route in a workspace tab` | Daily Income workspace tab |

### Daily income — register invoice (`daily-income-register-invoice.spec.ts`)

| Test | What it covers |
|------|----------------|
| `registers an invoice, shows success toast, and keeps the wizard open for the next entry` | Full register-invoice flow, balance field, success toast, continuous entry |

### Daily income — transaction types (`daily-income-transaction-types.spec.ts`)

One test per journal type (title includes slug in brackets):

| Slug | Test title suffix |
|------|-------------------|
| `register-invoice` | `[register-invoice] fills form and submits journal transaction` |
| `register-payment` | `[register-payment] fills form and submits journal transaction` |
| `register-expense` | `[register-expense] fills form and submits journal transaction` |
| `register-income` | `[register-income] fills form and submits journal transaction` |
| `apply-discount` | `[apply-discount] fills form and submits journal transaction` |
| `apply-surcharge` | `[apply-surcharge] fills form and submits journal transaction` |
| `transfer-account` | `[transfer-account] fills form and submits journal transaction` |
| `register-loan` | `[register-loan] fills form and submits journal transaction` |

### Invoices — create wizard (`invoice-create.spec.ts`)

| Test | What it covers |
|------|----------------|
| `creates an invoice from the directory, saves to the API, and resets the wizard` | Invoices page → **Add invoice** → 4-step wizard → `POST /invoices` → success toast → wizard reset → directory search |

**Spec file:** `tests/integration/invoices/invoice-create.spec.ts`  
**Fixtures:** `tests/integration/invoices/invoices.fixture.ts`

**Wizard steps automated:**

1. **Details** — unique `PW-INV-{timestamp}` number, first available container, pending location (defaults to USA)
2. **Parties** — first sender that passes validation (retries if Google address verification blocks)
3. **Line items** — description, quantity `1`, unit price `10.00`
4. **Preview** — **Save invoice** → wait for `POST /invoices`

On failure, the report attaches a **curl** script to replay the API call (same as daily-income tests).

---

## npm scripts reference

| Script | What runs |
|--------|-----------|
| `test:integration` | All specs under `tests/integration/` |
| `test:integration:ui` | All integration tests in Playwright UI |
| `test:integration:accounting` | All accounting specs |
| `test:integration:accounting:accounts` | Chart of accounts only |
| `test:integration:accounting:daily-income` | All `daily-income*.spec.ts` files |
| `test:integration:accounting:daily-income:ui` | Daily income tests in UI |
| `test:integration:accounting:daily-income:register-invoice` | Register invoice spec (terminal) |
| `test:integration:accounting:daily-income:register-invoice:ui` | Register invoice in UI |
| `test:integration:accounting:daily-income:transactions` | All 8 transaction-type tests |
| `test:integration:accounting:daily-income:transaction:register-invoice` | `[register-invoice]` only |
| `test:integration:accounting:daily-income:transaction:register-invoice:ui` | `[register-invoice]` in UI |
| `test:integration:accounting:daily-income:transaction:register-payment` | `[register-payment]` only |
| `test:integration:accounting:daily-income:transaction:register-expense` | `[register-expense]` only |
| `test:integration:accounting:daily-income:transaction:register-income` | `[register-income]` only |
| `test:integration:accounting:daily-income:transaction:apply-discount` | `[apply-discount]` only |
| `test:integration:accounting:daily-income:transaction:apply-surcharge` | `[apply-surcharge]` only |
| `test:integration:accounting:daily-income:transaction:transfer-account` | `[transfer-account]` only |
| `test:integration:accounting:daily-income:transaction:register-loan` | `[register-loan]` only |
| `test:integration:invoices` | All invoice integration specs |
| `test:integration:invoices:invoice-create` | Invoice create wizard (terminal) |
| `test:integration:invoices:invoice-create:ui` | Invoice create wizard in UI |

### Example executions

```bash
# UI — invoice create wizard
npm run test:integration:invoices:invoice-create:ui

# UI — register invoice (fastest feedback while developing the form)
npm run test:integration:accounting:daily-income:register-invoice:ui

# UI — one transaction type (filter in Playwright UI, or use terminal script)
npm run test:integration:accounting:daily-income:transaction:register-payment

# Terminal — register invoice
npm run test:integration:accounting:daily-income:register-invoice

# Terminal — grep by slug
npx playwright test tests/integration/accounting/daily-income-transaction-types.spec.ts --grep "\[register-payment\]"

# Terminal — grep by words
npx playwright test tests/integration/accounting/daily-income --grep "register invoice"

# Headed browser (no UI app)
npm run test:integration:accounting:daily-income:register-invoice -- --headed

# Step debugger
npm run test:integration:accounting:daily-income:register-invoice -- --debug

# List tests
npx playwright test tests/integration --list
```

---

## Available test suites (summary)

Tests target the **desktop workspace tab UI** (`?tab=N` URLs, tab bar, keep-alive panels). Helpers live in `tests/integration/workspace.fixture.ts`.

| Script | Spec file | What it covers |
|--------|-----------|----------------|
| `test:integration:accounting:daily-income` | `tests/integration/accounting/daily-income*.spec.ts` | Daily Income page, auth, closeout UI, register invoice, transaction types |
| `test:integration:accounting:daily-income:register-invoice` | `daily-income-register-invoice.spec.ts` | Dedicated register-invoice E2E flow |
| `test:integration:accounting:daily-income:transactions` | `daily-income-transaction-types.spec.ts` | All 8 transaction types (form + submit) |
| `test:integration:accounting:daily-income:transaction:*` | same | One transaction type per npm script |
| `test:integration:accounting:accounts` | `chart-of-accounts.spec.ts` | Chart of Accounts list, create/delete |
| `test:integration:invoices:invoice-create` | `invoice-create.spec.ts` | Invoices directory → add wizard → `POST /invoices` |
| `test:integration:invoices` | `tests/integration/invoices/` | All invoice integration tests |
| `test:integration:accounting` | both accounting dirs | All accounting integration tests |
| `test:integration` | all specs under `tests/integration/` | Full integration suite |

---

## Running specific tests

### In Playwright UI (recommended)

```bash
# Invoice create wizard
npm run test:integration:invoices:invoice-create:ui

# Register invoice — Daily Income
npm run test:integration:accounting:daily-income:register-invoice:ui

# All daily income tests
npm run test:integration:accounting:daily-income:ui

# [register-invoice] transaction-type test (shorter than full register-invoice spec)
npm run test:integration:accounting:daily-income:transaction:register-invoice:ui

# Everything in UI mode
npm run test:integration:ui
```

See [How to run tests in the UI](#how-to-run-tests-in-the-ui) for the step-by-step workflow.

These scripts run `clean:playwright:ui` first and use `--workers=1` so trace/video zip files do not corrupt the UI viewer.

In the UI sidebar, run individual tests under **chromium** with the ▶ button. Use the filter box to find tests by name (e.g. `creates an invoice`, `register invoice`, `[register-expense]`).

### In the terminal

```bash
# Invoice create wizard
npm run test:integration:invoices:invoice-create

# Register invoice — Daily Income
npm run test:integration:accounting:daily-income:register-invoice

# One transaction type by slug
npm run test:integration:accounting:daily-income:transaction:register-payment

# One test by title (grep)
npx playwright test tests/integration/invoices/invoice-create.spec.ts -g "creates an invoice"
npx playwright test tests/integration/accounting/daily-income-register-invoice.spec.ts -g "registers an invoice"

# Headed browser (watch without the UI app)
npm run test:integration:invoices:invoice-create -- --headed
npm run test:integration:accounting:daily-income:register-invoice -- --headed

# Step-through debugger
npm run test:integration:invoices:invoice-create -- --debug
npm run test:integration:accounting:daily-income:register-invoice -- --debug
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

### Invoice create (`POST /invoices`)

When the invoice create test saves on step 4, the EMSYS API returns:

| HTTP | Meaning | What the test does |
|------|---------|-------------------|
| **201** / **200** | Created | Asserts success toast, wizard reset, invoice visible in directory search |
| **403** | Forbidden (missing invoice create permission) | **Skips** with message to grant `canCreateInvoice` (or equivalent) |
| **401** | Missing/invalid bearer | Check dev session / `PLAYWRIGHT_TEST_*` credentials |

The test waits for **`POST /invoices`** only (not `POST /invoices/search`). On failure, stdout and the Playwright report include a **curl** command with `Authorization: Bearer` and `x-company-id`.

If the wizard blocks on step 2 with an unverified sender message, pick a sender with a Google-verified address in the app, or run without `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in the Playwright dev server env.

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
4. **Add transaction** → **Register invoice** → fill form (cost, amount, **balance**, payment method) → **Save transaction**
5. Assert toast: **`New invoice #xxxx created and payment registered.`**
6. Assert wizard **stays open** with employee kept and invoice fields cleared (continuous entry)

**API permissions required** for the Playwright test user:

- Search/create/reopen daily income closeouts (`/income-statements`)
- Create journal entries (`POST /journals`)
- Read employees and payment methods for the form

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
npm run test:integration:accounting:daily-income:register-invoice:ui
```

Then filter for `registers an invoice` and click ▶ on that test.

Or in the terminal:

```bash
npm run test:integration:accounting:daily-income:register-invoice
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
