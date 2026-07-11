# EMSYS API — Request payloads (copy/paste reference)

Use this document when wiring the Next.js client to `emsys-api`.

**Portal implementation**

| Concern                                               | Location                                               |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Shared address / branch / role builders               | `src/lib/api/payloads.ts`                              |
| List query strings (`page`, `limit`, `sort`, filters) | `src/lib/api/list-query.ts` — see `API-List-Query.md`  |
| Customers                                             | `src/lib/customers/api/customers-api.ts`               |
| Employees                                             | `src/lib/employees/api/employees-api.ts`               |
| Users                                                 | `src/lib/users/api/users-api.ts`                       |
| Branches                                              | `src/lib/branches/api/branches-api.ts`                 |
| Pickups (orders)                                      | `src/lib/orders/api/orders-api.ts`                     |
| API base URL                                          | `src/lib/api/base-url.ts` (`NEXT_PUBLIC_API_BASE_URL`) |

The portal calls the API **directly** from the browser (no Next.js `/api` proxy). Ensure API CORS allows your portal origin.

Modules not yet on the API (invoices, containers, etc.) should follow the payloads in this file when migrated.

---

## Global conventions

**Base URL (local):** `http://localhost:8080`  
**Base path:** `/v1` (not `/api` or `/api/v1`)

**Headers (tenant routes):**

```http
Authorization: Bearer <firebase_id_token>
X-Company-ID: <company_object_id_hex>
Content-Type: application/json
```

**Success envelope:**

```json
{
  "success": true,
  "message": "Request successful",
  "data": {},
  "meta": {}
}
```

**Error envelope:**

```json
{
  "success": false,
  "message": "Invalid request",
  "data": null,
  "error": "details here"
}
```

**JSON field names:** camelCase (`customerType`, `phone1`, `IDNumber`).

**Do not wrap bodies** in `{ "data": { ... } }` — send the resource object directly.

**ID types:**

| Type                           | Resources                                                                                                      | Example                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| MongoDB ObjectID (24-char hex) | `customers`, `invoices`, `journals`, `vehicles`, `routes`, `vehicle-routes`, `pickups/route` | `"674a1b2c3d4e5f6789012345"` |
| `uint16`                       | `users`, `roles`, `permissions`, `branches`, `employees`                                                       | `1`                          |
| `uint32`                       | `containers`, `deliveries`, `barcodes`, `pickups`, `income-statements`                                         | `42`                         |

**On create:** omit `id` (server assigns). Do not send `"id": ""`.

**Legacy compatibility (customer create/update):** `branch` may be a string code (`"NYC"`) or object; `idNumber` is accepted as alias for `IDNumber`.

---

## Shared types

### Address

```json
{
  "address1": "123 Main St",
  "address2": "",
  "apartment": "4B",
  "city": "Miami",
  "state": "FL",
  "zipcode": "33101",
  "country": "US"
}
```

### BranchDTO (embedded reference)

```json
{
  "id": 1,
  "name": "Main Branch",
  "code": "NYC"
}
```

### List all — `GET /<resource>`

Query params (all optional):

```
?field=name&operator=contains&value=acme&page=1&offset=0&limit=40&sort=name:asc
```

