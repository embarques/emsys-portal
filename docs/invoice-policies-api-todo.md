# Invoice policies — backend TODO

Portal work for Admin CRUD + create-wizard agreement/signature is ready. The API still needs the following.

## Model

Suggested `invoice_policy` (company-scoped):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | int | PK |
| `title` | string | Required |
| `body` | string | Required; plain text (multiline) |
| `sortOrder` | int | Display order (asc) |
| `active` | boolean | Only active rows appear in the create wizard |
| `createdAt` / `updatedAt` | timestamps | Audit |

## Permissions seed

Resource type: `invoice_policy`

| Permission |
| --- |
| `canListInvoicePolicy` |
| `canViewInvoicePolicy` |
| `canCreateInvoicePolicy` |
| `canUpdateInvoicePolicy` |
| `canDeleteInvoicePolicy` |

Grant list/view (and typically full CRUD) to Administrator / equivalent admin roles.

## Endpoints

Base path: `/v1/invoice-policies` (portal `API_ENDPOINTS.INVOICE_POLICIES`).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/invoice-policies` | Paginated admin list (`sort=sortOrder:asc,title:asc`) |
| `GET` | `/invoice-policies/active` | Active policies only, ordered for the create wizard |
| `GET` | `/invoice-policies/:id` | Detail |
| `POST` | `/invoice-policies` | Create |
| `PUT` | `/invoice-policies/:id` | Update |
| `DELETE` | `/invoice-policies/:id` | Delete |

`GET /active` should be callable by users who can create invoices (not only policy admins), so the wizard can load agreements during create.

## Document upload notes

After invoice create, the portal:

1. Renders active policies + the customer signature onto a canvas PNG (`invoice-policy-agreement-*.png`).
2. Uploads that file through the existing invoice documents flow (same as optional document drafts after create).

No dedicated “policy agreement” entity is required on the API if invoice documents already support PNG uploads. Ensure document upload accepts `image/png` and the usual size limits used by the portal (`MAX_DOCUMENT_BYTES`).

## OpenAPI

Document the model and endpoints in Swagger/OpenAPI so portal Zod schemas stay aligned.
