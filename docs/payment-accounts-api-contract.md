# Payment accounts: cash and bank umbrellas (API contract)

Status: **portal prepared, backend pending.** Parts the current API already
supports are live; the rest is behind `NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED`
and must stay off until the items below ship.

Live check (November 3, 2026, [backend-api-gaps.md](backend-api-gaps.md)):
item 1 missing (BANK accounts exist but none is a top-level system account),
item 3 missing (`GET /accounting/paymentmethods` returns CASH, CHECK, DEPOSIT,
ZELLE, CREDIT-CARD), item 5 missing (new auto-numbered invoice payments still
get `TXN-…` references; INV-26-001453 got `TXN-00000073`). Write tests:
item 2 missing (`paymentAccount` on cash income is accepted but ignored — it
still debits CASH ON HAND, is not returned, and an EXPENSE account is not
rejected), item 4 **done** (a ZELLE expense debits the expense and credits the
bank `sourceAccount`), item 6 missing (the duplicate 409 has only the
`Duplicate payment warning` message).

## Business rules

| Transaction | Method | Money moves |
| --- | --- | --- |
| Income (new invoice, invoice payment, register income) | Cash | Into a **cash account** the user picks; defaults to the default cash account |
| Income | Any other method | Into a **bank account** |
| Expense | Cash | Out of the **cash account** the user picks |
| Expense | Any other method | Out of the **bank account** the user picks |

- New invoice transactions keep the employee/daily-route assignee, and their
  internal reference defaults to the invoice number (see section 5).
- Existing invoice payments keep the invoice, the internal reference and the
  employee/daily-route assignee.
- Payment methods: Cash, Check, Zelle, Deposit, Credit card, Debit card, Wire.
  Every non-cash method requires a bank account, plus an optional external
  reference (check number for Check).
- Bank picker: the user-defined bank accounts. When none are defined, the
  general bank account is used automatically.

## Account hierarchy

The portal identifies accounts through the existing `parentAccount` reference;
no new account type is introduced.

- **Default cash account:** the system ASSET account `CASH ON HAND` (exists today).
  A **cash account** is CASH ON HAND or any ASSET account nested under it, at any depth.
- **Default bank account:** a top-level `BANK` account with `systemAccount: true`
  (portal fallback: a top-level BANK account named `BANK`). It does **not** exist yet.
- **Specific bank accounts** are BANK accounts under the general bank account.
  **Sub-banks** are BANK accounts under another bank account (any depth). Pickers
  show the path, e.g. `BANK › Chase › Checking 1234`.
- New BANK accounts default their parent to the general bank account and can only
  choose a BANK parent.

## Required backend changes

### 1. Seed a default bank account

- Seed one top-level `BANK` system account (`systemAccount: true`, name `BANK`)
  per company, like `CASH ON HAND`. Make it non-deletable and keep its type fixed.
- Backfill: reparent existing top-level BANK accounts under it.
- Validate that a BANK account's parent is a BANK account, and an ASSET cash
  account's parent chain reaches CASH ON HAND. Reject parent cycles.
- Reports should roll sub-accounts up into their umbrella (cash total and bank total).

### 2. Accept a chosen cash account on income

`POST /journals`, `/journals/sync` and `PUT /journals/{id}` for `PAYMENT`,
`INITIAL-PAYMENT` and `SALES` with `paymentMethod.name: CASH`:

- Accept `paymentAccount: { id, name, type: "ASSET" }` and debit that account
  instead of CASH ON HAND. Omitted keeps today's behavior (CASH ON HAND).
- Validate the account is CASH ON HAND or nested under it, active, and in the
  caller's company/branch scope. Return 422 otherwise.
- Return `paymentAccount` on read so edits and receipts show it.

### 3. Debit card and Wire payment methods

- Accept `paymentMethod.name` `DEBIT-CARD` and `WIRE` on every journal type that
  accepts a method, with a required BANK `paymentAccount` (like ZELLE/DEPOSIT).
- Decide whether they create outstanding directory records like Zelle/Deposit
  or post directly; document reconciliation/auto-clear behavior.
- Add both to the journal `paymentMethod.name` filter allowlist and the summary
  grouping.
- Prefer a `GET /accounting/paymentmethods` catalog; the portal currently
  hardcodes the list (`fetchAccountingPaymentMethods`).

### 4. Expenses paid by any method

- `EXPENSE` accepts `paymentMethod` (today the contract forces CASH).
- The account the money leaves is `sourceAccount`: a cash account for CASH,
  a BANK account for every other method. Validate this pairing and scope; do
  not substitute `paymentAccount` for `sourceAccount`.
- Check expenses require `paymentReference` (check number); others accept
  `external_reference_number`.
- Credit `sourceAccount`, debit the expense `account`, and classify the expense
  correctly in summaries and Pending Transactions.

### 5. New invoice internal reference defaults to invoice number

When an `INITIAL-PAYMENT` is created (`POST /journals` or `/journals/sync`)
without `refNumber`, set `refNumber` to the invoice number, including invoices
created with `invoice.autoGenerateNumber: true`. The portal already sends the
invoice number as `refNumber` when the number is typed manually, and sends a
custom `refNumber` unchanged; it omits the field only for auto-numbered invoices.

- Apply the default only on create; updates keep the stored reference.
- Assign it in the same transaction that allocates the invoice number so retries
  and idempotent replays return the same reference.
- Document the behavior on the journal create/sync contract.

Acceptance: an auto-numbered new invoice transaction saved with "System
generated" shows the assigned invoice number as its internal reference.

### 6. Stable duplicate-payment code (recommended)

Return a stable machine-readable code for the duplicate-payment 409 while
retaining `allowDuplicatePayment: true` and the persisted override audit flag.
The portal currently recognizes the verified existing message
`Duplicate payment warning`; other conflicts never authorize an override.

### 7. Tests

Cover cross-company/branch account rejection, wrong account type for the method,
parent cycles, omitted accounts (defaults), idempotent `/journals/sync` replays,
reversals, and summary/report roll-ups.

## Portal behavior today

| Feature | Flag off (default) | Flag on |
| --- | --- | --- |
| Bank account picker | User-defined banks with `Parent › Child` labels; auto-selected when only one exists | Same |
| BANK parent in Chart of Accounts | Defaults to the general bank account; BANK parents only | Same |
| Cash account on cash income | Not shown; API posts to CASH ON HAND | Picker, defaults to CASH ON HAND |
| Debit card / Wire | Not offered | Offered; require a bank account |
| Expense | Fixed Cash; source chosen from ASSET accounts | Payment step: method, then cash or bank source account |

Not yet covered: the journal filter dropdowns don't list Debit card / Wire.
