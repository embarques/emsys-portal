# Closeouts — remaining verification

- Verify write-time `409 CLOSEOUT_REQUIRED` for stale open periods and a latest
  closed period.
- Verify server/location timezone boundaries independently of the browser date,
  rollover and caller-supplied branch/period references.
- Verify rollover serializes simultaneous first transactions.
- Verify rollover closes only the intended older rows without duplicate periods.
- Verify journal, invoice registration/payment, delivery-payment and loan flows
  retain drafts on setup cancellation/failure, cancel on context changes and
  never duplicate a committed operation after retry.
- Verify rollback when closure, creation or transaction posting fails; confirm
  returned closed-closeout lists and current/history cache refresh behavior.
- Verify branch/tenant permissions and currency/rate rules, including RD/DR/DO
  setup and other branches' USD/rate-1 behavior.
- Confirm retired scheduling jobs are disabled in deployment. Removing a portal
  setting does not establish that a previously deployed job has stopped.

Use isolated non-production fixtures or a natural date boundary; do not close
an existing shared period merely to force recovery.

See [backend gaps](backend-api-gaps.md) and [api-docs.json](../api-docs.json).
