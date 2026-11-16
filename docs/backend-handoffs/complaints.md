# Complaints — EMSYS complaint types, evidence and case history

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **B17, B18, B19**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

**Routing:** complaint workflow owners; media work pairs with private document
storage owners. This is the requested/proposed model, not a deployed contract.
The portal retains its current API model until the replacement ships. Proposed
topic completions and file limits still require the business decision noted below.

## B17 — Three EMSYS complaint types and linked records

### Issue

**Requested model not implemented/integrated.** The reviewed source still has
eight generic categories, free-text appointment/order references, no first-class
sender link and a minimum-one-target rule. That does not support the requested
three-type workflow or a general complaint with no employees. Tenant overrides
shadow reused built-in keys and must be handled deliberately.

November 14 GET `/complaint-categories` returned 404 on the supplied live API.
That does not locate the deployment/routing cause or establish category CRUD
acceptance. No complaint records or tenant overrides were mutated in this review.

### Expected result

EMSYS is a door-to-door shipping company. Every customer complaint is one of
three types. Each type has a small set of topics:

| Type | What it is about | Topics |
| --- | --- | --- |
| Appointment | A scheduled client visit (pickup, supplies, payment, estimate) | Employee behavior, prices, etc. |
| Barcode item delivery | One or more pieces of merchandise (barcodes on an invoice) being delivered | Employee, damage, lost |
| General | The company as a whole | Employee behavior, overall service |

"Appointments" are the API's `pickups` (numeric `id`). The customer on an
appointment or invoice is its **sender** (`sender.id`, a customer). Barcodes are
the labels on individual pieces of an invoice (`barcode.Barcode.number`, string)
and belong to one invoice (`invoice.Invoice.number`, string). Employees are
directory employees (numeric `employee.Employee.id`).

#### Target staff workflow

1. **New complaint → choose the type:** General, Appointment or Delivery.
2. **Appointment:** search for the sender (customer) by name or phone, then pick
   one of that sender's appointments. Then add **zero or more** employees involved.
3. **Delivery:** search for the invoice (by invoice number, sender name or
   phone), optionally pick the affected barcodes on it, then add **zero or
   more** employees involved.
4. **General:** add **zero or more** employees involved.
5. Choose the topic, and enter the caller, subject, description and severity.
6. **Media:** attach photos or videos the customer sent as proof, during intake or later.
7. The complaint then has:
   - a **status** (open, in progress, waiting on customer, resolved, closed, rejected);
   - a **case history** showing everything done so far, by whom and when;
   - a **solution**: what was done to resolve it.

What the API already provides for this workflow:

| Need | Current API (4fdef23) | Gap |
| --- | --- | --- |
| Sender search → appointments | `POST /customers/search`; `POST /pickups/search` filters `sender.id`, `sender.name`, `sender.phone*` | None for lookup. Linking the appointment is B17. |
| Invoice search | `POST /invoices/search` filters number and `sender.*` | None for lookup. Linking the invoice and barcodes is B17. |
| Employees 0..n | `employee` targets | At least one target is required in total, so a general complaint with no employees is rejected (B17). |
| Media from customers | Staff attachments store only an HTTPS URL, type and size; the file must be hosted elsewhere | No upload or storage; video is unsupported (B18) |
| Status | `status` with enforced transitions | None |
| Case history | `events`: status change, assignment, note, reopen | Severity, targets, details, media and solution changes are not recorded (B19) |
| Solution | `resolution.summary` + `resolution.actionTaken`, captured only when moving to resolved | It cannot be drafted before resolving or corrected afterwards (B19) |

**1. Built-in categories.** New complaints can be filed only in these categories:

| Key | Label | Default severity | Response / resolution SLA (h) |
| --- | --- | --- | --- |
| `general` | General | normal | 24 / 72 |
| `appointment` | Appointment | normal | 24 / 72 |
| `delivery` | Barcode item delivery | normal | 24 / 96 |

Retire `billing`, `customer_service`, `progress`, `quality` and `other` from
intake. Existing complaints keep their stored `category` and `details` and stay
readable, searchable and workable. Do not rewrite history. Allow `other` to be retired.

**2. Required `topic` per category** (string enum; the portal owns English/Spanish labels):

| Category | `topic` values |
| --- | --- |
| `general` | `employee_behavior`, `overall_service`, `other` |
| `appointment` | `employee_behavior`, `pricing`, `late_or_no_show`, `scheduling`, `other` |
| `delivery` | `employee_behavior`, `damaged`, `lost`, `late`, `other` |

`late_or_no_show`, `scheduling`, `late` and the `other` values are suggested
completions for "etc."; confirm them with the business.

**3. First-class linked records**, not free-text details:

