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
rejected), item 4 **posting works, validation incomplete** (the November 3
ZELLE posting passed; November 5 validation gaps are detailed in section 4),
item 6 missing (the duplicate 409 has only the
`Duplicate payment warning` message).

**Read-only recheck November 5, 2026 — item 1 remains open:** in company
`64d5c0b0d1eab2aaf30b1819`, BANK search returns exactly three accounts (Wells
Fargo, TD Bank, M&T Bank). All lack a parent and none has `systemAccount: true`;
the umbrella seed and reparenting have not appeared in this company's live
data. Non-deletability, fixed type, BANK/cash ancestry validation, cycle rejection
and report roll-ups remain unverified acceptance criteria. No backend checkout
was available. The authorized mutation follow-up below documents fixture
creation blockers; do not infer these behaviors from the account list.
Other payment-account items retain their November 3 status except item 2,
which has the focused November 5 verification below, as do items 3 and 4.
See [backend-api-gaps.md](backend-api-gaps.md).

**Authorized mutation follow-up November 5:** creating a BANK child under either
an existing BANK or a disposable EXPENSE returned `409 system chart account is
protected`. Creating a top-level BANK with `systemAccount: true` returned `400
chart account type and display name are required`, despite both fields being
present. The valid-parent control failed too, so this does not verify the BANK
parent-type rule. The only ASSET returned was top-level `Cash Account` (id 4);
exact `CASH ON HAND` search returned no rows. Disposable ASSET creation failed
both without a parent (`400`) and under EXPENSE (`409`). Thus cycle tests,
system BANK update/delete tests and report roll-up tests remain blocked by
missing roots/fixtures. Both disposable EXPENSE parents were deleted and GET
verified as `404`; no journals were created. Full results and probe labels:
[backend-api-gaps.md](backend-api-gaps.md#authorized-mock-data-mutation-follow-up--november-5-2026).

## Business rules

| Transaction                                            | Method           | Money moves                                                                  |
| ------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------- |
| Income (new invoice, invoice payment, register income) | Cash             | Into a **cash account** the user picks; defaults to the default cash account |
| Income                                                 | Any other method | Into a **bank account**                                                      |
| Expense                                                | Cash             | Out of the **cash account** the user picks                                   |
| Expense                                                | Any other method | Out of the **bank account** the user picks                                   |

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

#### Live mutation verification — November 5, 2026

**Still open.** Tested in mock-data company `64d5c0b0d1eab2aaf30b1819` with
an Administrador token. Each create path/type was tested with an omitted
`paymentAccount`, ASSET `Cash Account` (id 4), and EXPENSE `Gasolina` (id 5).
SALES used REVENUE `VENTA DE CAJAS` (id 6). Journal amounts were $0.11–$0.25;
new initial-payment invoice costs were $1 each.

| Path / transaction type | Observed behavior |
| --- | --- |
| `POST /journals`: PAYMENT, SALES, INITIAL-PAYMENT | All nine variants returned `201`. Every journal debited CASH ON HAND, ignoring the supplied account. EXPENSE was accepted instead of `422`. |
| `POST /journals/sync`: same three types | Same result for all nine variants. Replaying the ASSET request with the same `requestId` returned the same journal ID for each type. |
| `PUT /journals/{id}`: PAYMENT, SALES | All six variants returned `200` and still debited CASH ON HAND. EXPENSE was not rejected. These were full-entry description edits retaining each tested account variant. |
| `PUT /journals/{id}`: INITIAL-PAYMENT | All three variants returned `409 Journal entry is managed by invoice lifecycle`. The requested edit scope conflicts with the deployed lifecycle contract; decide whether to support it here or document the invoice-owned alternative. |
| `GET /journals/{id}` after create/sync and after PUT | No tested journal returned `paymentAccount`. |
| Omitted account | Continued to debit CASH ON HAND on every successful create/update. |

The only ASSET available in the chart directory was top-level `Cash Account`;
it was not verified as a descendant of CASH ON HAND. Thus these probes prove
that the supplied selection is ignored and wrong-type validation is missing,
not that a valid nested cash-account fixture works. Active/inactive, cross-branch,
cross-company and deeper ancestry validation remain unverified. No foreign
company records were modified.

Initial attempts to use an existing invoice with only `invoice.id` and no cost
returned `409 Invoice balance cannot be negative`; they do not establish
cash-account behavior. The INITIAL-PAYMENT results above use fresh registrations.

Cleanup and retained mock records:

- Tag `ZZ_CASH_ACCOUNT_PROBE_20261105_1793899115602`: all **12** PAYMENT/SALES
  journals were reversed successfully. Originals and reversing adjustments remain
  as labeled history. The existing invoice `6a322b4ca08ce327600a00b8` retained
  its original $120 cost and $120 balance after the probes.
- Tag `ZZ_CASH_INITIAL_PROBE_20261105_1793899180635`: the six new invoices
  **INV-26-001476 through INV-26-001481** were deleted through the invoice
  endpoint with quoted `If-Match`; all six subsequent invoice GETs returned
  `404`. **Their INITIAL-PAYMENT journals remain ACTIVE and Outstanding**:

  | Deleted mock invoice | Retained journal ID |
  | --- | --- |
  | INV-26-001476 | `6aecbaae87c1d88ee1a3d670` |
  | INV-26-001477 | `6aecbaaf87c1d88ee1a3d676` |
  | INV-26-001478 | `6aecbab087c1d88ee1a3d67c` |
  | INV-26-001479 | `6aecbab187c1d88ee1a3d682` |
  | INV-26-001480 | `6aecbab287c1d88ee1a3d688` |
  | INV-26-001481 | `6aecbab387c1d88ee1a3d68e` |

  Journal reversals returned `409` for these invoice-owned entries. Deleting
  the invoices did not remove or reverse their journals: retained ledger lines
  total $0.81 cash debit, $5.19 receivable debit and $6 revenue credit. **This
  part of the probe was not financially undone.** The journal descriptions and
  reference numbers carry the tag above; exclude them from meaningful mock
  reporting or clean them through a supported backend invoice-lifecycle repair.
  No cleanup bypasses or direct database writes were used.

### 3. Debit card and Wire payment methods

- Accept `paymentMethod.name` `DEBIT-CARD` and `WIRE` on every journal type that
  accepts a method, with a required BANK `paymentAccount` (like ZELLE/DEPOSIT).
- Follow Zelle/Deposit's outstanding and clearance lifecycle. Reconciliation
  and clearance remain independent; do not classify these methods as
  `clearanceStatus: NOT_REQUIRED`. Document the directory/settlement records
  and reconciliation/auto-clear behavior consistently.
- Add both to the journal `paymentMethod.name` filter allowlist and the summary
  grouping.
- Prefer a `GET /accounting/paymentmethods` catalog; the portal currently
  hardcodes the list (`fetchAccountingPaymentMethods`).

#### Debit card / Wire live verification — November 5, 2026

**Partly supported; still open.** Focused mock-data checks in company
`64d5c0b0d1eab2aaf30b1819` used BANK `Wells Fargo` (id 1), REVENUE
`VENTA DE CAJAS` (id 6), EXPENSE `Gasolina` (id 5), and the existing invoice
`6a322b4ca08ce327600a00b8`.

| Requirement | Observed result for both `DEBIT-CARD` and `WIRE` |
| --- | --- |
| Catalog endpoint | `GET /accounting/paymentmethods` already exists (`200`), but returns only CASH, CHECK, DEPOSIT, ZELLE and CREDIT-CARD. Both new methods are missing. |
| PAYMENT / SALES create | `400 Payment method is not supported`, both with BANK `paymentAccount` and with it omitted. Error explicitly recommends the five existing methods. |
| INITIAL-PAYMENT create / PAYMENT sync | Same unsupported-method `400`, with a BANK supplied. No new initial-payment journals or invoices were returned by these probes. |
| PAYMENT / SALES update | Same unsupported-method `400`; GET confirmed the disposable CASH journals remained CASH before cleanup. |
| EXPENSE create | `201`, debit expense and credit BANK `sourceAccount`; both method names persist on GET. Tested with and without an additional `paymentAccount`, retaining BANK `sourceAccount` in both cases, per the separate expense contract. |
| EXPENSE update | Fresh versioned edits to either method return `200` and credit the bank. An initial second edit reused a stale version and returned `409`; WIRE was then verified on its own fresh fixture. |
| Outstanding / clearance | Debit/Wire expenses are `reconciliationStatus: OUTSTANDING` but `clearanceStatus: NOT_REQUIRED`. Matching ZELLE and DEPOSIT **expense** controls return OUTSTANDING for both statuses. Thus requested settlement parity is missing even where posting works. |
| `paymentMethod.name` search | `eq` succeeds (`200`) and finds persisted method rows. `neq` also succeeds when scoped by the probe reference prefix. Initial unscoped `neq` searches returned `500`; those failures alone do not imply the method filter is unsupported. |
| Filtered summary | Both method filters return `200` with USD income/expenses/net/count. This verifies filtered totals, not a payment-method grouping API: the documented summary remains one row per currency and has no documented method-grouping contract. |

The summary probes, taken after reversing the four initial expense probes,
still reported expenses $0.71 for Debit card and $0.87 for Wire (four rows each,
including reversing adjustments). This is observed summary behavior, **not**
proof that reversals cancel correctly in summary totals. Ledger reversal lines
did cancel the expense/bank postings. Keep reversal-aware reporting as a
validation follow-up rather than treating these filtered totals as a complete
grouping implementation.

BANK-required, wrong-type, inactive and cross-tenant/branch validation for the
new methods is not established by unsupported-method errors or the successful
expense fixtures. Other method-bearing journal types, inventory side effects,
actual clearance commands and sync for non-PAYMENT types were not exercised.

Portal source still hardcodes `fetchAccountingPaymentMethods`, adding Debit/Wire
only behind `NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED`. Its local method IDs must
not be assumed to equal live catalog IDs (the hardcoded CHECK/DEPOSIT IDs differ
from this catalog). Journal filter options also still omit Debit/Wire. Catalog
consumption and filter options are portal follow-ups after the backend contract
is complete; no portal runtime code was changed by this audit.

Cleanup: tags `ZZ_DEBIT_WIRE_PROBE_20261105_1793899425910` and
`ZZ_DEBIT_WIRE_FOLLOWUP_20261105_1793899483391` identify **12** created journals
and their reversing adjustments. Every created journal was successfully
reversed; the existing invoice retained its original $120 cost and $120 balance.
Labeled originals/reversals remain in history. No new initial-payment invoice
was created in this method audit.

### 4. Expenses paid by any method

- `EXPENSE` accepts `paymentMethod` (today the contract forces CASH).
- The account the money leaves is `sourceAccount`: a cash account for CASH,
  a BANK account for every other method. Validate this pairing and scope; do
  not substitute `paymentAccount` for `sourceAccount`.
- Check expenses require `paymentReference` (check number); others accept
  `external_reference_number`.
- Credit `sourceAccount`, debit the expense `account`, and classify the expense
  correctly in summaries and Pending Transactions.

#### Expense-method live verification — November 5, 2026

**Partly live; keep validation and reporting work open.** The earlier
"item 4 done" finding established ZELLE posting only, not the complete contract.
Mock-data probes in company `64d5c0b0d1eab2aaf30b1819` now establish:

| Requirement / probe | Observed behavior |
| --- | --- |
| Accept payment methods | CASH, CHECK, ZELLE, DEPOSIT, CREDIT-CARD, DEBIT-CARD and WIRE all returned `201` for EXPENSE and persisted their method on GET. |
| Normal ledger posting | CASH credited ASSET `Cash Account` (id 4); every other method credited BANK `Wells Fargo` (id 1). All debited EXPENSE `Gasolina` (id 5). |
| Method/source pairing | **Missing:** CASH with BANK, ZELLE with ASSET or REVENUE, and WIRE with EXPENSE source all returned `201` and credited the supplied wrong-type account. WIRE with the same expense as source and destination even posted debit and credit to that expense account. |
| Authoritative source lookup | **Missing:** ZELLE accepted source id `999999999` with a synthetic BANK name, and credited that nonexistent account reference. Supplying existing ASSET id 4 with claimed type BANK also persisted a BANK credit without correcting the type from the chart record. |
| `sourceAccount` versus `paymentAccount` | With Wells Fargo as source and TD Bank as `paymentAccount`, the API correctly credited Wells Fargo. With only `paymentAccount`, both CASH and ZELLE silently credited CASH ON HAND. The alias was not substituted, but a missing non-cash source was not rejected. |
| Explicit Check number | A CHECK with `paymentReference` preserved it on GET; the legacy `checkNumber` alias also populated `paymentReference`. |
| Required Check number | **Missing:** CHECK create with omitted/blank `paymentReference` accepted an external reference instead. Create and sync with no `paymentReference`, `checkNumber` or `external_reference_number` still returned `201`, copying the supplied internal `refNumber` into the payment/external reference fields. An internal transaction reference is not an explicit check number. |
| Other methods' external references | Supplied `external_reference_number` persisted on GET for all seven tested methods; non-Check examples also copied it into `paymentReference`. |
| Update validation | Fresh versioned PUT accepted ZELLE with the wrong ASSET source (`200`) and a switch to CHECK without an explicit check number (`200`, external reference supplied). GET confirmed the resulting ledger/method. |
| Original expense summary | For each of the seven methods, summary by the original journal ID returned income 0, expenses equal to the posted amount, and negative net, with count 1. |
| Pending Transactions | Every created probe was returned by journal search with its unique `refNumber` plus `reconciliationStatus = OUTSTANDING` (total 1), before reversal. This verifies API queue membership, not a browser interaction. |
| Reversal-aware summary | **Incorrect net:** summary by a $0.13 ZELLE original plus its reversing journal returned expenses $0.13, net -$0.13, count 2, although their ledger lines cancel. Reversal-aware reporting remains open. |

Active/inactive accounts, valid nested cash ancestry, and real cross-company or
cross-branch source fixtures were not available, so those scope checks remain
**unverified**. Acceptance of a nonexistent/spoofed reference is a confirmed
lookup defect, not proof of a cross-tenant access bypass. Debit/Wire expenses'
clearance mismatch remains documented in section 3.

Cleanup: tags `ZZ_EXPENSE_PROBE_20261105_1793899611821` and
`ZZ_EXPENSE_CHECK_PROBE_20261105_1793899682946` identify **24** created expense
journals. Every journal was successfully reversed; labeled originals and
reversing adjustments remain in history. No invoices, chart accounts or tenant
context were changed by this expense audit. Reversal does not remove the
reported summary defect or guarantee that summary totals net to zero.

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

| Feature                          | Flag off (default)                                                                  | Flag on                                                |
| -------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Bank account picker              | User-defined banks with `Parent › Child` labels; auto-selected when only one exists | Same                                                   |
| BANK parent in Chart of Accounts | Defaults to the general bank account; BANK parents only                             | Same                                                   |
| Cash account on cash income      | Not shown; API posts to CASH ON HAND                                                | Picker, defaults to CASH ON HAND                       |
| Debit card / Wire                | Not offered                                                                         | Offered; require a bank account                        |
| Expense                          | Fixed Cash; source chosen from ASSET accounts                                       | Payment step: method, then cash or bank source account |

Not yet covered: the journal filter dropdowns don't list Debit card / Wire.
