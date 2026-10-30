# Portal stale update protection

Invoice and customer editors, deletes and customer nested metadata writes now send
the captured parent `version` as a strongly quoted If-Match. Reads must provide
`v1:` plus 64 lowercase hex characters. Missing local versions fail before HTTP.
The API rejects missing preconditions with 428, malformed with 400 and stale with
412. Localized 412/428 messages preserve editor input for review.

Open editors pin their original data across background invalidation. Bulk deletes
capture each row version when opening confirmation and use independent bounded
requests with explicit partial successes. Creation and payment append requests do
not receive blanket parent headers. Existing numeric document/inventory versions
retain their current contracts.

Deploy with the companion API change and update alternate clients before enabling
mandatory preconditions. Already-open unversioned forms must reopen; never refresh
a token immediately before save. No automatic stale-save retries are added.

The API repository owns `docs/contracts/stale-update-protection.md` and the
reproducible `mutation-concurrency-matrix.csv` audit. Remaining financial,
permission and operational mutation gaps are recorded there; this change does not
claim comprehensive concurrency enforcement across the application.

Tests cover captured invoice/customer/nested preconditions, rejection without a
local version, partial bulk results and a browser fixture using the shared pinned
snapshot hook to retain drafts across background refresh and conflict feedback.
