# Playwright Integration Tests

End-to-end integration tests for the EMSYS portal. Tests run against a real Next.js dev server with **Firebase authentication** and live **EMSYS API** requests (no auth bypass).

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

The left sidebar lists **two projects**:

| Project      | What it is |
|--------------|------------|
| `auth-setup` | Logs into Firebase once (`authenticate with Firebase`) |
| `chromium`   | All real tests — reuses the saved session |

For daily income you should see **5 tests** total:

| Project      | Tests |
|--------------|-------|
| `auth-setup` | 1 |
| `chromium`   | 4 (page load, auth headers, workspace tab, register invoice) |

Expand **`chromium`** in the sidebar — that is where the daily income specs live. They do not run until **`auth-setup`** passes.

### Typical UI workflow

1. Run `npm run test:integration:accounting:daily-income:ui`
2. Wait for Playwright UI to open in the browser
3. Click **Run all** (or run `auth-setup` first, then `chromium`)
4. Watch the test browser on the right — login happens during `auth-setup`
5. On failure: click the test → **Trace**, **Screenshot**, or **Video** tabs

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

**Why you might only see `auth-setup` running:** The `chromium` project depends on `auth-setup`. Playwright always runs login first. In the UI you may only watch the login browser until auth completes. If auth fails or hangs, `chromium` tests show as **did not run** — expand the project in the sidebar to confirm they are listed.

Other useful commands:

```bash
npm run test:integration                              # all integration tests
npm run test:integration:accounting                   # all accounting tests
npm run test:integration:accounting:accounts          # chart of accounts only
```

---

## Prerequisites

### 1. Test credentials (`.env.local`)

Copy the example file if you do not have one yet:

```bash
cp .env.local.example .env.local
```

Set a dedicated Firebase test account (never commit real credentials):

```env
PLAYWRIGHT_TEST_EMAIL=your-test-user@example.com
PLAYWRIGHT_TEST_PASSWORD=your-test-password
```

The test user must:

- Exist in Firebase Authentication (email/password provider)
- Have access in the EMSYS API (company, roles, permissions for the pages under test)

### 2. Firebase config (`.env`)

Playwright loads env via `loadEnvConfig` in `playwright.config.ts`. Required Firebase variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### 3. API base URL (`.env`)

Tests hit the configured EMSYS API:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.embarqueros.com/v1
```

For a local API during manual dev, use `npm run dev:local`. Playwright starts its own server and uses whatever is in `.env` unless you override env when running tests.

### 4. Browser binary

The `pretest:integration` script installs Chromium automatically:

```bash
npx playwright install chromium
```

---

## How authentication works

Playwright runs in **two projects** (see `playwright.config.ts`):

| Project       | File                         | Purpose                                      |
|---------------|------------------------------|----------------------------------------------|
| `auth-setup`  | `tests/integration/auth.setup.ts` | Log in once through `/login`            |
| `chromium`    | all other `*.spec.ts` files  | Reuse saved session for every test             |

### Auth setup flow

1. **`auth-setup`** opens `/login`
2. Fills `PLAYWRIGHT_TEST_EMAIL` and `PLAYWRIGHT_TEST_PASSWORD` from `.env.local`
3. Signs in through **real Firebase** (same as a user in the browser)
4. Saves browser state to `playwright/.auth/user.json`

### Test run flow

1. **`chromium`** tests load `storageState: playwright/.auth/user.json`
2. Each spec navigates to its page and calls `ensureAuthenticated()` to confirm the session is still valid
3. API requests include `Authorization: Bearer <firebase-jwt>` and `x-company-id` (asserted in daily-income tests)

### Auth bypass is disabled for tests

Normal local dev may use `NEXT_PUBLIC_BYPASS_AUTH=true` in `.env.local`. Playwright **forces** `NEXT_PUBLIC_BYPASS_AUTH=false` when starting its dev server so tests exercise the real login path.

---

## Dev server used by Playwright

Playwright does **not** use your `npm run dev` server on port 3000. It starts its own instance:

| Setting              | Value                          |
|----------------------|--------------------------------|
| URL                  | `http://127.0.0.1:3100`        |
| Command              | `npx next dev -H 127.0.0.1 -p 3100` |
| Build output         | `.next-playwright/`            |
| Reuse existing server| `true` locally, `false` in CI — reuses port 3100 if already running (e.g. Playwright UI) |

