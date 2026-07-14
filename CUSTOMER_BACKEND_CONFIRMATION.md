# Customer backend confirmation requests

**From:** EMSYS Portal frontend  
**Audience:** EMSYS API / backend team  
**Status:** Backend-confirmed from EMSYS API source review on `2026-07-11`. Portal/API follow-up gaps are called out below.
**Extracted from:** [`BACKEND_CONFIRMATION.md`](./BACKEND_CONFIRMATION.md) (Part I + customer audit decisions)  
**Related GitHub issues:** [#56](https://github.com/embarques/emsys-portal/issues/56) (account balance), [#57](https://github.com/embarques/emsys-portal/issues/57) (audit field naming)

---

## Overview

This document is the **customer-only** backend confirmation pack. Cross-resource topics (pickups, invoices, routes, etc.) remain in [`BACKEND_CONFIRMATION.md`](./BACKEND_CONFIRMATION.md).

**Shared portal code references:**

- `src/lib/customers/api/customers-api.ts`
- `src/lib/customers/types.ts`
- `src/components/customers/customers-workspace.tsx`
- `src/components/customers/customer-view-sheet.tsx`
- `API_PAYLOADS.md`, `API-Query-Usage.md`

**Audit metadata goal (customers):** list, read, and mutation responses should expose:

```txt
createdAt    datetime
updatedAt    datetime
createdBy    core.User { id, name }
updatedBy    core.User { id, name }
```

Search should allow `createdAt`, `updatedAt`, `createdBy.name`, and `updatedBy.name` (and `createdBy.id` / `updatedBy.id` where useful).

---

## Confirmed decisions (backend must implement)

### 1. Retire `createdByID` on customers

**Decision:** `createdByID` (numeric) is **deprecated** in favor of `createdBy.id` (`core.User`).

**Backend action:**

- Ensure `createdBy` / `updatedBy` are always populated on customer list + read + mutations.
- Migrate existing rows: `createdBy.id` ← legacy `createdByID` where needed.
- Mark `createdByID` deprecated in spec; remove after migration window.
- Do **not** use `user` / `employee` as creator substitutes; use `createdBy` / `updatedBy` only.
- Align UI/API naming to **Created by / Created at / Updated by / Updated at** — not “Date created / Date modified” as the field model.

### 2. Customer `receivers[]` membership

**Decision:** Only customers with **`customerType = 2` (Receiver)** may appear in `receivers[]`.

**Backend action:**

- Validate on `POST` / `PUT /customers` that every id in `receivers[]` references a Receiver customer.
- Document in OpenAPI; return clear validation error on violation.

---

## Audit gap (customers, live API `2026-07-09`)

| Resource | Endpoint | `createdAt` | `updatedAt` | `createdBy` | `updatedBy` | Portal notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Customers** | `/customers` | ✅ | ✅ | ⚠️ Target: `core.User` — `createdByID` deprecated → `createdBy.id` | ⚠️ Target: `core.User` on read | Portal still maps `createdByID` only — update after backend migration |

**Legend:** ✅ present and usable · ⚠️ partial / inconsistent · ❌ missing on live read

---

## Customer questions answered (also tracked as issues)

| Topic | Backend answer | Issue |
| --- | --- | --- |
| Account balance | `accountBalance` is currently a stored mutable customer field. It is accepted on create/update and returned from the customer document; no derivation from journals/invoices exists in the active customer service. | [#56](https://github.com/embarques/emsys-portal/issues/56) |
| Audit fields | `createdAt`, `updatedAt`, `createdBy`, and `updatedBy` are canonical on active customer records. `createdByID` is legacy/deprecated and should not be used by new portal code. | [#57](https://github.com/embarques/emsys-portal/issues/57) |

---

# Part I — Customers


## I.1 Context

Customers are referenced across pickups, invoices, journals, and related directory flows.

**Backend-confirmed:** transaction parties hydrate address from `party.address` only (single snapshot), not the full customer `addresses[]` book.

---

## I.2 Canonical `customer.Customer` read model

We believe the canonical **GET** shape is:

```txt
customer.Customer {
  id              ObjectID (24-char hex)
  name            string
  customerType    int        // 1 = Sender, 2 = Receiver — confirm
  phones[]        phone record
  email           string?
  active          bool
  IDNumber        string?
  notes           string?
  accountBalance  number?
  branch          core.BranchDTO { id, name, code }
  addresses[]     address record (primary via isPrimary)
  receivers[]     string[]   // see I.3
  createdAt       datetime
  updatedAt       datetime
  createdBy       core.User { id, name }
  updatedBy       core.User { id, name }
  createdByID     number?    // **DEPRECATED** — confirmed; use createdBy.id. Migrate data, then remove.
}
```

**Backend requirement (confirmed):** `createdByID` is deprecated. Populate `createdBy` / `updatedBy` as `core.User` on all list/read/mutation responses. Migrate `createdBy.id` from legacy `createdByID` where needed.

**Portal gap (`2026-07-09`):** `customers-api.ts` still maps `createdByID` only. Portal will update after backend returns `createdBy` / `updatedBy` on live reads.

### Backend answers

| Question | Backend answer |
| --- | --- |
| Is `customerType` always `1` / `2` on read and write? | Canonical values are numeric `1` = Sender and `2` = Receiver. The create/update binder accepts JSON numbers and numeric strings. Portal should write only `1` or `2`. |
| Is `receivers[]` an array of **customer ObjectIDs**? | Yes. The active `customer.Customer` model stores `receivers` as `[]string`; values are customer ObjectID strings. |
| Is the relationship **directional** (sender → receivers) or bidirectional? | Directional. `receivers[]` belongs on the sender customer as its default receiver links; receiver records do not automatically point back to senders. |
| Is `accountBalance` authoritative or derived? | Stored/mutable today, not derived. It is accepted in `POST /customers` and `PUT /customers/{id}` and returned as-is. |
| Are `createdBy` / `updatedBy` always populated on create / update? | Active create/update code writes `createdAt`, `updatedAt`, `createdBy`, and `updatedBy` from the authenticated actor. Existing legacy records may still need migration/backfill. |

**Confirmed target contract:** Who can appear in `receivers[]` — only **`customerType = 2` (Receiver)** records. Active backend validation is still a follow-up gap; portal should only submit receiver IDs.

---

## I.3 Customer relationships across features

The portal touches customers in several places with **different shapes**. We need one documented relationship contract.

```mermaid
flowchart LR
  Customer["customer.Customer"]
  Pickup["pickup.sender / pickup.receiver"]
  Invoice["invoice.sender / invoice.receiver"]
  Journal["journal.sender / journal.receiver"]

  Customer -->|"directional receivers[] ids"| Customer
  Customer -->|"party snapshot + id"| Pickup
  Customer -->|"party snapshot + id"| Invoice
  Customer -->|"lightweight invoice-party snapshot"| Journal
```

### A. `customer.receivers[]`

- Semantics: “default receivers for this sender”
- **Confirmed:** only **`customerType = 2` (Receiver)** customers may appear in `receivers[]`
- Writable on `POST` / `PUT /customers`: **yes**. The model and update input accept `receivers`.
- Shape: `string[]` of receiver customer ObjectID values.
- Direction: sender → receivers only.
- Cardinality / uniqueness: no explicit max is documented in active code. Portal should de-duplicate before submit.
- Validation gap: active API source stores the array but does **not** currently validate that every referenced customer exists and has `customerType = 2`. That validation remains a backend follow-up for the confirmed contract.
- UI: portal may expose management later, but should only offer Receiver customers as selectable values.

### B. Pickups (`/pickups`)

**Live probed `2026-07-09`** (`scripts/probe-pickups-live.mjs`, `scripts/probe-pickups-filters.mjs`, company `64d5c0b0d1eab2aaf30b1819`):

| Topic            | Live observation                                                                                      | Confirm                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Party shape      | `sender` / `receiver` are **embedded snapshots** on read; `sender.id` links to customer when known    | Snapshot vs ref rules on create/update                     |
| Phones           | Read: `sender.phones[]`; write: legacy `phone1` accepted                                              | Is `phone1` deprecated? Must `phones[]` be sent on update? |
| Receiver naming  | Write + read: singular `receiver`; search: `receivers.name`, `receivers.phone`, `receivers.address`   | Intentional search alias?                                  |
| Route assignment | Read: `route: { id }` (vehicle-route ObjectID, no `name`); search: `route.id eq` / `route.id eq null` | See assignment section                                     |
| Audit            | Read: `createdBy`, `updatedBy` (`core.User`); create returns `createdBy` only until first update      | `**user` retired\*\* — confirmed; `createdBy` canonical    |
| List scope       | Unfiltered `GET` and empty search imply `**completed=false**` (~168 pending vs ~2140 completed)       | Document as API contract?                                  |
| Pagination       | `total` vs `subtotal` differ (e.g. `168` / `128` on `limit=40`)                                       | Define counter semantics                                   |

**Backend answers:**

- On create, if `sender.id` is sent, the API persists a transaction party snapshot and may upsert customer data from the submitted party payload. It does not store only an ID.
- Address snapshots are singular `party.address` only, not the full `party.addresses[]` book.
- `purpose` is client-owned on write and returned on read. Comments remain separate structured entries.

### C. Invoices (`/invoices`)

- Same party snapshot contract as pickups: invoice `sender` and `receiver` are embedded `core.CustomerParty` snapshots with singular `address`.
- `receiver` is optional in the create request.
- Historical invoices stay frozen as transaction snapshots. Customer master-data changes do not rewrite existing invoice parties.

### D. Journals / accounting (`/journals`)

- Public journal request uses `sender` and `receiver` singular invoice-party payloads for invoice registration/initial payment. It does not use a `receivers[]` array in the active handler.
- Journal documents embed lightweight customer/invoice snapshots needed for accounting. They are not the full customer address book.
- Pickup supports multiple `receivers[]`; invoice and journal invoice-registration paths use singular `receiver`.

### E. Other resources

Please document whether these reference `customer.id` and how:

| Resource                           | Customer link (portal expectation)                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pickups                            | `sender`, `receiver` (party snapshot)                                                                                                                                       |
| Invoices                           | `sender`, `receiver` (party snapshot)                                                                                                                                       |
| Journals                           | `sender`, `receiver` for invoice-registration flows; lightweight embedded accounting snapshots                                                                                                                                      |
| Containers                         | Referenced by invoices (`container`), deliveries (`container`), vehicle-routes delivery (`container.id` + `container.number`), barcodes / labels (`container`) — see Part V |
| Deliveries                         | Unknown — please document (see Part II)                                                                                                                                     |
| Routes (`/routes`)                 | Crew + vehicle template; no customer link (see Part III)                                                                                                                    |
| Vehicle-routes (`/vehicle-routes`) | Schedule instance; references `/routes` via `route.id` (see Part II)                                                                                                        |
| Items (catalog)                    | No customer link; linked from invoice line items via `invoiceDetails.description` (portal assumption — see IV.6)                                                            |

---

## I.4 Legacy field cleanup (deprecation timeline)

Live API still exposes legacy fields. The portal handles them for compatibility.

| Field                       | Current portal usage                      | Backend answer                                                                                |
| --------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `phone1`, `phone2`          | Read/search compatibility only; portal may derive them from `phones[]` when needed | Not required when `phones[]` is sent. Active customer create/update writes `phones[]`; legacy `phone1` / `phone2` remain searchable/read-compatible. |
| `address` (singular)        | Fallback on read only                     | Rejected on customer create/update; use `addresses[]`. Legacy singular `address` is lazily promoted/migrated into `addresses[]` on reads/migration. |
| `oldID`                     | Read / display legacy                     | Legacy-only. New active create code does not assign `oldID`. |
| `createdByID`               | Read if present                           | **DEPRECATED** — confirmed; replace with `createdBy.id`. Backend migrates data, then removes field. |
| `CustomerType` (PascalCase) | Defensive read                            | Legacy defensive read only. Canonical field is `customerType`. Portal can drop once live payloads are confirmed clean. |

**Remaining request:** backend/OpenAPI should publish a formal removal date for compatibility fields.

---

## I.5 Write payload — canonical customer shape

Portal today sends on create / update:

```json
{
  "name": "...",
  "customerType": 1,
  "phone1": "+1...",
  "phones": [
    {
      "type": "mobile",
      "number": "+1...",
      "displayNumber": "...",
      "isPrimary": true
    }
  ],
  "email": "...",
  "active": true,
  "IDNumber": "...",
  "notes": "...",
  "branch": { "id": 1, "code": "NY", "name": "USA" },
  "addresses": [
    {
      "address1": "...",
      "city": "...",
      "state": "...",
      "zipcode": "...",
      "country": "US",
      "isPrimary": true
    }
  ],
  "receivers": ["..."]
}
```

### Backend answers

- Minimum create fields for portal: `name`, `customerType`, `branch`, and at least one valid phone/address set as required by portal UX. Backend duplicate detection only runs when name + phone + address are present.
- `receivers` is accepted on create/update as `string[]`; receiver existence/type validation is a backend follow-up gap.
- Address geo / verification can be sent in `addresses[]`, and the API also exposes dedicated primary-address metadata endpoints: `PUT /customers/{id}/address/location` and `PUT /customers/{id}/address/google-verification`.
- Duplicate rule: `POST /customers` rejects only when the same existing customer matches name + phone + address within the same `customerType` when supplied. Name-only, phone-only, address-only, and `IDNumber`-only matches are allowed.

---


---

# Portal verification log

## Customers

| Check                                   | Endpoint                      | Result                                                                                                                |
| --------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| List                                    | `GET /customers`              | 200                                                                                                                   |
| Create                                  | `POST /customers`             | 201                                                                                                                   |
| Read                                    | `GET /customers/{id}`         | 200                                                                                                                   |
| Update                                  | `PUT /customers/{id}`         | 200                                                                                                                   |
| Delete                                  | `DELETE /customers/{id}`      | 200                                                                                                                   |
| Bar / advanced search                   | `POST /customers/search`      | 200                                                                                                                   |
| Autocomplete                            | `GET /customers/autocomplete` | 200                                                                                                                   |
| Address search scope                    | search / filters / picker     | Matches any entry in `addresses[]` via canonical `addresses.*` paths; not primary-only.                              |
| Audit `createdBy` / `updatedBy` on read | list / GET                    | Confirmed canonical target. Active create/update writes `createdBy` / `updatedBy`; legacy records may need backfill. |


---

## Follow-up work

- Portal: update `customers-api.ts` and customer UI away from `createdByID` once live reads consistently expose `createdBy` / `updatedBy`.
- Backend: add `receivers[]` existence/type validation for the confirmed receiver-only contract.
- Backend/OpenAPI: keep `createdByID`, legacy singular `address`, and `CustomerType` marked as compatibility-only/deprecated fields until migration cleanup is complete.
