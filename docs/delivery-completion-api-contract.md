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
  "delivery": { "id": 5, "name": "Delivery 5" },
  "receiver": {
    "name": "Maria Perez",
    "address": { "address1": "Calle 1 #5", "apartment": "2B", "city": "Santiago", "state": "Santiago", "zipcode": "51000" },
    "phones": [{ "number": "8095550101", "displayNumber": "(809) 555-0101", "type": "mobile", "isPrimary": true }]
  }
}
```

Envelope: the standard paginated `{ success, data, total, page, resultsPerPage }`.

## 2. Receiver signature — barcode delivery ID

`PUT /v1/deliveries/{deliveryId}/invoices/{invoiceId}/receiver/signature`

`deliveryId` is the numeric `delivery.id` on the selected barcode, not its DR `route.id`. An invoice can have items assigned to different deliveries. Review and status changes are scoped to both the selected daily route and selected delivery. Missing delivery assignment blocks collection.

```json
{
  "deliveryId": 5,
  "receiverSignature": {
    "signerName": "Pedro Ramirez",
    "idNumber": "001-1234567-8",
    "contentType": "image/png",
    "data": "<complete raw base64 PNG>"
  }
}
```

The API validates invoice membership in that barcode delivery and appends a private receipt with a generated signature ID, delivery ID/name, server signing date and collecting user. Identical retries for that delivery preserve the original receipt. Another delivery has its own receipt; recipients can differ from the invoice customer. No image is returned to the portal or stored as an extra public invoice document.

See the API's `docs/contracts/delivery-receiver-signature.md` and `invoice-print-signatures.md`. Existing delivery update permission applies. The response contains only invoiceId/deliveryId. Maximum 100 receipts and 8 MiB encoded receipt data per invoice; excess returns 422.

Invoice batch printing opens one Choose signatures dialog (five rows per page). Sender-only is the initial batch default; applying latest receiver to all is explicit. Printing from a delivery defaults to the latest receipt matching barcode delivery.id. Users can choose a different saved receipt or none. The picker fetches only metadata in one batch request; print requests send signature IDs. Signature images and the actual signer's ID are loaded server-side only during PDF generation. No preview.

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
