# Existing NY/DR branch follow-up — November 14, 2026

The existing NY branch is **1**; DR/RD is **2**. This follow-up uses the supplied
company/actor. Except for the explicitly approved normal rollover, mutations
were limited to newly created mock records. Existing branch settings, identities
and merchandise were not changed or deleted. The user explicitly approved normal NY rollover: existing period
32736 was closed and today’s period 32738 was created. Legacy OPEN period 4
remains open. The API reference remains read-only.

## Newly verified; remove these from pending scope

**V14 device claims: 17 passing checks.** A new temporary NY role/user/Firebase
identity received exactly two newly generated reservations, P-01031 and P-01032.
The actual device workflow established persisted non-null receivedAt:

- Claiming returns the owned numbers and timestamps; exact request replay keeps
  their identities. Management search hides claimed tokens/device identifiers.
- For a persisted non-null timestamp, date-only eq/neq/gte/lte match the current
  server business day. Timestamp comparisons one second before/after the saved
  instant include/exclude it correctly.
- Another device cannot return them. The correct device can return them, which
  clears receivedAt; old proof is rejected. Both saved readbacks remain null.
- Both numbers were returned to the unassigned pool. Only the new API user **161**
  and role **89** were deleted, along with the temporary Firebase identity.

**V14 tied pages and allocation changes: five passing checks.** The two generated
records have a real identical createdAt. One-row pages cover both without overlap
across an allocation change on one owned number; concurrent repeated pages are
stable. A number-sorted cursor rejects a changed nonmatching text filter with
400. The temporary allocation was returned to the unassigned pool.

These controls narrow V14. Actual midnight/DST, other authorized company contexts,
unsupported/unspecified branch scope, sort-key mutation races and broader cursor
binding/consistency still need evidence. Company-wide pools do not acquire an
invented branch filter merely because a test identity belongs to NY.

**V13 current NY controls: two passing checks.** Server context reports the
business date/timezone; posting with no current NY period returns
409 CLOSEOUT_REQUIRED. This establishes the current stale gate, not an injected
clock crossing or atomic rollover/rollback acceptance.

## Existing-branch financial prerequisites

Before the approved rollover, read-only context returned:

| Branch | Current period | Latest period | Current reason |
| --- | --- | --- | --- |
| NY / 1 | null | 32736, business date November 13, open | STALE_OPEN_CLOSEOUT |
| DR / 2 | null | 32650, business date July 4, closed | LATEST_CLOSED |

NY has an existing eligible legacy LOAN account **7** and cash account **1**.
Missing layer-3 templates blocked creating an eligible account in an isolated
branch; they do **not** establish that this existing NY account is unusable.
The active-NY current-period prerequisite has now been satisfied by the approved rollover.

The user explicitly approved the normal NY rollover. POST /income-statements
created **32738** for November 14, USD/rate 1, and returned **32736** as closed.
Independent readback confirms 32738 is current/open and 32736 closed. Legacy
uppercase OPEN period **4** remains open; it was not manually altered. The
modeler subsequently confirmed that legacy periods belong in a separate one-time
migration, not normal rollover. The API backend team should document that
migration before execution. No manual period close/reopen endpoint was used.

### B12 — Active NY lifecycle now verified

Using existing LOAN account 7 and cash account 1, new tagged employee **273**
received mock loan **5**: $1 issue, $0.25 increase and $1.25 repayment. Concurrent
same-UUID calls and exact retries returned the same increase transaction **10**
and journal **6af89ad631a295cf38084344**. Changed-payload UUID reuse returned 409
without changing the loan. All linked issue/increase/payment journals belong to
NY/current period 32738. The final loan is PAID, principal/paidAmount both $1.25,
zero remaining balance and exactly three retained transactions (9/10/11).

An authorized exact retry after PAID also returns transaction 10 and the original
journal with the current paid loan, without an extra transaction. Remove these
variants from B12's pending scope. After-period-closure retry, other actors,
independent logical-command races and injected failure remain separate.

Two initial loan assertions incorrectly expected a wire type INCREASE. Source
and actual API use **LOAN** for both disbursements, which the portal normalizes to
ISSUE. Corrected checks use the committed result IDs. A follow-up raw-JSON check
also incorrectly required an explicit balance:0; the source's omitempty omits
zero. The real portal normalizer derives zero from principalAmount-paidAmount.
All **three corrected checks pass** against captured live responses. Original raw
results, review corrections and correctedAssertions are retained; these harness
errors are not backend defects.

### B16 / V07 / V10 — Current NY invoice results

The current-period invoice run has **seven passing assertions** and one real
remaining mismatch: embedded status CONDUCE is still absent/not applied after a
successful invoice PUT. Configured NY default status **1** now applies correctly
to every new piece; remove the blanket “new pieces lose default status” defect.
Missing default configuration in synthetic branches was a different prerequisite.

Ordinary unpaid invoice creation, explicit employee receivedBy, embedded route
assignment, explicit route:null removal and embed/catalog route agreement pass.
These are not actual CONDUCE/delivered lock or nonempty shared-trip membership tests.

A further **nine assertions pass**: explicit non-DR pickup-route receivedBy has no
nested crew and preserves piece identities; zero-payment financial registration
reaches PENDING, completes via the real portal PUT with the original invoice ID/
number, retains cost/balance $0.02 and payment zero, generates two default-status
pieces and replays the original registration to the same journal/invoice IDs.
Its zero journal stays in NY/32738. No invoice cash/bank collection was posted.