| Field | Type | Applies to | Rule |
| --- | --- | --- | --- |
| `customerId` | integer (customer `id`) | appointment, delivery (optional for general) | For appointment/delivery the server derives it from the pickup's or invoice's `sender.id`; a mismatched client value is rejected. |
| `appointmentId` | integer (pickup `id`) | appointment (required) | Must be a pickup in the caller's tenant. |
| `invoiceNumber` | string | delivery (required) | Must be an invoice in the caller's tenant. |
| `barcodeNumbers` | string array, 0–100 | delivery (optional) | Each must be a barcode on that invoice; no duplicates. Empty means the whole invoice. |

Return name snapshots with the read model (`customer.name`,
`appointment.date`/`orderNumber`, `invoice.number`, and barcode number with
status) so lists and details do not need N+1 lookups. Barcode numbers follow the
business choice to keep pieces on the complaint itself; a per-piece `barcode`
target with a note is an optional later extension.

Optional extra details stay in `details` under the bounded schema:
`quoted_amount`/`charged_amount` (number, USD) for appointment `pricing`, and
`delivered_on` (date) for delivery. Remove the legacy built-in detail keys
(`appointment_ref`, `issue`, `provider_name`, `wait_minutes`, `order_ref`,
`tracking_number`, `expected_date`, `photos`, `issue_summary`, `affected_areas`)
from the new built-ins.

**4. Employees: 0..30 `employee` targets on every type.** Drop the "at least one
target" rule. The only exception: topic `employee_behavior` requires at least one
employee. Stop accepting `order` targets on new writes (keep reading them). The
linked appointment, invoice and customer replace the `appointment`/`invoice`
target kinds for new complaints; existing typed targets remain readable.
`PUT /complaints/{id}/targets` (employees) and any link edit validate the same way.

**5. Search and insights.** Filter and sort by `category`, `details.topic`,
`customerId`, `appointmentId`, `invoiceNumber`, `barcodeNumbers` (any element)
and `targets.employeeId`, with tenant + category + topic + `createdAt` indexes.
Add a `topics` facet to `GET /complaints/insights`; legacy categories report
under their own keys so totals reconcile.

**6. Rollout.** Remove or migrate tenant `complaint_categories` overrides for
`general`, `appointment`, `delivery` and `other` before release. Otherwise
they shadow the new built-ins. Retired categories must stay resolvable for
labels on old complaints, for example through
`GET /complaint-categories?includeInactive=true`. Regenerate Swagger and update
`docs/contracts/complaints.md`.

### Suggested action

#### API work

1. Resolve the deployed category route separately from the model rollout.
   Implement the proposed category/topic/link/employee validation above, including
   zero employees except `employee_behavior`, sender derivation, barcode ownership
   and rejection of retired categories or new ambiguous order targets.
2. Publish the actual create/edit/read/search/insight DTOs, errors and If-Match
   rules; validate link/target edits with the same cross-field rules as intake.
3. Confirm suggested topics (`late_or_no_show`, `scheduling`, `late`, `other`)
   and proposed defaults/SLA/schema details with the modeler before treating them
   as final production contracts. Keep existing status transitions supported.
4. Return linked snapshots for paginated lists/details without N+1 directory calls;
   add topic insights while preserving legacy category totals.

#### Database work

1. Inspect `complaint_categories` tenant overrides for reused general,
   appointment, delivery and other keys. Plan explicit migration so they do not
   shadow replacement built-ins; do not reset retained overrides incidentally.
2. Retain historical category/details and typed targets, including order targets;
   old complaints remain readable, searchable and workable.
3. Implement justified tenant/category/topic/createdAt and linked-record query
   indexes, verifying actual persisted paths and plans rather than assuming a
   proposed field name is already stored.

#### Both — API and database together

1. Exercise valid intake for all three types, including general/delivery with
   zero employees; read back linked snapshots, category/topic and employee targets.
2. Reject unknown topics, missing required links, other-tenant references,
   invoice/barcode mismatch, duplicate barcodes, employee_behavior without an
   employee, new order targets and retired intake categories with HTTP 400 and no
   persisted changes. Test stale edits and link/target replacement too.
3. Verify tenant-scoped topic/customer/appointment/invoice/barcode/employee search
   pages and insight reconciliation before/after override migration. Old complaints
   still list, open, transition and count; retired labels remain resolvable.
4. Publish Swagger/Scalar and backend-owned complaint documentation, then coordinate
   portal type-first rollout. Category endpoint availability alone does not close
   model, migration or integration acceptance.

## B18 — Private customer photo and video evidence

### Issue

**Proposed capability, not integrated.** Current staff attachments store hosted
HTTPS URLs with type/size; they provide neither file upload/storage nor supported
video evidence. The proposed private upload/read/removal lifecycle and exact limits
have not been implemented, deployed or verified by this review.

