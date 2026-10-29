# Signature API payloads (sender + delivery/receiver)

How the portal **saves** and **retrieves** signatures. Two signatures exist:

- **Sender signature** — captured on **invoice creation** (policy agreement).
- **Receiver signature** — captured on the **delivery completion** workflow.

Signature **image bytes are write-only**. They are sent to the API on save and
embedded server-side into the printed PDF. No read/list/completion response ever
returns the image; only metadata (`signerName`, timestamps, ids) comes back.

All requests use the central Axios client with `Authorization: Bearer <jwt>` and
`x-company-id`.

---

## Shared signature shape

`src/lib/invoices/schemas/customer-signature.schema.ts`

```jsonc
// customerSignature (sender)
{
  "signerName": "Ana Sender",
  "data": "<raw base64 PNG, no data: prefix>",   // ^[A-Za-z0-9+/]+={0,2}$
  "contentType": "image/png"
}

// receiverSignature = customerSignature + idNumber
{
  "signerName": "Pedro Ramirez",
  "idNumber": "001-1234567-8",
  "data": "<raw base64 PNG>",
  "contentType": "image/png"
}
```

`buildCustomerSignature(signerName, dataUrl)` strips the
`data:image/png;base64,` prefix and validates with the schema before sending.

---

## 1. Sender signature — SAVE (invoice creation)

- **Endpoint:** `POST /v1/invoices` (`API_ENDPOINTS.INVOICES`)
- **Code:** `createInvoice` in `src/lib/invoices/api/invoices-api.ts`; built in
  `invoice-form-wizard.tsx` → `invoice-form-workspace.tsx`
  (`context.customerSignature`).
- **When:** new invoice (not edit), policies included, signer did not skip, and a
  signature was drawn. Otherwise `customerSignature` is omitted.

```jsonc
POST /v1/invoices
{
  "...": "invoice write payload",
  "customerSignature": {
    "signerName": "Ana Sender",
    "data": "<raw base64 PNG>",
    "contentType": "image/png"
  }
}
```

The signer name defaults to the invoice `sender.name`. Update (`PUT`) does **not**
send `customerSignature`.

## 1b. Sender signature — RETRIEVE (print invoice)

Two calls, no image bytes returned to the portal:

1. **Options (metadata):** `POST /v1/reports/invoices/signature-options`
   (`fetchInvoiceSignatureOptions`). Returns per invoice:

   ```jsonc
   {
     "invoiceId": "<objectId>",
     "invoiceNumber": "80430",
     "senderSignature": { "signerName": "Ana Sender" } | null,
     "receiverSignatures": [ /* see §2b */ ]
   }
   ```

   `senderSignature !== null` means a sender signature is on file; the picker
   defaults `includeSender` to that.

2. **Generate PDF:** `POST /v1/reports/invoices` (`generateInvoiceReport`) with
   `signatureSelections`:

   ```jsonc
   {
     "type": "invoice",
     "collection": "invoices",
     "values": ["<invoiceId>", "..."],
     "lookup_field": "id",
     "signatureSelections": [
       { "invoiceId": "<objectId>", "includeSender": true, "receiverSignatureId": "" }
     ]
   }
   ```

   The report service embeds the stored sender image when `includeSender` is true.

---

## 2. Receiver signature — SAVE (delivery workflow)

Primary path is the **atomic completion** endpoint; a standalone PUT also exists.

- **Endpoint:** `POST /v1/deliveries/{deliveryId}/invoices/{invoiceId}/complete`
  (`API_ENDPOINTS.DELIVERY_COMPLETE`)
- **Code:** `completeDelivery` in `src/lib/deliveries/api/delivery-wizard-api.ts`;
  payload built in `src/lib/deliveries/hooks/use-delivery-wizard.ts`.

```jsonc
POST /v1/deliveries/{deliveryId}/invoices/{invoiceId}/complete
{
  "requestId": "<uuid>",            // idempotent replay key
  "barcodeIds": ["<objectId>"],
  "legacyBarcodeIds": [123],         // optional, older numeric pieces
  "documentIds": ["<objectId>"],     // optional photos, max 12
  "policyIds": [1],
  "agreed": true,
  "receiverSignature": {
    "signerName": "Pedro Ramirez",
    "idNumber": "001-1234567-8",
    "data": "<raw base64 PNG>",
    "contentType": "image/png"
  }
}
```

Response is metadata only: `{ invoiceId, deliveryId, signatureId, deliveredCount }`.

- **Standalone (optional):**
  `PUT /v1/deliveries/{deliveryId}/invoices/{invoiceId}/receiver/signature`
  (`saveInvoiceReceiverSignature`, body `{ deliveryId, receiverSignature }`).
  The wizard uses the atomic completion endpoint instead of this.

See `docs/delivery-completion-api-contract.md` for the full completion contract.

## 2b. Receiver signature — RETRIEVE (print)

Same two-step print flow as the sender. The options response lists receiver
signatures as metadata:

```jsonc
"receiverSignatures": [
  {
    "id": "<objectId | 'legacy'>",
    "deliveryId": "123",
    "deliveryName": "Ruta ...",
    "signerName": "Pedro Ramirez",
    "signedAt": "2026-10-28T12:00:00Z"
  }
]
```

The picker chooses one `receiverSignatureId` per invoice (default: newest for the
current numeric delivery, else first). `POST /v1/reports/invoices` embeds the
selected receiver image server-side.

---

## Verification status

| Flow | Save | Retrieve (print) | Status |
| --- | --- | --- | --- |
| Sender signature | `POST /invoices` `customerSignature` | `signature-options` + `reports/invoices` `includeSender` | Wired |
| Receiver signature | `POST .../complete` `receiverSignature` | `signature-options` + `reports/invoices` `receiverSignatureId` | Wired |

Notes / invariants:

- Images are never returned on read; the metadata-only options endpoint drives
  the print picker, and the PDF service loads image bytes server-side.
- Sender signature is saved on **create only**; invoice `PUT` never resends it.
- Base64 must be the raw payload (no `data:` prefix) and `contentType` must be
  `image/png`.
- After delivery completion the portal invalidates
  `queryKeys.invoices.signatureOptionsPrefix(companyId)` so the print picker sees
  the new receiver signature.
