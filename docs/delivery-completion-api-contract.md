# Deliveries workspace: API contract

Portal route `/deliveries` (Routes sidebar). Barcodes stays barcode management only; delivery happens here.

## 1. Assigned barcodes list — NEW (not yet on the API)

```txt
GET  /v1/deliveries/assigned-barcodes?page=&limit=&sort=
POST /v1/deliveries/assigned-barcodes/search?page=&limit=&offset=   (Stripe-style query.Request body)
```

Register these before `GET /v1/deliveries/{id}`; today `GET /v1/deliveries/assigned-barcodes` is captured by the `{id}` route (401 without a token), and `/search` returns 404.

**Permission:** `canViewDelivery` (`delivery`).

**Scoping (server-side, required):**

- Resolve the authenticated user → employee via `employee.user.id`. No employee → empty list (not an error).
- Include barcodes whose `route.id` is a DR daily route (`/vehicle-routes`) whose `employees` contains that employee.
- Exclude delivered barcodes. The API owns the definition of "delivered" for the tenant (the portal does not hardcode a status name).
- Read invoice-embedded barcodes (the source of truth), not only the `/barcodes` catalog.

**Default sort:** `receiver.address.state:asc`, ties broken by `invoice.number`, then `number`, so one invoice's pieces stay together.

**Searchable / filterable fields:** `number`, `name`, `invoice.number`, `receiver.name`, `receiver.address.state`, `receiver.address.city`, `container.name`, `status.name`.

**Row shape** (barcode fields as in `barcode.Barcode`, plus the invoice receiver):

```json
{
  "id": 12,
  "barcodeId": "65f000000000000000000001",
  "number": "000123",
  "name": "Large box",
  "invoice": { "id": "68f800000000000000000001", "number": "INV-77" },
  "container": { "id": 3, "name": "C-3" },
  "status": { "id": 4, "name": "ALM-RD" },
  "route": { "id": "<daily route id>", "name": "1-64-26" },
  "receiver": {
    "name": "Maria Perez",
    "address": { "address1": "Calle 1 #5", "apartment": "2B", "city": "Santiago", "state": "Santiago", "zipcode": "51000" },
    "phones": [{ "number": "8095550101", "displayNumber": "(809) 555-0101", "type": "mobile", "isPrimary": true }]
  }
}
```

Envelope: the standard paginated `{ success, data, total, page, resultsPerPage }`.

## 2. Receiver signature — route exists; must accept the daily route id

**The DR daily route is the delivery.** Verified on live data (daily route `6aa44f19b2ff4651db4a3dee`, `1-64-26`, Sep 11 2026): the daily route has no delivery link, no `/deliveries` record exists for container `64-26`, and none of the container's 518 invoice barcodes has `delivery` set. Legacy `/deliveries` records (numeric id, same `trip-container` name, own employee list) are not created or linked by daily routes or barcode route assignment.

```txt
PUT /v1/deliveries/{dailyRouteId}/invoices/{invoiceId}/receiver/signature
```

- [ ] Accept the daily route id (24-character `/vehicle-routes` ObjectID) as the path's first id. The portal now sends the barcode `route.id`, not `delivery.id`.
- [ ] Validate that the invoice has barcodes assigned to that daily route, and that the caller's employee is in that daily route's `employees`.
- [ ] Optional: keep accepting a numeric legacy delivery id for older data, but don't require `barcode.delivery`.

```json
{
  "receiverSignature": {
    "signerName": "Pedro Ramirez",
    "idNumber": "001-1234567-8",
    "contentType": "image/png",
    "data": "<complete base64 signature image, no data: prefix>"
  }
}
```

(`/receiver-signature` with a hyphen does not exist.)

**`signerName` / `idNumber` are the delivery receiver** — whoever physically received the merchandise. They can differ from the invoice receiver party; do not validate them against `invoice.receiver` and never write them into `invoice.receiver`.

**Required behavior (atomic, one request, server-side):**

- **Always** save a `delivery_signature` invoice document for every delivery signature: the signature PNG, plus delivery receiver name, ID number, signing time, collecting user, and daily route id as document metadata.
- **Also** store it as the invoice receiver signature when that field is empty. Never overwrite an existing invoice receiver signature.
- The portal cannot see signatures on invoice responses and never makes either decision. Do not rely on a frontend existence check; concurrent drivers would race.
- Document the response: the created document id, and whether the invoice receiver signature was set by this request.
- The printed report ("Recibido por / Fecha / ID") reads the invoice receiver signature (the first delivery). Decide whether later deliveries should appear on it.

## 3. Status change — EXISTING invoice update

The portal applies the driver-selected status (from `GET /v1/barcodes/status-options`) to the group's barcodes through `PUT /v1/invoices/{id}` with patched `invoiceDetails[].barcodes[].status`, the same invoice-embedded path used elsewhere. Only barcodes not already at that status are sent; nothing is sent when all match. This requires `canUpdateInvoice`. The API should keep the `/barcodes` catalog in sync and drop delivered rows from the assigned list.

Order: signature first, then status. If the status write fails, the portal retries only the status; it does not resend the signature.

## 4. Delivery documents — EXISTING

`POST /v1/invoices/{id}/documents`, named `delivery_N` with the original extension. **Follow-up:** atomic per-invoice sequence allocation with a durable high-water mark after deletions.

## Portal permissions

| Action | Grants |
| --- | --- |
| See Deliveries | `canViewDelivery` |
| Deliver (group review, documents, signature, status) | `canUpdateDelivery`, `canViewInvoice`, `canUpdateInvoice` |
