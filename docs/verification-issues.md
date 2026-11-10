# Portal — remaining verification and tooling gaps

Backend work is tracked separately in [backend-api-gaps.md](backend-api-gaps.md).
These are recheck targets, not claims of a fresh failing run.

## Browser fixtures and authenticated flows

- Recheck appointment comment editing/quantity expectations in
  `tests/browser/appointment-form.test.mjs`.
- Recheck delivery payment-step mounting and amount-field expectations in
  `tests/browser/deliver-dialog.test.mjs`.
- Recheck ambiguous file-input selectors and wizard completion in
  `tests/browser/invoice-documents.test.mjs`.
- Recheck the locked invoice-number dropdown test in
  `tests/browser/invoice-form.test.mjs`: without manual-number permission, it
  times out looking for the custom-number option. Align the fixture and
  assertions with the intended permission behavior without weakening the gate.
- Recheck row labels, cross-page selection and selected totals in
  `tests/browser/journal-reconciliation.test.mjs` and
  `tests/browser/pending-transactions.test.mjs`.
- Recheck holder/vehicle fixtures in `tests/browser/pending-inventory.test.mjs`.
- Recheck current-closeout display and pending-section permission expectations
  in `tests/unit/daily-income-start-display.test.mjs` and
  `tests/unit/financial-activity.test.mjs`.
- Distinguish stale fixtures from application regressions without weakening
  permission gates, financial validation or keyboard behavior.
- Verify view-only and assigned-only invoice entry points using actual roles;
  complete authenticated inventory and loan entry/payment flows and loan lookup
  pagination beyond one page. Confirm the API's loan permission contract before
  adding new permission names or fallbacks.

## Planned features

- **Batch barcode querying.** In Barcode Manager (`/barcodes`), let users
  enter a comma-separated list or range of invoice numbers, or a list or range
  of barcode numbers, and load all matching barcodes in one server-side search.
  Validate and deduplicate entries, show entries that matched nothing and keep
  the results selectable for bulk update. Add en/es copy for the input, errors
  and empty states. Depends on the backend batch barcode lookup in
  [backend-api-gaps.md](backend-api-gaps.md#directory-tables-search-filter-sort-and-selection-coverage).

## Tooling

- Update `scripts/audit-api-table-columns.mjs` for OpenAPI 3
  `components.schemas`, then rerun coverage against current table-field mappings.
  It currently reads the absent Swagger 2 `definitions` field.
- Review remaining hook/ref/library lint warnings and their intentional
  suppressions before deciding whether a source change is needed; do not carry
  forward old warning counts as current results.
- Resolve Node's TypeScript-loader/module warning without changing the package
  module type solely to silence it.

Use [PLAYWRIGHT.md](../PLAYWRIGHT.md) for setup and current test commands.
