# EMSYS API — Request payloads (copy/paste reference)

Use this document when wiring the Next.js client to `emsys-api`.

**Portal implementation**

| Concern | Location |
|---------|----------|
| Shared address / branch / role builders | `src/lib/api/payloads.ts` |
| List query strings (`page`, `limit`, `sort`, filters) | `src/lib/api/list-query.ts` — see `API-List-Query.md` |
| Customers | `src/lib/customers/api/customers-api.ts` |
| Employees | `src/lib/employees/api/employees-api.ts` |
| Users | `src/lib/users/api/users-api.ts` |
| Branches | `src/lib/branches/api/branches-api.ts` |
| Pickups (orders) | `src/lib/orders/api/orders-api.ts` |
| API base URL | `src/lib/api/base-url.ts` (`NEXT_PUBLIC_API_BASE_URL`) |

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
  "data": { },
  "meta": { }
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

| Type | Resources | Example |
|------|-----------|---------|
| MongoDB ObjectID (24-char hex) | `customers`, `invoices`, `journals`, `trucks`, `employee-groups`, `route-assignments`, `pickups/route` | `"674a1b2c3d4e5f6789012345"` |
| `uint16` | `users`, `roles`, `permissions`, `branches`, `employees` | `1` |
| `uint32` | `containers`, `deliveries`, `barcodes`, `pickups`, `income-statements` | `42` |

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
  "sort": [
    { "field": "name", "direction": "asc" }
  ]
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
  "permissions": [
    { "id": 26 },
    { "id": 27 },
    { "id": 28 }
  ]
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
  "cost": 1500.00,
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

### `POST /v1/pickups`

Uses `CreatePickupRequest` (legacy-friendly). **Required:** `sender.name`.

