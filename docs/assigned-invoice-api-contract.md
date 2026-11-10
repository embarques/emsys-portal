# Assigned invoices — remaining gaps

- Verify appointment ownership, revoked assignment, sender and allowed receivers,
  linked customer identity and enforced container/receivedBy rules. Include
  customer-negative requests and assignment-revocation races.
- Verify replay after invoice deletion returns a conflict without recreation.
- Verify the portal's actual entry point uses the supported restricted contract
  and cover remaining permission combinations.
- Clarify `canOperateDailyRoute` compatibility: adding it activates the protected
  daily-route guard and returns 403. Establish the intended assigned-create path
  for operators without granting unrelated management privileges.
- Verify branch configuration and `receivedBy` requirements against the
  published assigned-create contract. Earlier tests in isolated custom-code
  branch 11 returned branch-association 400s despite an explicit branch and
  branch-assigned user; explicit receivedBy variants also returned generic 400.
  Those cases were not rerun in the November 7 verification, so do not mark
  them resolved solely from the backend's implementation report.
- Verify any initial payment uses its separately authorized journal receipt and
  cannot duplicate financial effects on invoice retry.

See the [API schema](../api-docs.json) and
[backend gaps](backend-api-gaps.md). Generic 400 responses do not establish
correct ownership or customer validation.
