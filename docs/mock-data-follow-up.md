# Mock data — pending follow-up

Exclude retained test records from meaningful company reporting. Define any
further cleanup through supported lifecycle operations without deleting linked
financial or inventory audit history.

## Retained inventory fixtures

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
- Resolve older initial-payment postings and orphaned invoice-owned journals
  listed in [backend-api-gaps.md](backend-api-gaps.md).

## Temporary customer cleanup

Resolve `DELETE /customers/{id}` returning 500 with current version headers for
test customers `6aef49649025bfbf23017c8e` and
`6aef49649025bfbf23017c90`. Keep these inactive fixtures out of meaningful
reporting and retire them through supported operations.

## Test identity lifecycle

Confirm Firebase identity cleanup independently of tenant-user deletion for the
synthetic test identities associated with tenant users 89–108. Tenant-user
cleanup alone does not establish Firebase identity deletion.
