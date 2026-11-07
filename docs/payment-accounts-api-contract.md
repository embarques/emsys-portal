# Payment accounts — remaining gaps

See [backend-api-gaps.md](backend-api-gaps.md) for confirmed defects and the
[current API schema](../api-docs.json) for request/response shapes.

## Cash and bank account acceptance

- Provide a valid persisted CASH ON HAND hierarchy and posting child in the
  mock company. Only orphan ASSET 4, Cash Account, is available for cash lookup.
- Verify chosen cash posting/readback for PAYMENT, SALES and INITIAL-PAYMENT
  on create/sync/update, including omitted-account defaults and sync replay.
- Verify cash expenses credit a valid selected cash source and preserve it on read.
- Cover inactive, non-posting, nonexistent, spoofed, cross-company and cross-branch
  accounts, plus deep ancestry, on each applicable create/sync/update path.
- Verify occupied codes, exhausted ranges, concurrent allocation and
  wrong-parent rejection.
- Verify BANK type/deletion protection, allowed parents, cycles and report roll-ups.

## Deferred invoice receipts

- Verify method/account corrections adjust only the correct invoice
  receipt effect, with no double application, cross-closeout movement or partial
  write. Cover concurrency, failed settlement and replay across lifecycle states.
- Confirm feature-flag enablement and live catalog IDs are safe for every affected
  client before enabling selected cash accounts broadly.
