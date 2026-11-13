# Mock data — pending follow-up

Optional maintenance for disposable mock data; these specific records are not
product release blockers. Exclude them from meaningful reporting, or reset/reseed
the environment through an approved process. A historical migration or targeted
repair is needed only when the data must be retained. Correct behavior for new
transactions remains required.

## Retained inventory fixtures

Latest Section 3 valuation/revision run retains 20 AVAILABLE units of inactive
item `f56ff6b8-5b48-4f53-9ed5-124836183afe` in new warehouse
`d8a682ce-2733-4b2d-b5b2-5d76767dd090`, valued at $15.00. Supplier
`af677c38-fec0-4a04-b6fd-599aa1e7f709` is inactive. Keep receipts
`6505970c-253b-4856-bbf7-70a3ce07e458` / `58426549-caa2-4361-99eb-a9d805f947a2`
and closeout `0d8bdb3b-c8fa-4331-9232-d14b546a7c57` with immutable revisions.
These are tagged `CODEX-INVENTORY-f3bad88e-3185-4a21-a407-21da4bb00ce2`.
See [inventory evidence](section3-inventory-evidence-2026-11-12.json).

Exclude the inactive item's remaining 7 AVAILABLE and 1 QUARANTINED warehouse
units and their associated documents:

| Resource | Identifier |
| --- | --- |
| Item | `04d9e880-f066-4298-a7cb-25128a280e07` |
| Supplier | `50623141-d57a-4a30-8d9c-ca37607b5944` |
| Warehouse | `8c383957-7ce4-4373-851c-bf298e4c5be8` |
| Receipt | `b6062a87-0a5e-4445-a9c1-37dc7faad9a8` |
| Dispatch | `a1f61c00-67a1-41ab-9956-693451709df7` |
| Outcome reconciliation | `42257f25-ba33-45e4-9944-ad618f8c91c9` |
| Transfer return | `c48bffae-6778-4ba9-8780-6cac9586f56d` |
| Employee holders | `7f8e8c2e-d9ef-42f3-bc73-29cc876b0fd0`, `6b020f93-acc2-469e-a487-9f6ed4b4e721` |
| Vehicle holder | `19bbf49c-0634-4d71-a446-dfe616407957` |
| Employees / vehicle | Employees 213–214; vehicle `6aee82169025bfbf23017c2c` |

## Retained financial and closeout fixtures

- Latest [API follow-up](backend-gap-follow-up-2026-11-12.md) retains branches
  29–34 / closeouts 32716–32721 and posting accounts 10005–10006 / 10009–10011.
  Unused accounts 10007–10008 were removed. Branch 31 has a setup-only period
  after cash-child allocation rejected the omitted code. No original closeout
  was changed. All reversible financial fixture entries were reversed in their
  own branch/period; registrations remain under the dedicated invoice lifecycle.
- Retain/exclude these unpaid $100 registrations (invoice → journal):
  `6af64a5faf602e5fa9536605` → `6af64a5faf602e5fa9536606` (branch 29),
  `6af64b60af602e5fa953664f` → `6af64b60af602e5fa9536650` (branch 32),
  `6af64be0af602e5fa953669a` → `6af64be1af602e5fa953669b` (branch 33),
  `6af64c54af602e5fa95366e9` → `6af64c55af602e5fa95366ea` (branch 34).
  Their cash/discount/bank controls were reversed after assertions. Keep the
  selected invalid-account ledger evidence until B10 is fixed and verified.
- Branch-30 $2 registration journal `6af64a77af602e5fa953664a` remains after its
  pending invoice was deleted with its current version. It collected no cash;
  ordinary journal reversal is not the supported retirement path.
- Temporary tenant users 134–143 and corresponding fixture employees, roles and
  Firebase identities were removed. Retain the tagged change-request audit IDs
  in [initial approval evidence](section3-approval-initial-evidence-2026-11-12.json),
  [first complete run](section3-approval-first-complete-evidence-2026-11-12.json)
  and [final approval evidence](section3-approval-evidence-2026-11-12.json).
  No fixture request remains pending. The initial pending-lock pickup 21895 was
  independently removed after rejecting its owned pending request; subsequent
  pickup/route/customer cleanup passed. No existing user grants were changed.

- The later November 12 portal verification added fixture branches 22–28 and
  closeouts 32709–32715. Keep posting accounts 31–34 / 39–40 for audit; unused
  accounts 35–38 and containers 1401–1404 were removed. Exclude these fixture
  branches/periods from meaningful reports. All temporary users 127–133,
  corresponding employees/roles and Firebase identities were removed.
- Retain/exclude unpaid $100 registration invoices
  `6af6011bbdc3aed480bf816a`, `6af60325bdc3aed480bf8187` and
  `6af6083fbdc3aed480bf81c1`, with registration journals
  `6af6011bbdc3aed480bf816b`, `6af60325bdc3aed480bf8188` and
  `6af6083fbdc3aed480bf81c2`. Their discount, PAYMENT and cent-denominated
  sync-control journals were reversed in their own fixture branch/closeout.