Operators: `eq`, `neq`, `contains`, `startsWith`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte`.

### Search — `POST /<resource>/search`

Body (all fields optional):

```json
{
  "field": "name",
  "operator": "contains",
  "value": "acme",
  "filters": [
    {
      "operator": "and",
      "filters": [
        { "field": "active", "operator": "eq", "value": true },
        { "field": "customerType", "operator": "eq", "value": 1 }
      ]
    }
  ],
  "pagination": { "page": 1, "offset": 0, "limit": 40 },
  "sort": [{ "field": "name", "direction": "asc" }]
}
```

Flat pagination also works: `"page": 1, "offset": 0, "limit": 40`.

---

## Authentication

### `POST /v1/auth/token` (development only)

```json
{
  "email": "you@example.com",
  "password": "your-password"
}
```

Or UID flow:

```json
{
  "uid": "firebase_uid_here"
}
```

### `GET /v1/users/me`

No body.

### `GET /v1/users/permissions`

No body. Returns current user's role + permission summaries.

---

## Customers — permission: `customer`

### `POST /v1/customers`

```json
{
  "name": "Acme Corp",
  "customerType": 1,
  "phone1": "555-0100",
  "phone2": "",
  "email": "acme@example.com",
  "active": true,
  "IDNumber": "123456789",
  "notes": "",
  "branch": { "id": 1, "code": "NYC", "name": "New York" },
  "address": {
    "address1": "123 Main St",
    "city": "Miami",
    "state": "FL",
    "zipcode": "33101",
    "country": "US"
  }
}
```

`customerType`: `1` = sender, `2` = receiver.

`accountBalance` is returned as a numeric field on customer list/detail responses and is
displayed by the portal as USD currency. Backend source review on `2026-07-11`
confirmed it is a stored customer value accepted on create/update, not a
frontend-derived ledger balance from invoices, payments, or journal entries. The
portal should trust the customer payload as the display source until a dedicated
accounting balance endpoint is introduced.

### `PUT /v1/customers/{id}`

Same shape as create. `{id}` = 24-char hex ObjectID.

### `GET /v1/customers/{id}` · `DELETE /v1/customers/{id}`

No body.

---

## Users — permission: `user`

### `POST /v1/users`

```json
{
  "uid": "firebase_uid_from_auth",
  "email": "user@example.com",
  "userName": "jdoe",
  "fullName": "John Doe",
  "active": true,
  "branch": { "id": 1, "name": "Main", "code": "NYC" },
  "role": {
    "id": 1,
    "name": "Administrador",
    "active": true
  }
}
```

### `PUT /v1/users/{id}`

Same shape. `{id}` = numeric `uint16`.

### `GET /v1/users/uid/{uid}`

No body. `{uid}` = Firebase UID string.

---

## Roles — permission: `user`

### `POST /v1/roles`

```json
{
  "name": "Manager",
  "active": true,
  "permissions": [{ "id": 26 }, { "id": 27 }, { "id": 28 }]
}
```

### `PUT /v1/roles/{id}`

Same shape. `{id}` = numeric.

---

## Permissions — permission: `settings`

### `POST /v1/permissions`

```json
{
  "name": "canViewCustomer",
  "resourceType": "customer",
  "create": false,
  "view": true,
  "update": false,
  "delete": false,
  "print": false
}
```

### `PUT /v1/permissions/{id}`

Same shape.

---

## Branches — permission: `settings`

### `POST /v1/branches`

```json
{
  "name": "New York Office",
  "type": "office",
  "code": "NYC",
  "phone1": "555-1000",
  "phone2": "",
  "disclaimer": "",
  "logo": "",
  "address": {
    "address1": "100 Broadway",
    "city": "New York",
    "state": "NY",
    "zipcode": "10005",
    "country": "US"
  },
  "settings": {
    "labelPrefix": "NYC",
    "roundDecimalPlaces": 2,
    "defaultLabelStatus": 1
  }
}
```

### `PUT /v1/branches/{id}`

Same shape. `{id}` = numeric.

---

## Employees — permission: `employee`

### `POST /v1/employees`

```json
{
  "name": "Jane Driver",
  "title": "Driver",
  "department": "Delivery",
  "phone1": "555-2000",
  "email": "jane@example.com",
  "active": true,
  "branch": { "id": 1, "code": "NYC" },
  "address": {
    "city": "Bronx",
    "state": "NY",
    "zipcode": "10451"
  }
}
```

### `PUT /v1/employees/{id}`

Same shape. `{id}` = numeric.

---

## Containers — permission: `container`

### `POST /v1/containers`

```json
{
  "name": "Container A",
  "booking": "BK-1001",
  "containerNumber": "MSCU1234567",
  "sealNumber": "SEAL-99",
  "broker": "Broker Co",
  "company": "Shipping Co",
  "cost": 1500.0,
  "departureDate": "2026-06-01T00:00:00Z",
  "arrivalDate": "2026-06-15T00:00:00Z"
}
```

### `PUT /v1/containers/{id}`

Same shape. `{id}` = numeric `uint32`.

---

## Deliveries — permission: `delivery`

### `POST /v1/deliveries`

```json
{
  "name": "Route 1",
  "date": "2026-06-10T08:00:00Z",
  "container": {
    "id": 1,
    "name": "Container A",
    "containerNumber": "MSCU1234567"
  },
  "employee": {
    "id": 5,
    "name": "Jane Driver"
  },
  "helper1": { "id": 6, "name": "Helper One" },
  "helper2": null
}
```

### `PUT /v1/deliveries/{id}`

Same shape. `{id}` = numeric.

---

## Barcodes (labels) — permission: `labels`

### `POST /v1/barcodes`

```json
{
  "number": "LBL-00001",
  "status": { "id": 1, "name": "CREATED" },
  "container": { "id": 1, "name": "Container A" },
  "delivery": { "id": 1, "name": "Route 1" }
}
```

### `PUT /v1/barcodes/{id}`

Same shape. `{id}` = numeric.

---

## Pickups — permission: `pickup`

### `GET /v1/pickups`

The pickup read model uses `createdBy` and optional `updatedBy` as canonical audit actors. `employee` and `sector` are optional on list/detail reads. `route.name` is optional; `route.id` is enough for assignment and display can fall back to the route lookup or the id.

### `POST /v1/pickups`

Uses `CreatePickupRequest`. **Required:** `sender.name`.
Sender and receiver payloads send phone numbers in `phones[]`. Keep `phones[]`
on create/update so pickup saves do not replace the linked customer's saved
phone list with an empty array.

```json
{
  "date": "2026-06-10",
  "branch": { "id": 1, "code": "NYC" },
  "employee": {
    "id": 5,
    "name": "Jane Driver",
    "active": true
  },
  "sender": {
    "name": "Sender Name",
    "customerType": 1,
    "phones": [
      { "type": "mobile", "number": "555-3000", "isPrimary": true }
    ],
    "email": "sender@example.com",
    "IDNumber": "111",
    "address": {
      "id": "6a4e77a9940040f71266fc29",
      "address1": "10 Oak Ave",
      "city": "Bronx",
      "state": "NY",
      "zipcode": "10451",
      "location": { "type": "Point", "coordinates": [-73.9, 40.8] },
      "verification": { "is_verified": true, "verified_at": "2026-07-08T16:15:36.233Z" }
    }
  },
  "receiver": {
    "name": "Receiver Name",
    "customerType": 2,
    "phones": [
      { "type": "mobile", "number": "555-4000", "isPrimary": true }
    ],
    "address": {
      "city": "Miami",
      "state": "FL",
      "zipcode": "33101"
    }
  },
  "purpose": "Pickup boxes",
  "sector": { "id": 1, "name": "North" },
  "comments": [
    {
      "purpose": "Boxes",
      "unit": "pcs",
      "quantity": 3,
      "description": "Medium boxes"
    }
  ]
}
```

Party address snapshots (`sender.address` / `receiver.address`) should round-trip `id`, `location`, and `verification` when provided. Portal sends them on create/update; live create responses have been observed returning only street fields plus placeholder `id` `000000000000000000000000` (tracked in GitHub #73).

### `PUT /v1/pickups/{id}`

Same `CreatePickupRequest` shape. `{id}` = numeric. Set `"route": null` to clear a scheduled vehicle-route assignment.

### Pickup routes — `POST /v1/pickups/route`

At least one of `states`, `cities`, `zipCodes`, `zipRanges` is required.

```json
{
  "name": "Bronx NY",
  "states": ["NY"],
  "cities": [{ "cityName": "Bronx", "stateCode": "NY" }],
  "zipCodes": ["10451", "10452"],
  "zipRanges": [{ "start": "10400", "end": "10499" }]
}
```

### `PUT /v1/pickups/route/{id}`

Same shape. `{id}` = ObjectID hex. Body: `{ "pickupIds": [1, 2, 3] }` assigns pickups to the scheduled route.

To unassign, use `PUT /v1/pickups/{pickupId}` with `"route": null` on each pickup (the API does not support `DELETE` on this path).

### `GET /v1/pickups/search-by-route`

Query only (no body):

```
GET /v1/pickups/search-by-route?routeId=<pickup_route_object_id>&page=1&limit=40
```

---

## Invoices — permission: `invoice`

### `POST /v1/invoices`

Uses `CreateInvoiceRequest`. **Required:** `number`, `employee`, `container`, `sender`.
The portal also sends `pickupSource` and exactly one pickup assignment:
`routeId` for route pickups, or `pickupEmployeeId` + `officeBranchId` for
warehouse/office pickups. Denormalized employee and branch names are included
when available so edit/preview can round-trip display labels.

```json
{
  "number": "INV-1001",
  "date": "2026-06-10",
  "branch": { "id": 1, "code": "NYC" },
  "cost": 120.0,
  "payment": 20.0,
  "balance": 100.0,
  "discount": 0,
  "surcharge": 0,
  "paidRegion": "",
  "paidStatus": "PARTIAL",
  "employee": {
    "id": 5,
    "name": "Tasador",
    "userName": "tasador1",
    "fullName": "Main Tasador"
  },
  "container": {
    "id": 1,
    "name": "Container A"
  },
  "pickupSource": "route",
  "routeId": "6a52bcb0b1c2d3e4f5678901",
  "sender": {
    "name": "Sender Co",
    "customerType": 1,
    "phone1": "555-1000",
    "IDNumber": "123",
    "address": {
      "id": "6a4e77a9940040f71266fc29",
      "city": "Miami",
      "state": "FL",
      "zipcode": "33101",
      "location": { "type": "Point", "coordinates": [-80.2, 25.8] },
      "verification": { "is_verified": true, "verified_at": "2026-07-08T16:15:36.233Z" }
    }
  },
  "receiver": {
    "name": "Receiver Co",
    "customerType": 2,
    "phone1": "555-2000"
  },
  "invoiceDetails": [
    {
      "name": "Shipping",
      "quantity": 2,
      "labels": 2,
      "price": 50.0,
      "total": 100.0
    }
  ]
}
```

Invoice party address snapshots should round-trip `id`, `location`, and `verification` the same way as pickups when the API shares that embedding path (see GitHub #73).

### `PUT /v1/invoices/{id}`

Full `Invoice` model (not `CreateInvoiceRequest`). `{id}` = ObjectID hex.
Uses the same `pickupSource` assignment rule as create.

```json
{
  "number": "INV-1001",
  "cost": 120.0,
  "payment": 50.0,
  "balance": 70.0,
  "pickupSource": "warehouse",
  "pickupEmployeeId": "42",
  "pickupEmployeeName": "Warehouse Employee",
  "officeBranchId": "1",
  "officeBranchName": "USA",
  "isVoid": false,
  "sender": { "name": "Sender Co", "customerType": 1 },
  "container": { "id": 1, "name": "Container A" }
}
```

---

## Journals — permission: `journal`

### `POST /v1/journals` (post accounting entry)

Uses `PostEntryRequest`. **Required:** `transactionType`.

**Transaction types:** `PAYMENT`, `SALES`, `EXPENSE`, `DISCOUNT`, `SURCHARGE`, `TRANSFER`, `LOAN`, `LOAN-PAYMENT`, `REFUND`, `VOID`, `COMMISSION`, `OTHER`, `INITIAL-PAYMENT`.

### New invoice wizard Daily Income registration

Before `POST /v1/invoices`, the portal searches for the invoice's initial registration:

```http
POST /v1/journals/search
```

```json
{
  "operator": "and",
  "filters": [
    { "field": "invoice.number", "operator": "eq", "value": "INV-1001" },
    { "field": "transactionType", "operator": "eq", "value": "INITIAL-PAYMENT" }
  ],
  "pagination": { "page": 1, "limit": 1, "offset": 0 },
  "sort": [{ "field": "createdAt", "direction": "desc" }]
}
```

This lookup is global within the authenticated company. It is not restricted by Daily Income date or status; a historical registration, including one in a closed Daily Income, authorizes the invoice to continue.

When missing, the wizard may create the registration only in today's open Daily Income for the current branch. A zero payment is valid and does not require `paymentMethod` or `paymentAccount`:

```json
{
  "incomeStatementId": 123,
  "incomeStatement": { "id": 123 },
  "date": "2026-06-10",
  "transactionType": "INITIAL-PAYMENT",
  "amount": 0,
  "refNumber": "",
  "description": "Initial invoice registration",
  "currency": "USD",
  "rate": 1,
  "employee": { "id": 5, "name": "Tasador" },
  "invoice": {
    "number": "INV-1001",
    "cost": 120,
    "discount": 0
  },
  "sender": { "id": "sender-id", "name": "Sender Co" },
  "receivers": [{ "id": "receiver-id", "name": "Receiver Co" }]
}
```

The API should enforce one `INITIAL-PAYMENT` registration per company, income statement, and invoice number. The invoice wizard uses the returned journal amount as the authoritative payment total.

**Example — SALES:**

```json
{
  "transactionType": "SALES",
  "amount": 45.0,
  "date": "2026-06-10",
  "description": "Counter sale",
  "refNumber": "REF-001",
  "account": { "id": 400, "name": "Sales", "type": "REVENUE" }
}
```

**Example — PAYMENT (invoice payment):**

```json
{
  "transactionType": "PAYMENT",
  "amount": 50.0,
  "invoiceId": "674a1b2c3d4e5f6789012345",
  "paymentMethod": { "id": 1, "name": "CASH" },
  "description": "Invoice payment"
}
```

**Example — EXPENSE:**

```json
{
  "transactionType": "EXPENSE",
  "amount": 25.0,
  "description": "Office supplies",
  "account": { "id": 500, "name": "Supplies", "type": "EXPENSE" },
  "sourceAccount": { "id": 1, "name": "CASH ON HAND", "type": "ASSET" }
}
```

### `PUT /v1/journals/{id}`

Same `PostEntryRequest` shape. `{id}` = ObjectID hex.

---

## Income statements (cuadre) — permission: `income_statement`

### `POST /v1/income-statements`

ID is auto-assigned. **Required:** `branch` with `id`.

```json
{
  "date": "2026-06-10T00:00:00Z",
  "branch": { "id": 1, "name": "Main Branch", "code": "NYC" },
  "currency": "USD",
  "rate": 1,
  "container": { "id": 1, "name": "Container A" },
  "delivery": { "id": 1, "name": "Route 1" }
}
```

### `PUT /v1/income-statements/{id}`

Same shape (do not send `status` / `summaryTotal` — use Close/Open). `{id}` = numeric.

### `POST /v1/income-statements/{id}/close`

No body.

### `POST /v1/income-statements/{id}/open`

No body.

---

## Vehicles — permission: `vehicle`

### `POST /v1/vehicles`

```json
{
  "vehicleId": "VEH-001",
  "name": "Vehicle 1",
  "licensePlate": "NY-48291",
  "vin": "1HGCM82633A004352",
  "year": 2022,
  "fuelType": "diesel",
  "branch": { "id": 1, "code": "NYC" },
  "active": true
}
```

A vehicle belongs to a branch. `branch` is a branch ref `{ id, code }` (`id` is the branch `uint16` from `/v1/branches`), same shape as employees/pickups. `vehicleId` is the business code (server-assigned on create). `active` is a boolean (`true` = active, `false` = disabled; defaults to `true`), matching the employee/customer `active` field. Response returns `branch` as the same `{ id, code }` object.

### `PUT /v1/vehicles/{id}`

Same shape. `{id}` = ObjectID hex.

---

## Vehicle routes — permission: `vehicle_route`

Pickup and delivery schedules share **`/v1/vehicle-routes`**. Discriminate with `routeType`:

- `"pickup"` — calendar date or recurring `dayOfWeek`; no `container`
- `"delivery"` — requires `container`; date-based

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/vehicle-routes` | List |
| POST | `/vehicle-routes` | Create |
| GET | `/vehicle-routes/{id}` | Retrieve |
| PUT | `/vehicle-routes/{id}` | Update |
| DELETE | `/vehicle-routes/{id}` | Delete |
| POST | `/vehicle-routes/search` | Search/filter (always scope with `routeType` eq `pickup` or `delivery`) |

