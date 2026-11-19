# Responsibility contract integration — 2026-11-18

This Portal change addresses the local audit against API PR
[#388](https://github.com/embarques/emsys-api/pull/388). The API PR remains a draft;
this Portal delivery does not merge or deploy the API or seed existing tenants.

## Behavior

- Invoice creation and INITIAL-PAYMENT use `canAssignInvoiceResponsibility` on
  `invoice_responsibility`. Later payments and adjustments use
  `canAssignPaymentResponsibility` on `payment_responsibility`. Broader route or
  employee-management grants are not substitutes.
- Without the corresponding grant, the form offers Me and eligible routes for
  which an exact linked employee is the sole responsible supervisor. Membership
  alone does not qualify. If the employee link cannot be read, the safe Me option
  remains available; the API resolves and validates that default on submission.
- Self is omitted from the wire instead of guessed from name/email or the first
  employee page. Exact employee-link display queries are bounded and reject
  inactive/ambiguous links. New invoices can explicitly choose Me. Existing
  invoices without assignment authority retain their recorded responsibility.
- Desktop and mobile initial-payment forms use invoice step 1's responsibility.
  The posting response supplies the committed party for the final invoice write;
  this responsibility is locked after registration. Completion reuses that
  response without another employee/route directory lookup. Later PAYMENT does
  not copy the invoice party.
- Scoped operators use the exact-number payment reference endpoint
  `GET /journals/payment-invoice/lookup`. It is company-scoped and returns only
  reference/totals. Users with company-wide invoice-view access retain their
  existing full invoice search, including customer name/phone. Adjustments retain
  ordinary invoice access. Keys include company, actor, grants and number, and
  lookup cancellation is propagated.
- Until the new endpoint is deployed, an unavailable endpoint falls back to
  existing scoped search with a notice. An authorization error never triggers
  fallback. The extra path segment avoids matching an older `/journals/:id`
  route. Missing invoices and duplicate numbers are handled distinctly.
- Employee-link and lookup failures have English/Spanish recovery guidance.
  Drafts, duplicate-submit protection, financial caps, and unchanged-edit saves
  retain their existing behavior.

## Validation

Passed locally:

- `npm run build` (host context; sandbox Turbopack worker creation was denied).
- `npx tsc --noEmit --incremental false`.
- `npm run lint`: zero errors; existing warnings remain.
- Focused policy, payload, employee-link, assignment, journal-account and payment
  account tests: **74 passed**.
- Isolated form keyboard navigation and responsibility browser tests:
  **16 passed**, including desktop/mobile restrictions and read-only attribution.
- `git diff --check`.

The full unit suite still has **six failures**, reproduced in an untouched export
of baseline `21ea13c02ca6794543b199c263f9a79a02da04b0`:

1. `daily-income-filters.test.mjs` fails loading its dependencies.
2. `daily-income-start-display.test.mjs` expects a disabled button that is absent.
3. Four `delivery-display.test.mjs` tests cannot resolve `./types` in their loader.

`npm run test:keyboard` also encounters the existing searchable-select fixture's
missing Redux provider. A selected failing expense case reproduces on untouched
baseline. The repeated failing full fixture run was stopped; its assertions were
not weakened or removed. Independent form keyboard and new responsibility browser
tests pass.

Small pre-existing type mismatches blocked the build: the generic journal schema
and transaction labels disagreed with the journal type, the initial-payment form
omitted an existing schema message, and account helpers had incorrect optional/
readonly types. These were corrected without enabling generic LOAN-PAYMENT
posting; it remains rejected in favor of the dedicated loan workflow.

## Performance and rollout limits

No dependency, lockfile, lint configuration, CI workflow or build-script changes.
No production latency or query-plan improvement is claimed. The invoice payment
step no longer downloads the first 200 employees to guess self. A mock adapter
regression verifies one minimal reference request with cancellation; before API
rollout the explicit fallback can add a failed lookup before ordinary scoped
search. The API repository test verifies six projected fields, at most two
candidates, tenant selection and the reserved-number exclusion. Real MongoDB
index/query-plan acceptance remains pending.

After API merge and non-production deployment, apply the approved additive
permission/index workflows to the test tenant, refresh permissions, and run the
API PR's real database/authenticated acceptance matrix, especially creation
fallback, mobile readback, reserved redemption, cross-route payments and
cross-company rejection. No authenticated/live database test or historical repair
was performed here. Authorized direct API responsibility changes during pending
completion still require the separate API review noted in #388; this Portal
change prevents the audited wizard divergence.