- Registration `6af606a3bdc3aed480bf81bb` retains a $2 receivable/revenue
  posting after its pending invoice was deleted through the supported current-
  version endpoint. It collected no cash. Preserve/exclude that audit history
  or retire it through the dedicated invoice lifecycle; ordinary journal
  reversal does not support INITIAL-PAYMENT. Its invoice completion was blocked
  by B13, so no shipping-piece or document fixture was created.
- November 12 Section 3 fixtures: retain/exclude branches 14–15 and 17–21,
  closeouts 32701–32708, and posting accounts 23–24 / 29–30. Accounts 25–28
  were unused and removed. Branch 16 was removed during initial setup cleanup
  although its empty closeout 32703 remains; include that orphaned setup period
  in an approved environment reset/retirement. The runner now retains a branch
  once its closeout exists. These are optional mock maintenance items.
- All new cent-denominated SALES fixtures and discount/PAYMENT fixtures were
  reversed in their own fixture branch/closeout, including the two invalid-bank
  postings. Preserve those records as evidence of B10 until its fix is verified.
  The first run's reversal response lacked an inline branch field; saved-state
  readback confirms branch 14 / closeout 32701, with no attribution defect.
- Keep the two unpaid $100 registered invoices out of meaningful reports:
  `6af5fe77bdc3aed480bf8141` (branch 20 / closeout 32707) and
  `6af5febebdc3aed480bf8152` (branch 21 / closeout 32708). Their zero-payment
  registration journals `6af5fe78bdc3aed480bf8142` and
  `6af5febebdc3aed480bf8153` remain under the dedicated invoice lifecycle.
  Zero cash paid does not mean zero receivable/revenue ledger effect. Do not
  send these through the ordinary journal reversal endpoint. Temporary users,
  employees, roles and Firebase identities from these runs were removed.
  See [Section 3 evidence](section3-ownership-2026-11-12.md).
