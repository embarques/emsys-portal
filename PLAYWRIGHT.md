# Playwright Integration Tests

End-to-end integration tests for the EMSYS portal. Tests run against a real Next.js dev server with **Firebase authentication** and live **EMSYS API** requests (no auth bypass).

---

## Quick start

From the repository root:

```bash
# Install Chromium (runs automatically via pretest:integration on first npm script)
npm run test:integration:accounting:daily-income
```

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
| Reuse existing server| `false` (always starts fresh)  |

You do not need to run `npm run dev` in another terminal before integration tests.

---

## Available test suites

| Script | Spec file | What it covers |
|--------|-----------|----------------|
| `test:integration:accounting:daily-income` | `tests/integration/accounting/daily-income.spec.ts` | Daily Income page, Firebase headers on API calls, closeout totals and transaction directory |
| `test:integration:accounting:accounts` | `tests/integration/accounting/chart-of-accounts.spec.ts` | Chart of Accounts list, create/delete account via API |
| `test:integration:accounting` | both accounting specs | All accounting integration tests |
| `test:integration` | all specs under `tests/integration/` | Full integration suite |

---

## Running specific tests

```bash
# One test by title (grep)
npx playwright test tests/integration/accounting/daily-income.spec.ts -g "renders live closeout"

# Headed browser (watch the run)
npm run test:integration:accounting:daily-income -- --headed

# Step-through debugger
npm run test:integration:accounting:daily-income -- --debug

# Playwright UI mode
npm run test:integration:accounting:daily-income -- --ui
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

Stop any process bound to port 3100, or change `port` in `playwright.config.ts`.

---

## Key files

| Path | Role |
|------|------|
| `playwright.config.ts` | Port, web server, projects, reporters |
| `tests/integration/auth.setup.ts` | One-time Firebase login per run |
| `tests/integration/auth.fixture.ts` | Credentials helper, sign-in, session path |
| `playwright/.auth/user.json` | Cached login session (gitignored) |
| `.env.local.example` | Template for `PLAYWRIGHT_TEST_*` vars |

---

## Gitignored artifacts

Do not commit:

- `playwright/.auth/` — saved auth session (may contain tokens)
- `playwright-report/`
- `test-results/`
- `.next-playwright/`