You do not need to run `npm run dev` in another terminal before integration tests.

---

## Available test suites

Tests target the **desktop workspace tab UI** (`?tab=N` URLs, tab bar, keep-alive panels). Helpers live in `tests/integration/workspace.fixture.ts`.

| Script | Spec file | What it covers |
|--------|-----------|----------------|
| `test:integration:accounting:daily-income` | `tests/integration/accounting/daily-income*.spec.ts` | Daily Income page, auth headers, closeout UI, register-invoice transaction flow |
| `test:integration:accounting:accounts` | `tests/integration/accounting/chart-of-accounts.spec.ts` | Chart of Accounts list, create/delete account via API |
| `test:integration:accounting` | both accounting specs | All accounting integration tests |
| `test:integration` | all specs under `tests/integration/` | Full integration suite |

---

## Running specific tests

### In Playwright UI (recommended)

```bash
# Daily income suite
npm run test:integration:accounting:daily-income:ui

# Everything
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

### Register invoice transaction test

`daily-income-register-invoice.spec.ts` exercises the full flow:

1. Firebase login (via `auth-setup`)
2. Open Daily Income in a workspace tab
3. Create or reopen an **OPEN** closeout (today, or walk back up to 14 days)
4. **Add transaction** → **Register invoice** → fill form → **Save transaction**

**API permissions required** for the Playwright test user:

- Search/create/reopen daily income closeouts (`/income-statements`)
- Create journal entries (`POST /journals`)
- Read employees and invoices for form dropdowns

If the test fails with “Unable to find or open a daily closeout”, grant the test user daily income create/reopen permissions or ensure an OPEN closeout exists for the default branch.

Run only this test in the UI:

```bash
npm run test:integration:accounting:daily-income:ui
```

Then filter for `registers an invoice` and click ▶ on that test.

Or in the terminal:

```bash
npm run test:integration:accounting:daily-income -- --grep "registers an invoice"
```

### Only `auth-setup` runs; income tests say "did not run"

This is expected when auth setup fails or never finishes. The daily income tests are in the **`chromium`** project and only run after `authenticate with Firebase` passes.

1. In Playwright UI, expand **chromium** in the sidebar — the tests should be listed even if they did not run yet.
2. Confirm all tests are discovered:
   ```bash
   npx playwright test tests/integration/accounting/daily-income --list
   ```
3. If auth fails, fix credentials or Firebase config (see below).
4. If auth hangs on `/login`, check `PLAYWRIGHT_TEST_EMAIL` / `PLAYWRIGHT_TEST_PASSWORD` in `.env.local`.
5. Close a leftover Playwright UI window or process on port 3100 (see below).

### "PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD must be set"

Add both variables to `.env.local` (not only `.env`).

### Auth setup hangs or fails on login

- Confirm the test user exists in Firebase and the password is correct
- Confirm Firebase env vars in `.env` match your Firebase project
- Confirm the user has EMSYS API access for the company under test

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

Locally, `playwright.config.ts` sets `reuseExistingServer: true` so a server already on 3100 can be reused. In CI it always starts fresh.

---

## Key files

| Path | Role |
|------|------|
| `playwright.config.ts` | Port, web server, projects, reporters |
| `tests/integration/auth.setup.ts` | One-time Firebase login per run |
| `tests/integration/auth.fixture.ts` | Credentials helper, sign-in, session path |
| `tests/integration/workspace.fixture.ts` | `gotoWorkspace()`, tab URL waits, `workspaceMain()` scoping |
| `tests/integration/accounting/daily-income.fixture.ts` | Closeout helpers and register-invoice wizard form helpers |
| `playwright/.auth/user.json` | Cached login session (gitignored) |
| `.env.local.example` | Template for `PLAYWRIGHT_TEST_*` vars |

---

## Gitignored artifacts

Do not commit:

- `playwright/.auth/` — saved auth session (may contain tokens)
- `playwright-report/`
- `test-results/`
- `.next-playwright/`