- Correct the three $0.01 reversal attributions in NY closeout 32698 and define
  retirement/reporting treatment for fixture branches 12–13, accounts 21–22 and
  closeouts 32699–32700. Exact original/reversal IDs are in the
  [November 11 financial audit](current-company-api-audit-2026-11-11.md#retained-financial-fixtures-and-cleanup-correction).
  The November 12 read-only recheck found all six original/reversal records
  unchanged in attribution; both fixture closeouts remain open. No repair was
  attempted. See the [latest recheck](backend-gap-test-sweep-2026-11-12.md).
- Exclude isolated branch 11 and closeouts 32693–32694 from meaningful reporting.
  Establish a supported retirement path if these fixtures are no longer needed;
  the branch contract exposes no inactive field.
- Exclude $1 unpaid invoice `6aee7e2a9025bfbf23017bd7`
  (`ZZ_BACKEND_RECEIPT_1794014761463`) and its linked journal/audit history:
  `6aee7e2b9025bfbf23017bdb`, `6aee7e2d9025bfbf23017be2`.
- Exclude additional expense/reversal history for original journals
  `6aee83109025bfbf23017c31`, `6aee83c49025bfbf23017c55`,
  `6aee84139025bfbf23017c68`, `6aee84149025bfbf23017c6a`.
- Keep generated reservation numbers INV-26-001486 and INV-26-001487 out of
  meaningful mock-report assertions.
- Resolve the retained initial-payment postings listed below.

## Temporary customer cleanup

Retire inactive test customers `6aef49649025bfbf23017c8e` and
`6aef49649025bfbf23017c90` through supported operations and exclude them from
meaningful reporting until cleanup is complete.

## Retained verification artifacts

- Exclude reserved number `INV-26-001500` (`6aef8b3125aee8b238568f7b`) from
  meaningful mock-report assertions while it remains in the approved test pool.
- Establish the retention/disposition of linked mock signature, audit and receipt
  history for invoice `6aef8c0a25aee8b238568f90`, delivery `10482`, and signature
  `6aef8c0c25aee8b238568f95`. Retained linked history was authorized; its cleanup
  was not verified. Preserve required audit records and exclude test history
  from meaningful reporting.

## Test identity lifecycle

Confirm Firebase identity cleanup independently of tenant-user deletion for the
synthetic test identities associated with tenant users 89–108. Tenant-user
cleanup alone does not establish Firebase identity deletion.

## Retained initial-payment postings

- Provide a supported invoice-lifecycle repair for retained mock initial-payment
  postings. INV-26-001482/001483 retain $0.02 combined cash/SALES postings; six
  invoice-owned entries also remain after their invoices were deleted. Repair
  through supported operations and exclude these fixtures from meaningful mock
  reporting until resolved:

  | Invoice | Journal requiring repair |
  | --- | --- |
  | INV-26-001476 (deleted) | `6aecbaae87c1d88ee1a3d670` |
  | INV-26-001477 (deleted) | `6aecbaaf87c1d88ee1a3d676` |
  | INV-26-001478 (deleted) | `6aecbab087c1d88ee1a3d67c` |
  | INV-26-001479 (deleted) | `6aecbab187c1d88ee1a3d682` |
  | INV-26-001480 (deleted) | `6aecbab287c1d88ee1a3d688` |
  | INV-26-001481 (deleted) | `6aecbab387c1d88ee1a3d68e` |
  | INV-26-001482 | `6aee1104d037620215133a67` |
  | INV-26-001483 | `6aee1105d037620215133a6d` |


## November 13 verification retention

See [execution and limits](backend-gap-follow-up-2026-11-13.md),
[independent journal/identity cleanup](backend-gap-cleanup-readback-2026-11-13.json)
and [catalog/inventory/pool readback](backend-gap-retention-readback-2026-11-13.json).
Only tagged mock records were changed; no original closeout was advanced.

The following newly created branch/current-period pairs remain for audit or
incomplete setup. Exclude them from representative business reports:

| Branch | Closeout | Evidence |
| --- | --- | --- |
| 35 | 32722 | [fixture](section3-invoice-evidence-2026-11-13.json) |
| 37 | 32723 | [fixture](section3-matrix-evidence-2026-11-13.json) |
| 38 | 32724 | [fixture](section3-invoice-format-recheck-2026-11-13.json) |
| 39 | 32725 | [fixture](section3-invoice-route-evidence-2026-11-13.json) |
| 40 | 32726 | [fixture](section3-loan-lifecycle-evidence-2026-11-13.json) |
| 41 | 32727 | [fixture](section3-invoice-scoped-evidence-2026-11-13.json) |
| 42 | 32729 | [fixture](section3-loan-scoped-evidence-2026-11-13.json) |
| 43 | 32728 | [fixture](section3-invoice-readback-evidence-2026-11-13.json) |
| 44 | 32730 | [fixture](section3-loan-global-account-evidence-2026-11-13.json) |
| 45 | 32731 | [fixture](section3-invoice-rd-evidence-2026-11-13.json) |
| 46 | 32732 | [fixture](section3-invoice-lifecycle-evidence-2026-11-13.json) |
| 47 | 32733 | [fixture](section3-invoice-identity-lifecycle-evidence-2026-11-13.json) |
| 48 | 32734 | [fixture](section3-invoice-final-lifecycle-evidence-2026-11-13.json) |
| 49 | 32735 | [fixture](section3-matrix-final-evidence-2026-11-13.json) |

Branch 36 was removed after a setup transport failure; its exact-marker role
lookup returned no record. All recorded temporary users/roles/employees/routes,
ordinary shipment invoices and their generated catalog pieces are absent on
independent readback. Private fixture documents were deleted before invoice
cleanup. Firebase identity deletion succeeded in every completed identity run;
no Firebase-admin readback was available.

Financial postings in branches 37 and 49 were reversed in their own periods.
BANK 46 and BANK 58 / EXPENSE 59 remain for immutable ledger attribution.
Two zero-payment registrations and their pending financial invoice identities
remain; their receipt/discount postings were reversed:

| Branch | Registration journal | Pending invoice |
| --- | --- | --- |
| 37 | `6af744ba31a295cf38083b67` | `6af744ba31a295cf38083b65` |
| 49 | `6af747ed31a295cf38084269` | `6af747ec31a295cf38084268` |

The first matrix's reversal readback transport failure did not leave an active
posting: `6af744c831a295cf38083b90` is independently REVERSED with both queues
NOT_REQUIRED. All other recorded fixture postings also pass independent readback.
No loan was created: branch-local LOAN-account prerequisites were rejected.

Two generated numbers, `P-01009` (`6af7471031a295cf380840b9`) and `P-01010`
(`6af7471031a295cf380840ba`), remain unclaimed and unassigned under userId 0;
assignment to the disposable user was returned before that user was deleted.

Inventory marker `CODEX-INVENTORY-378c4218-b5a9-4b43-8863-67e074dee117` retains
20 units/$15 carrying value and its immutable receipt/closeout history:

- Holder: `6b0457e1-221a-401d-8765-315b13415c05`.
- Retired item: `edd3fe64-dcad-41cb-88ed-0e6b012caeb7`.
- Retired supplier: `4db5a9f2-d8b5-4626-b31a-2447dcbf1b58`.
- Receipts: `68880995-b5a0-4909-b01e-d8dafbb05418`, `19a6a0f5-266b-4ffb-b6cd-45d486173b77`.
- Closeout: `93125334-7727-4eae-b8d7-878d63c0ef59`.

No credential or public report URL was saved. No commit, push or deployment occurred.