### Expected result

Customers send photos and videos as proof. Staff need to upload those files to
the complaint, not just paste a link.

- `POST /complaints/{id}/media` (multipart: `file`, optional `uploadId` UUID for
  idempotent retries, optional `caption` ≤ 500). Requires complaint update. Send
  `If-Match` with the version, like other complaint writes. Allowed during intake
  (immediately after create) and on any non-closed complaint.
- Accept signature-validated images (JPEG, PNG, WebP, HEIC) and videos (MP4,
  QuickTime/MOV). Suggested limits: 25 MiB per image, 200 MiB per video, 30 files
  per complaint; confirm with the business. Reject other types.
- Reuse the company's private S3-compatible `documentStorage` (as invoice
  documents do), under `{prefix}/complaints/{complaintNumber}/{mediaId}-{filename}`.
  Never public-read.
- Read model: `media[]` with `id`, `fileName`, `mimeType`, `sizeBytes`,
  `caption`, `source: "customer"`, `uploadedBy` (user ID plus name snapshot) and
  `uploadedAt`. `GET /complaints/{id}/media/{mediaId}/link` returns a
  short-lived signed URL; requires complaint view.
- `DELETE /complaints/{id}/media/{mediaId}` (update permission, `If-Match`)
  soft-hides the file with a reason. The case history keeps the entry.
- Keep the existing link-only staff attachments readable. New uploads use
  media; staff attachments can be retired once media ships.

### Suggested action

#### API work

1. Publish the proposed multipart upload, signed-link and reasoned-removal
   contracts above with actual permissions, version conflicts and retry behavior.
2. Validate file signatures and supported formats; confirm the suggested 25 MiB
   image / 200 MiB video / 30-file limits with the modeler before enforcement.
3. Enforce complaint company scope and update/view access on every command/link,
   including closed-state restrictions and stale If-Match rejection.

#### Database work

1. Reuse company-private S3-compatible documentStorage; never public-read.
   Persist media identity, metadata, customer source, uploader name snapshot,
   upload time and soft-removal reason/history. Keep old staff attachments readable.
2. Define idempotent upload identity and recovery across storage and metadata
   failures so retries do not create duplicate media or inaccessible orphan files.
   Inspect existing storage lifecycle before proposing retention/cleanup changes.

#### Both — API and database together

1. Upload an image and video and retry the same uploadId; return the same media
   item and one history effect. Test concurrent retries and dependent-write errors.
2. Reject unsupported signatures/types, configured oversize, unauthorized/foreign
   complaint or media IDs and stale versions without unintended persistence.
3. Verify private signed links expire, access is scoped, reasoned removal hides
   the item while retaining history, and legacy attachments remain readable.
4. Coordinate B19 media_added/media_removed events and portal progress/retry/gallery
   integration after publication; chosen display does not settle storage limits.

## B19 — Complete case history and editable solution

### Issue

**Proposed extension, not verified behavior.** Existing status/assignment/note/
reopen events do not cover all severity, link, employee, media or solution changes.
Current resolution is captured on transition to resolved; it cannot support the
requested draft-before-resolution and correction-after-resolution workflow.

### Expected result

Add an `events` entry, in the same write and with actor and
time, for every change:

| Event `type` | When |
| --- | --- |
| `created` | Intake (keep the current `status_change` → open entry for compatibility, or replace it) |
| `status_change`, `assignment`, `note`, `reopened` | As today |
| `severity_change` | Severity changed (`fromValue`/`toValue`) |
| `links_changed` | Appointment/invoice/barcodes/customer changed (before/after summary) |
| `employees_changed` | Employee targets replaced (added/removed IDs) |
| `media_added`, `media_removed` | B18 uploads and removals (file name; removal reason) |
| `solution_updated` | Solution drafted or corrected (body = new text) |

Include an actor name snapshot on events so the history reads correctly
without user-directory access.

**Solution.** Keep `resolution.summary` ("what the solution was") and
`resolution.actionTaken`. Allow `PATCH /complaints/{id}` with `resolution` alone
(no status change), using `If-Match`:
- while open, in progress or waiting on customer, to draft the solution;
- while resolved, to correct it;
- not after closing; a closed complaint is reopened first.

Resolving still requires a non-empty solution. Each change writes
`solution_updated`. `resolvedBy`/`resolvedAt` stay tied to the transition to resolved.

### Suggested action

#### API work

1. Implement the listed event types and before/after values with server actor
   name snapshots; expose an ordered readable history without directory access.
2. Support versioned resolution-only PATCH while open/in progress/waiting or
   resolved. Closed complaints must reopen first; resolving requires non-empty
   solution. Keep resolvedBy/resolvedAt tied to the resolved transition.