Retained current fixtures: invoice **6af89af131a295cf38084349**, container **1418**,
customer **6af89af131a295cf3808434a**, employee **274**, vehicle
**6af89af031a295cf38084348**, delivery route **6af89af231a295cf38084350** and pickup
route **6af89bde31a295cf38084352**. Unpaid completion retains invoice
**6af89be031a295cf38084353** and journal **6af89be031a295cf38084354**. All are new
mock records; none replaces existing business data.

DR has no current period either. Opening one needs an actor in that branch and
explicit correct currency/rate setup; the historical July peso/60 row is not
assumed to be today's exchange-rate policy. No existing user's branch was changed.

## Unpaid invoice attempt and retained mock directory records

The reference method's comment describes an invoice-date open period. The live
control rejected an ordinary unpaid invoice even when its date matched open
period 32736: HTTP **409**, requiring an open income statement for the branch/date.
The implementation's open-only lookup actually requires a current active window
or today's open row. A stale open row is not a usable current prerequisite.
This is **not** classified as a new backend defect.

No invoice was created and no payment journal was posted. The fixture directory
setup is retained under marker
`CODEX-NY-INVOICE-b129e163-d71a-4e25-9e25-7b435b99330d`:

- Container **1417**.
- Employee **272**.
- Vehicle **6af898ed31a295cf38084331**.

The runner was corrected to require a current period before creating directory
fixtures. Its successful current-period retry and one remaining embedded-status
failure are recorded above. Unsafe numeric bulk assignment was not sent:
the reference resolves invoice-local numeric IDs globally before owner validation,
so selecting a number without a unique owned-record control is inappropriate.

## Remaining scope after this follow-up

- **B12/F04:** after-period-closure retry, remaining actor/eligibility/error and
  atomicity cases, final publication and activation. Basic NY issue/increase/
  concurrent-exact-replay/repayment/after-PAID cases are verified, not pending.
- **B16:** embedded CONDUCE write/readback, unconfigured-generation blocking,
  authoritative admin-only default/catalog UI and removal of portal fallbacks,
  plus selected transition/trip integration. Configured NY defaults already work.
- **V07:** actual CONDUCE/delivered locks, nonempty membership, return/reassignment,
  legacy and completion races. Basic current NY null-removal/mirror controls pass.
- **V10:** assigned-only own/foreign customer/pickup negatives, revocation, broader
  initial-payment/method/clearance effects and other actor contexts. Unpaid completion
  and both explicit receivedBy positives now pass. The old branch-11 fixture is
  superseded by the valid active NY control; it was not a special business rule.
  No DR-specific acceptance is claimed from an NY actor.
- **V06:** unique identity/eligibility remains unresolved; active branches do not
  remove the global numeric-ID ambiguity. No unsafe bulk write was attempted.
- **V13:** current stale gate and normal NY rollover are verified. In-flight
  midnight/DST/failure rollback remain. Legacy periods belong in a separate
  one-time migration; backend migration documentation is pending, not the policy decision.
- **V14:** only broader boundary/context/sort-key mutation cases remain; current-day
  non-null comparisons, device return, tied paging and one filter-bound cursor pass.
- Other direct-history, legacy-service and representative-load assertions still
  require their specific backend controls. Branch substitution cannot establish them.

## Reproduction and evidence

Use EMSYS_TOKEN in the process environment; credentials are never written to
reports. The scripts accept --bearer and --company as usual:

```bash
node scripts/test-active-pool-claim-api.mjs --bearer --write-fixtures --output /tmp/ny-pool.json
node scripts/test-active-invoice-gaps-api.mjs --bearer --write-fixtures --output /tmp/ny-invoices.json
# Variant runner consumes the saved dated owned-fixture manifests:
node scripts/test-active-invoice-variants-api.mjs --bearer --write-fixtures --output /tmp/ny-variants.json
# Only after explicit approval for shared NY period rollover:
node scripts/test-active-branch-gaps-api.mjs --bearer --write-fixtures --allow-rollover --output /tmp/ny-loans.json
```

- backend-gap-active-ny-preflight-2026-11-14.json: current NY clock and rejected
  stale-period posting; intentional stop before unapproved rollover.
- backend-gap-active-ny-invoice-2026-11-14.json: initial stale-period invoice
  rejection, exact payload and retained owned directory fixture IDs.
- backend-gap-active-ny-pool-2026-11-14.json: 17 passing device-claim controls and
  own-identity cleanup, with proof tokens redacted.
- backend-gap-active-ny-cursor-2026-11-14.json: five passing tie/filter/allocation
  and restoration controls on only the two generated numbers.
- backend-gap-active-branch-readback-2026-11-14.json: independent check of rejected
  invoice rollback, unchanged period lifecycle, own identity deletion and unassigned
  number state. Its actual outcomes are authoritative over cleanup assumptions.

Additional artifacts:

- backend-gap-active-ny-loan-2026-11-14.json: approved rollover, live lifecycle,
  initial assertions and captured requests/results.
- backend-gap-active-ny-loan-review-2026-11-14.json: original checks plus explicit
  reviewed identity/omitted-zero corrections; correctedAssertions is authoritative.
- backend-gap-active-ny-invoice-current-2026-11-14.json: seven passing controls and
  actual embedded CONDUCE readback failure in configured NY.
- backend-gap-active-ny-invoice-variants-2026-11-14.json: nine passing receivedBy/
  unpaid completion and replay assertions.
- backend-gap-active-post-rollover-readback-2026-11-14.json: independent current/
  old-period, paid loan/journal and completed unpaid-registration readback.

Pre-rollover independent readback passed **9/9** checks. Post-rollover independent
readback passed **10/10** checks; the before/after period states are recorded
separately and must not be confused.
New runner syntax and focused lint passed. Application code is unchanged in this
follow-up; the earlier type/build/unit checks were not rerun unnecessarily.