There are **no** separate `/pickup-routes` or `/delivery-routes` endpoints.

### `POST /v1/vehicle-routes` — pickup example

```json
{
  "routeType": "pickup",
  "active": true,
  "branch": { "id": 1, "code": "NY", "name": "Embarque Tenares" },
  "date": "2026-06-10T00:00:00Z",
  "route": { "id": "674a1b2c3d4e5f6789012346", "name": "Jane Driver-Vehicle 1" },
  "driver": { "id": 5, "name": "Jane Driver" },
  "appraiser": { "id": 6, "name": "Helper One" },
  "employees": [
    { "id": 5, "name": "Jane Driver", "role": "driver" },
    { "id": 6, "name": "Helper One", "role": "appraiser" }
  ]
}
```

### `POST /v1/vehicle-routes` — delivery example

```json
{
  "routeType": "delivery",
  "active": true,
  "branch": { "id": 2, "code": "RD", "name": "Embarque RD" },
  "container": { "id": 25, "number": "CONT-25" },
  "date": "2026-06-10T00:00:00Z",
  "route": { "id": "674a1b2c3d4e5f6789012348", "name": "Driver A-Truck 2" },
  "driver": { "id": 8, "name": "Driver A" },
  "appraiser": { "id": 9, "name": "Helper B" },
  "employees": [
    { "id": 8, "name": "Driver A", "role": "driver" },
    { "id": 9, "name": "Helper B", "role": "appraiser" }
  ]
}
```