3. Publish event schemas, If-Match/412 behavior and solution-edit rules; do not
   present the proposal as an already-deployed write contract.

#### Database work

1. Persist each mutation and corresponding event atomically, preserving actor,
   time, values and historical compatibility. Coordinate media events with B18.
2. Inspect event ordering/versioning and retry identity; stale or aborted writes
   must leave neither changed case state nor a success event. Define any retained
   event migration explicitly without rewriting original history.

#### Both — API and database together

1. Exercise every listed change; read back one ordered attributable event per
   committed change, including solution drafting/correction and media removal reason.
2. Confirm stale If-Match returns 412 and persists nothing; test concurrent edits,
   dependent failure and exact retry according to the published command contract.
3. Verify drafting before resolution, correction while resolved, denial after
   close until reopening, required solution on resolve, and stable transition
   actor/time. Retained category/target/attachment history stays usable.

## Example intake requests (proposed shape)

```json
{
  "category": "appointment", "callerName": "Ana Pérez", "callerPhone": "2015551234",
  "appointmentId": 18342,
  "subject": "Charged more than quoted", "description": "Quoted $40; driver charged $60.",
  "details": { "topic": "pricing", "quoted_amount": 40, "charged_amount": 60 },
  "targets": [{ "kind": "employee", "employeeId": 17 }]
}
```

```json
{
  "category": "delivery", "callerName": "Luis Gómez", "callerPhone": "3475550000",
  "invoiceNumber": "INV-20931", "barcodeNumbers": ["209310001", "209310002"],
  "subject": "Two boxes arrived crushed", "description": "Corners crushed and contents broken.",
  "details": { "topic": "damaged" },
  "targets": []
}
```

```json
{
  "category": "general", "callerName": "María Díaz", "callerPhone": "9175550101",
  "subject": "Office staff was rude", "description": "Front desk refused to help.",
  "details": { "topic": "employee_behavior" },
  "targets": [{ "kind": "employee", "employeeId": 23 }]
}
```

## Current source compatibility baseline

- `GET /complaint-categories` returns eight generic built-ins from
  `builtInCategories()`: `appointment`, `delivery`, `billing`,
  `customer_service`, `progress`, `quality`, `general`, `other`. Their detail
  schemas do not match the business topics:
  - `appointment`: requires `appointment_ref` and `issue` ∈ late, no-show,
    cancelled, rescheduled, wrong service.
  - `delivery`: requires `order_ref` and `issue` ∈ late, missing, damaged,
    wrong item, never arrived. There is no invoice or barcode field.
  - `general`: requires free-text `issue_summary`.
  - Billing, customer service, progress and quality are separate categories.
- Target kinds are `employee`, `appointment`, `order`, `invoice` and `other`.
  `validateTargets` requires 1–30 targets. `order` is ambiguous in EMSYS,
  where code historically calls appointments "orders".
- The complaint stores no customer/sender link. Caller name and phone are
  free text.
- `other` cannot be deactivated. Tenant overrides from
  `PUT /admin/complaint-categories/{key}` take precedence over built-ins with
  the same key. Insights group by `category` only.

## Portal rollout responsibilities

The portal keeps its current complaint model until then. Afterwards, intake becomes:

- **Type first:** three buttons, General / Appointment / Delivery.
- **Appointment:** a customer (sender) search using the existing customer
  picker, then a list of that sender's appointments (`POST /pickups/search` by
  `sender.id`, newest first), then an employee multi-select (0+).
- **Delivery:** an invoice search (number, sender name or phone), then optional
  barcode checkboxes from that invoice, then an employee multi-select (0+).
- **General:** an employee multi-select (0+).
- Then the topic (English/Spanish labels), caller, subject, description,
  severity, and media upload with progress and retry (B18).
- **Detail view:** the status badge and actions (existing), a full case history
  timeline with the B19 event types, a media gallery (image preview, video
  player, signed links), and a solution panel that can be edited until closed.
- **Table:** filters by type, topic, customer, invoice and employee; the old
  `order` target kind is no longer offered.

## Execution and completion evidence

Use approved isolated non-production fixtures, a real Firebase JWT in
`Authorization: Bearer <token>` and `x-company-id: <authorized company>`.
Preserve actual branch/assignment scope and current permission enforcement.
Do not reset retained complaints or tenant category overrides during verification.

Return one standalone Markdown report with B17/B18/B19, source and deployed
revisions/environment/date, executed and skipped cases, sanitized requests/responses,
actor permissions/company scope, persisted before/after values, event/retry/failure
results, storage configuration without credentials, and migration/dry-run results.
List any business changes to proposed topics, schemas, SLA defaults or file limits.
Distinguish local tests, deployed acceptance, served contracts and portal rollout;
keep failed, skipped or unresolved requirements open.
