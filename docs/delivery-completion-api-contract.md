# Delivery completion — remaining gaps

## Route contract decisions

- Verify midnight rollover and unfinished barcode route-removal semantics.
- Agree the DR daily-route versus legacy numeric delivery identity and any
  required migration before changing route IDs in review/completion/signature
  requests. Confirm whether legacy delivery-document naming still needs atomic
  sequence allocation; do not infer a supported endpoint from the desired UI.

## Completion acceptance

- Resolve zero-cost invoices omitting their financial fields on readback and
  returning 409 on completion. Preserve fail-closed handling for genuinely
  unknown balances.
- Verify negative, unavailable/invalid balances and linked uncleared receipts.
- Prove balance/receipt checks participate in the same atomic operation as
  completion when invoice finances change concurrently.
- Verify foreign, duplicate, stale or mismatched embedded/catalog pieces are
  rejected without partial writes.
- Verify policy agreement, collector-owned optional photos, private signature
  storage, metadata-only reads and absence of saved receipts on rejection.
- Verify concurrent UUID replay returns the committed result without duplicate
  receipts or delivery effects.
- Verify assigned-only permissions, revoked crew membership and tenant scope.
  The published completion contract has no uncleared-payment override.

Use [api-docs.json](../api-docs.json) for wire fields and
[backend-api-gaps.md](backend-api-gaps.md) for current backend defects.