`route.id` is the Mongo ObjectId from `/routes`. Pickup `name` is server-generated when omitted; delivery `name` is always server-generated.

### `GET /v1/vehicle-routes/{id}` — record shape

```json
{
  "id": "674a1b2c3d4e5f6789012345",
  "routeType": "pickup",
  "name": "2026-06-10-Jane Driver-Helper One-Vehicle 1",
  "active": true,
  "branch": { "id": 1, "code": "NY", "name": "Embarque Tenares" },
  "date": "2026-06-10",
  "route": {
    "id": "674a1b2c3d4e5f6789012346",
    "name": "Jane Driver-Helper One-Vehicle 1",
    "routeId": "R-1042"
  },
  "driver": { "id": 5, "name": "Jane Driver" },
  "appraiser": { "id": 6, "name": "Helper One" },
  "employees": [
    { "id": 5, "name": "Jane Driver", "role": "driver" },
    { "id": 6, "name": "Helper One", "role": "appraiser" }
  ],
  "createdAt": "2026-06-10T14:22:00Z",
  "createdBy": "Admin User",
  "updatedAt": "2026-06-10T14:22:00Z",
  "updatedBy": "Admin User"
}
```

### `PUT /v1/vehicle-routes/{id}`

Same write shape. `{id}` = ObjectID hex.

