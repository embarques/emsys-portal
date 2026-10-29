# Pending Transactions update — journal reconciliation (backend/API and portal TODOs)

Status: **proposed — backend work required.** This is the single place for every
backend/API and portal TODO about the Daily Income and Accounting → Pending
Transactions tables. Portal pieces that already ship are listed under
[Portal status](#portal-status).

## Business model

- **Daily Income** shows every journal (transaction) of **one closeout**
  (`incomeStatement.id`).
- **Accounting → Pending Transactions** is a **separate page**: the aggregate of
  all **Outstanding** journals from **every closeout**. *Outstanding* here means
  **not yet cleared/reconciled by an admin** — it has nothing to do with an
  invoice's unpaid balance. Once a journal is reconciled it leaves Pending
  Transactions and stays visible in its closeout in Daily Income.
- Both pages share the **same table functionality**: columns, advanced filters,
  multi-select and selected-row Income / Expenses / Net income.
- Reconciliation is **a field on the journal**, not a separate resource.
- **Only admins reconcile.** Reconciling is the admin's OK that the money was
  received (income) or the expense is approved. It never changes the journal's
  date, closeout, amount, employee or daily route. OK'ing is the **only**
  action, the same for every payment method including cash.
- **Auto-reconcile skips the queue.** When an admin adds a transaction in Daily
  Income → Add transaction with **Auto-approve (mark as cleared)** on, the
  journal is created Reconciled. Anything created without it (or by a non-admin)
  is created Outstanding and waits in Pending Transactions.
- Admins use the advanced filters (payment method, user, employee, dates, …) to
  narrow the list, select rows, check the selected **Income / Expenses / Net
  income**, then reconcile them together.

## Journal fields (`journal.Journal`)

| Field | Type | Meaning |
|-------|------|---------|
| `reconciliationStatus` | `"OUTSTANDING"` \| `"RECONCILED"` | On every journal |
| `reconciledAt` | ISO datetime \| null | When it was reconciled |
| `reconciledBy` | `{ id, name }` \| null | Admin who reconciled it (`user.name` as returned) |
| `autoReconciled` | boolean | Reconciled on create via `autoClear` |

- Returned by `GET /v1/journals/{id}`, list and search.
- **`reconciliationStatus` is the only cleared/OK'd status.** The check /
  Zelle / deposit / credit card records stop owning a separate clearing
  lifecycle: their `status` (`OUTSTANDING` / `CLEARED`) is derived from the
  linked journal's `reconciliationStatus` (or removed), and clearing through
  `PUT /v1/checks/{id}`, `/zelle-payments/{id}`, `/deposits/{id}` and
  `/credit-card-payments/{id}` is retired. Reconciling a non-cash invoice
  payment journal applies the invoice payment/balance in the same transaction.
- `PUT /v1/journals/{id}` must not change these fields; only the reconcile
  endpoint (or `autoClear` on create) does.
- **Reconciled is final.** A `RECONCILED` journal cannot be reversed
  (`POST /v1/journals/{id}/reverse` → `409`) and never returns to
  `OUTSTANDING`. Only Outstanding journals can be reversed.
- **Backfill (backend decision):** suggested rule — existing journals with an
  outstanding clearing record or unresolved financial activity become
  `OUTSTANDING`; all others `RECONCILED` with `reconciledAt = null`.

## Permission

`canReconcileJournal` on resource `journal`, seeded to the **admin** role only.
Required for `autoClear: true` on create and `POST /v1/journals/reconcile` —
the only two ways a journal becomes Reconciled. The per-method update grants
(`canUpdateCheck`, `canUpdateZellePayment`, `canUpdateDeposit`,
`canUpdateCreditCardPayment`) no longer clear anything. The portal checks
permissions, never role names; until the new grant exists it keeps the
per-method update grants for auto-approve.

## Create — `autoClear`

`POST /v1/journals` keeps the existing `autoClear` field. With
`autoClear: true` the journal is created `RECONCILED` (`autoReconciled: true`,
`reconciledBy` = creator) for **every** transaction type and payment method,
including cash — today it is only accepted for `INITIAL-PAYMENT` / `PAYMENT` by
check, Zelle, deposit or credit card. Without `canReconcileJournal` → `403` and
nothing is created.

## Search — `POST /v1/journals/search`

- Without an `incomeStatement.id` filter, search returns journals across **all
  dates** in the company scope, server-paginated with `total`, sortable by
  `date` and `createdAt`.
- Advanced filters both pages need. Today only three are confirmed against the
  live API; the rest must be added to (or confirmed in) the search allowlist:

| Portal filter | API field | Operators | Status |
|---------------|-----------|-----------|--------|
| Invoice # | `invoice.number` | eq, neq, contains, startsWith | Confirmed (eq) |
| Transaction | `transactionType` | eq, neq | Confirmed (eq) |
| Income statement | `incomeStatement.id` | eq, neq, gte, lte | Confirmed (eq) |
| Date / Date range | `date` | gte, lte | Needed |
| User | `createdBy.name` | eq, neq, contains, startsWith | Needed |
| Account | `accounts.name` (any line) | eq, neq, contains, startsWith | Needed |
| Cost | `invoice.cost` | eq, neq, gte, lte | Needed |
| Payment | `invoice.payment` | eq, neq, gte, lte | Needed |
| Balance | `invoice.balance` | eq, neq, gte, lte | Needed |
| Amount | `transactionAmount` | eq, neq, gte, lte | Needed |
| Employee | `employee.name`, `employee.id` | eq, neq, contains, startsWith | Needed |
| Payment method | `paymentMethod.name` | eq, neq | Needed |
| Check number | `paymentReference` (string; keep leading zeros) | eq, neq, contains, startsWith | Needed |
| External reference number | `external_reference_number` | eq, neq, contains, startsWith | Needed |
| Internal reference number | `refNumber` | eq, neq, contains, startsWith | Needed |
| Branch | `branch.id` (journal or its closeout's branch) | eq | Needed (Pending Transactions) |
| Reconciliation | `reconciliationStatus` | eq, neq | Needed (new field); Pending Transactions always sends `eq OUTSTANDING` |

Text operators should be case- and accent-insensitive. `neq` matches journals
where the field is missing.

## Totals — `POST /v1/journals/summary`

Body: `{ "filters": [...] }` (same filters as search, no pagination) **or**
`{ "ids": ["…"] }` (1–200 journal ids); both together → `400`.

```json
{
  "success": true,
  "data": [
    { "currency": "USD", "income": 1250.0, "expenses": 310.5, "net": 939.5, "count": 18 }
  ]
}
```

One entry per currency, never converted. Classification mirrors the Daily
Income summary (`journalCountsAsIncome` / `journalExpenseAmount` in
`src/lib/accounting/daily-income/journal-classification.ts`):

- **Income:** `INITIAL-PAYMENT`, `PAYMENT`, `SALES`, `INVENTORY` dispatched → `transactionAmount`.
- **Expenses:** debit of `EXPENSE` account lines when present; otherwise `EXPENSE`
  and `INVENTORY` received → `transactionAmount`.
- **Excluded:** `DISCOUNT`, `SURCHARGE`, `TRANSFER`, `LOAN` and others (still in `count`).
- `net = income − expenses`.

Pending Transactions uses `filters` for "everything matching" and `ids` for
selections that span pages.

**Follow-up:** grouping totals by employee, branch, or payment method (needs an
extended aggregation contract).

## Bulk reconcile — `POST /v1/journals/reconcile`

```json
{ "requestId": "6f1c2a0e-6c55-4c1e-9a3e-2d1f0b7c9e11", "ids": ["j_101", "j_102"] }
```

- Requires `canReconcileJournal`; same company scope as search.
- 1–200 ids, all with the **same payment method** → otherwise `422` listing the ids.
- All must be `OUTSTANDING` and not reversed → otherwise `409` listing the ids.
- **Atomic** (all or none), applying invoice payments transactionally.
- **Idempotent** by `requestId`.
- Response: `{ "success": true, "data": { "reconciled": ["j_101", "j_102"], "reconciledAt": "…" } }`.

## Retiring the separate financial-activity list

Once the above ships, Pending Transactions stops using
`POST /v1/financial-activity/search` and its per-row events
(`/financial-activity/{id}/events`). The sidebar badge becomes the count of
`OUTSTANDING` journals the user can see (all payment methods, including cash),
e.g. search with `limit: 1` and read `total`.

## Portal status

Shipped (no backend change needed):

- **Daily Income advanced filters** for every field in the table above except
  Branch and Reconciliation. They run in the browser over the closeout rows the
  page already loads (up to 500 per closeout, the existing limit), using the
  same AND/OR order as the API builder.
- **Daily Income selected totals:** selecting rows shows Income / Expenses / Net
  income for the selection (current page), per currency, with the
  classification above.

After the API ships:

1. Daily Income sends the advanced filters to `POST /v1/journals/search` once
   the allowlist above is confirmed, and drops the 500-row browser limit.
2. Pending Transactions stays its own page and switches to
   `POST /v1/journals/search` with a fixed `reconciliationStatus eq OUTSTANDING`
   across all closeouts. It reuses the Daily Income table pieces (columns,
   `DAILY_INCOME_TABLE_FILTER_FIELDS` plus Branch, multi-select and selected
   totals), adds totals for all matching rows and cross-page selections via
   `POST /v1/journals/summary`, limits admin row checkboxes to one payment
   method, and offers admin-only **Reconcile selected** with confirmation and a
   stable `requestId`. Reconciled rows drop off the list.
3. The Daily Income auto-approve switch is offered to admins for every
   transaction type and payment method, gated by `canReconcileJournal`.
4. The Checks, Zelle, Deposits and Credit card directories become view-only:
   **Mark cleared** is removed and their status shows the linked journal's
   `reconciliationStatus`.

## Open backend decisions

- Backfill rule for existing journals (suggestion above).
