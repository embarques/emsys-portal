# Assigned invoices (`canCreateAssignedInvoice`)

Field staff create invoices from an appointment without the full invoice wizard.

## Portal

Who gets the assigned flow: users with `canCreateAssignedInvoice` (resource `invoice`) and **without** `canViewInvoice`. Users with `canViewInvoice` keep the full wizard, including when they start from an appointment.

Entry point: Appointments → select one appointment (or open View appointment) → **Create invoice**. The desktop form tab lives under `/appointments`, because these users cannot open `/invoices`.

On open the portal resolves, for the signed-in user:

1. `GET /users/current` → tenant user id.
2. `POST /employees/search` with `{ "field": "user.id", "operator": "eq", "value": <userId> }` → the linked employee. The portal re-checks `employee.user.id` client-side and prefers an active match.
3. `POST /vehicle-routes/search` for today (`date` gte/lt day range, `routeType: "pickup"`) → the first active, non-delivery daily route whose `employees[].id` includes that employee. That gives `receivedBy` = daily route + route crew.
4. Otherwise the employee's branch `type` / department decides `office` or `warehouse`, with `receivedBy` = that employee + their branch. Delivery-branch or inactive employees are not resolved.
5. `GET /containers` sorted `id:desc`, limit 1 → latest container.
6. Date = today.

Step 1 (details) is shown read-only and the wizard opens on step 2. Step 2 shows the appointment sender and lets the user choose only among the appointment's receivers; there is no customer search, add, or edit. If no employee is linked, no assignment resolves, or no container exists, the form is blocked with a message to contact an administrator.

On save, `POST /invoices` uses the resolved branch, container and `receivedBy` directly (no extra container/employee/route reads).

## API needs

- Seed `canCreateAssignedInvoice` (`resourceType: "invoice"`) and accept it on `POST /invoices`.
- Allow `user.id` as a filter field on `POST /employees/search`.
- Grant these reads to roles holding the permission: `GET /users/current`, employee search, vehicle-route search, container list, pickup view (appointments), item catalog, active invoice policies, and the Daily Income (Cuadre) payment registration used by the create wizard.
- Recommended: for callers holding only `canCreateAssignedInvoice`, the API should verify that `pickup`, `container`, `receivedBy` and the sender/receiver match the appointment and the caller's assignment, because the portal restriction is UI-only.