Lookup: `POST /v1/vehicle-routes/search` with `routeType` and filters on `date`, `container.id` (delivery), `branch.id`, `active`, etc.

---

## Routes — permission: `route`

### `POST /v1/routes`

`name` and `routeId` are generated by the API on create — do not send them. Date and container belong on **pickup routes** or **delivery routes**, not routes.

```json
{
  "vehicle": {
    "id": "674a1b2c3d4e5f6789012345",
    "name": "Vehicle 1",
    "branch": "usa"
  },
  "employees": [
    { "id": 5, "name": "Jane Driver" },
    { "id": 6, "name": "Helper One" }
  ]
}
```

Response includes server-generated `name` (`employee1-employee2-…-vehicle` naming convention) and `routeId`. Date and container belong on **pickup routes** or **delivery routes**, not routes.

### `PUT /v1/routes/{id}`

Same write shape. `{id}` = ObjectID hex.

---

## Endpoints with no request body

| Method | Path                               | Notes                             |
| ------ | ---------------------------------- | --------------------------------- |
| GET    | `/v1/health`                       | Public                            |
| GET    | `/v1/health/db`                    | Public                            |
| GET    | `/v1/version`                      | Public                            |
| GET    | `/v1/users/me`                     | Auth only                         |
| GET    | `/v1/users/permissions`            | Tenant                            |
| GET    | `/v1/<resource>`                   | List all — query params only      |
| GET    | `/v1/<resource>/{id}`              | Retrieve                          |
| DELETE | `/v1/<resource>/{id}`              | Delete                            |
| POST   | `/v1/income-statements/{id}/close` | Close cuadre                      |
| POST   | `/v1/income-statements/{id}/open`  | Reopen cuadre                     |
| GET    | `/v1/pickups/search-by-route`      | Query: `routeId`, `page`, `limit` |

**`<resource>` plural paths:** `permissions`, `roles`, `branches`, `users`, `customers`, `employees`, `vehicles`, `routes`, `vehicle-routes`, `containers`, `deliveries`, `barcodes`, `pickups`, `invoices`, `journals`, `income-statements`.

---

## Permission keys by route (for 403 debugging)

| Path prefix                          | `resourceType` for RBAC |
| ------------------------------------ | ----------------------- |
| `/permissions`, `/branches`          | `settings`              |
| `/roles`, `/users`                   | `user`                  |
| `/customers`                         | `customer`              |
| `/employees`                         | `employee`              |
| `/containers`                        | `container`             |
| `/deliveries`                        | `delivery`              |
| `/barcodes`                          | `labels`                |
| `/pickups`                           | `pickup`                |
| `/invoices`                          | `invoice`               |
| `/journals`                          | `journal`               |
| `/income-statements`                 | `income_statement`      |
| `/vehicles`                          | `vehicle`               |
| `/routes`                            | `route`                 |
| `/vehicle-routes`                    | `vehicle_route`         |

Actions: `view`, `create`, `update`, `delete`, `print` (checked via seeded permissions on the user's role).