```json
{
  "date": "2026-06-10",
  "branch": { "id": 1, "code": "NYC" },
  "employee": {
    "id": 5,
    "name": "Jane Driver",
    "phone1": "555-2000",
    "active": true
  },
  "sender": {
    "name": "Sender Name",
    "customerType": 1,
    "phone1": "555-3000",
    "email": "sender@example.com",
    "IDNumber": "111",
    "address": {
      "address1": "10 Oak Ave",
      "city": "Bronx",
      "state": "NY",
      "zipcode": "10451"
    }
  },
  "receiver": {
    "name": "Receiver Name",
    "customerType": 2,
    "phone1": "555-4000",
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

### `PUT /v1/pickups/{id}`

Same `CreatePickupRequest` shape. `{id}` = numeric.

### Pickup routes — `POST /v1/pickups/route`

At least one of `states`, `cities`, `zipCodes`, `zipRanges` is required.

```json
{
  "name": "Bronx NY",
  "states": ["NY"],
  "cities": [
    { "cityName": "Bronx", "stateCode": "NY" }
  ],
  "zipCodes": ["10451", "10452"],
  "zipRanges": [
    { "start": "10400", "end": "10499" }
  ]
}
```

### `PUT /v1/pickups/route/{id}`

Same shape. `{id}` = ObjectID hex.

### `GET /v1/pickups/search-by-route`

Query only (no body):

```
GET /v1/pickups/search-by-route?routeId=<pickup_route_object_id>&page=1&limit=40
```

---

## Invoices — permission: `invoice`

### `POST /v1/invoices`

Uses `CreateInvoiceRequest`. **Required:** `number`, `employee`, `container`, `sender`.

```json
{
  "number": "INV-1001",
  "date": "2026-06-10",
  "branch": { "id": 1, "code": "NYC" },
  "cost": 120.00,
  "payment": 20.00,
  "balance": 100.00,
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
  "sender": {
    "name": "Sender Co",
    "customerType": 1,
    "phone1": "555-1000",
    "IDNumber": "123",
    "address": {
      "city": "Miami",
      "state": "FL",
      "zipcode": "33101"
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
      "price": 50.00,
      "total": 100.00
    }
  ]
}
```

### `PUT /v1/invoices/{id}`

Full `Invoice` model (not `CreateInvoiceRequest`). `{id}` = ObjectID hex.

```json
{
  "number": "INV-1001",
  "cost": 120.00,
  "payment": 50.00,
  "balance": 70.00,
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

**Example — SALES:**

```json
{
  "transactionType": "SALES",
  "amount": 45.00,
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
  "amount": 50.00,
  "invoiceId": "674a1b2c3d4e5f6789012345",
  "paymentMethod": { "id": 1, "name": "CASH" },
  "description": "Invoice payment"
}
```

**Example — EXPENSE:**

```json
{
  "transactionType": "EXPENSE",
  "amount": 25.00,
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

## Trucks — permission: `truck`

### `POST /v1/trucks`

```json
{
  "truckId": "TRK-001",
  "name": "Truck 1",
  "vin": "1HGCM82633A004352",
  "year": 2022,
  "fuelType": "diesel",
  "branch": "NYC"
}
```

### `PUT /v1/trucks/{id}`

Same shape. `{id}` = ObjectID hex.

---

## Employee groups — permission: `employee_group`

### `POST /v1/employee-groups`

```json
{
  "employeeGroupId": "EG-001",
  "name": "Morning Crew",
  "branch": "NYC",
  "employees": [
    { "id": 5, "name": "Jane Driver" },
    { "id": 6, "name": "Helper One" }
  ]
}
```

### `PUT /v1/employee-groups/{id}`

Same shape. `{id}` = ObjectID hex.

---

## Route assignments — permission: `route_assignment`

### `POST /v1/route-assignments`

```json
{
  "routeAssignmentId": "RA-2026-06-10",
  "name": "Monday Route",
  "date": "2026-06-10T08:00:00Z",
  "truck": { "id": "674a1b2c3d4e5f6789012345", "name": "Truck 1" },
  "employeeGroup": { "id": "674b2c3d4e5f6789012346", "name": "Morning Crew" }
}
```

### `PUT /v1/route-assignments/{id}`

Same shape. `{id}` = ObjectID hex.

---

## Endpoints with no request body

| Method | Path | Notes |
|--------|------|-------|
| GET | `/v1/health` | Public |
| GET | `/v1/health/db` | Public |
| GET | `/v1/version` | Public |
| GET | `/v1/users/me` | Auth only |
| GET | `/v1/users/permissions` | Tenant |
| GET | `/v1/<resource>` | List all — query params only |
| GET | `/v1/<resource>/{id}` | Retrieve |
| DELETE | `/v1/<resource>/{id}` | Delete |
| POST | `/v1/income-statements/{id}/close` | Close cuadre |
| POST | `/v1/income-statements/{id}/open` | Reopen cuadre |
| GET | `/v1/pickups/search-by-route` | Query: `routeId`, `page`, `limit` |

**`<resource>` plural paths:** `permissions`, `roles`, `branches`, `users`, `customers`, `employees`, `trucks`, `employee-groups`, `route-assignments`, `containers`, `deliveries`, `barcodes`, `pickups`, `invoices`, `journals`, `income-statements`.

---

## Permission keys by route (for 403 debugging)

| Path prefix | `resourceType` for RBAC |
|-------------|-------------------------|
| `/permissions`, `/branches` | `settings` |
| `/roles`, `/users` | `user` |
| `/customers` | `customer` |
| `/employees` | `employee` |
| `/containers` | `container` |
| `/deliveries` | `delivery` |
| `/barcodes` | `labels` |
| `/pickups` | `pickup` |
| `/invoices` | `invoice` |
| `/journals` | `journal` |
| `/income-statements` | `income_statement` |
| `/trucks` | `truck` |
| `/employee-groups` | `employee_group` |
| `/route-assignments` | `route_assignment` |

Actions: `view`, `create`, `update`, `delete`, `print` (checked via seeded permissions on the user's role).
