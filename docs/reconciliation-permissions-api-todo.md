# Reconciliation permissions — backend TODO

The portal already checks two permissions, but neither is in the permission seed or the permissions endpoints yet.

## Live status (November 3, 2026)

Verified with `npm run test:api:backend-gaps` (see [backend-api-gaps.md](backend-api-gaps.md)).

- [x] `POST /v1/journals/reconcile` returns `403 Missing permission: canReconcileJournal`.
- [x] `POST /v1/inventory/dispatches/{id}/reconciliations` returns `403 Missing permission: canReconcileInventoryDispatch`.
- [ ] Neither permission is in `GET /v1/permissions` (199 entries) or in `GET /v1/users/permissions` for Administrador.
- [ ] No role holds either grant; the existing-company migration has not run for company `64d5c0b0d1eab2aaf30b1819`.
- [x] Journal create with `autoClear` returns `403 canReconcileJournal is required to auto-reconcile` and creates nothing.
- [x] Dispatched INVENTORY journal with `autoReconcile` returns `403 AUTO_RECONCILE_FORBIDDEN`.
- [ ] Neither permission nor the reconcile routes appear in the published Swagger.

Because the checks are enforced but not seeded, nobody can reconcile or auto-approve until the seed and migration ship.

## Permissions to seed (per company)

| Permission | Resource type | Allows |
| --- | --- | --- |
| `canReconcileJournal` | `journal` | Reconcile journals and auto-approve journals on create (all transaction types and payment methods) |
| `canReconcileInventoryDispatch` | `inventory_dispatch` | Reconcile dispatched supplies, and auto-reconcile dispatched inventory when the journal is created |

- Use these names exactly. Do not add legacy aliases or per-payment-method fallbacks.
- Grant both to Administrator (or the equivalent admin role) in every existing company and in the seed for new companies.
- Do not grant them to any other role by default. They are not implied by `canViewJournal`, `canUpdateInventoryDispatch`, or other create/view/update/delete grants.

## `GET /v1/users/permissions` (current user's permissions)

- Return each permission in `permissions` and/or `role.permissions` as a separate named entry:

  ```json
  { "name": "canReconcileJournal", "resourceType": "journal" }
  { "name": "canReconcileInventoryDispatch", "resourceType": "inventory_dispatch" }
  ```

- Do not include `list`, `view`, `create`, `update`, `delete` or `print` booleans on these entries, not even `false`. The portal treats any entry with those flags as a standard create/view/update/delete row and ignores its `name`.
- Do not put reconcile on the existing `journal` / `inventory_dispatch` create/view/update/delete rows as a new flag.

## `GET /v1/permissions` and `POST /v1/permissions/search` (permission catalog)

- Include both permissions in the company catalog so admins can find and assign them to roles.
- `GET /v1/roles/{id}` should show them when assigned.

## Enforce on the server

| Endpoint / flow | Required permission |
| --- | --- |
| `POST /v1/journals/reconcile` | `canReconcileJournal` |
| Journal create with auto-approve / auto-clear | `canReconcileJournal` (ignore the flag or return 403 without it) |
| `POST /v1/inventory/dispatches/{id}/reconciliations` | `canReconcileInventoryDispatch` |
| Inventory journal create with dispatched quantity + auto-reconcile | `canReconcileInventoryDispatch` |

- Without the permission, return 403. Never reconcile silently.
- Keep the existing idempotency behavior (`requestId` / `Idempotency-Key`).
