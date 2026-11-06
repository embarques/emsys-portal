# Daily-route permissions and approval audit

## Deployment status — November 5, 2026

**Not aligned end to end.** “Street Team” means the employees assigned to a dated
**daily route**, not a route crew template or an inferred role name. The portal
has a prepared approval client, but the deployed API lacks its workflow endpoints
and permission grants. Frontend controls cannot provide server authorization,
atomic financial correction, optimistic concurrency or an immutable audit trail.

The supplied `api-docs.json` was already modified when this work started and was
left untouched. Its 242 paths match the live paths at
[Scalar OpenAPI](https://api.embarqueros.com/scalar/openapi.json), linked from
[Scalar](https://api.embarqueros.com/scalar/).

Authenticated probes used the supplied administrator session and mock company via
`https://api.embarqueros.com/scalar-api/v1`. Direct `/v1` probes were blocked by the
edge firewall; those responses were not used to infer endpoint availability.
After the user authorized mock-data writes, submission/review probes were also
run. No valid source-record mutation or financial deletion was sent.

| Check | Observed result | Meaning |
| --- | --- | --- |
| `GET /users/permissions` | 200; no workflow grants for this account | Authentication works; this session cannot run the proposed approval workflow |
| Complete paginated `/permissions` catalog | No `canOperateDailyRoute`, `canManageDailyRouteRecords`, `canCreateChangeRequest`, `canViewChangeRequest`, or `canApproveChangeRequest` | Grants expected by the existing portal implementation are not seeded in this deployment |
| `GET /change-requests` | 404 `Route not found` | Shared request list is unavailable |
| `GET /change-requests/:id` | 404 `Route not found` using a nonexistent ID | Detail route is unavailable; distinct from a missing-record response |
| `GET /change-requests/target` | 404 `Route not found` for invoice, journal, barcode and dispatch targets | No target access/version/action context is available |
| `POST /change-requests` | 404 `Route not found`, empty-payload probe | Submission route is unavailable; valid submission cannot be exercised |
| `POST /change-requests/:id/approve` and `/reject` | 404 `Route not found`, nonexistent-ID probes | Neither review route is deployed |
| Pickup list | 403: user lacks a linked pickup employee or all-pickup grant | This account cannot establish assigned-route pickup behavior |
| Invoice, journal and barcode lists, one row each | 200; sampled rows omit `allowedActions` and `version` | Effective-action/concurrency controls are not supplied on these samples |
| Inventory dispatch list, one row | 200; sample has `version: 0`, no `allowedActions` | Inventory's numeric revision is not the string source-version contract used by the prepared change-request client |
| Published `DELETE /journals/{id}` | Described as removing the journal document | Published behavior conflicts with “no hard deletion”; actual deletion was not executed |

The readiness suite reports **5 passed / 15 failed prerequisites** when write
probes are enabled. These are readiness findings, not fifteen independently
proven authorization vulnerabilities. A missing OpenAPI field alone does not
prove the absence of an undocumented server policy.

## Portal changes

- Request navigation is available from pickup, invoice, journal, barcode and
  inventory-dispatch detail views when the API grants request creation. Navigating
  does not grant submission: the request screen must resolve target access first.
- Requests require a matching resource and ID, a nonempty saved source version,
  and an explicit backend `request_update` or `request_void` action. Missing
  metadata, failed/refetching targets and mismatched selections block submission.
- React Hook Form/Zod validate reasons and supported updates. VOID omits proposed
  changes. A pending request never invokes a source-resource PUT/DELETE.
- Submissions are serialized. Retry preserves the entire original command,
  including its request ID and source version, even if target metadata refreshes.
  Editing the input starts a new command. Failed submits/reviews retain input.
- Query keys separate company, actor, role and permissions; queries wait for
  transport company/token readiness. Mutation handlers recheck grants and current
  transport company. Approval refreshes affected resource caches and dependent
  accounting/invoice/inventory queues; rejection refreshes request metadata only.
- Existing unscoped resource cache keys are included in refreshes only while the
  initiating company is still active. Migration of all legacy query keys is
  separate work; this change does not certify global tenant-cache isolation.
- Daily-route operators without `canManageDailyRouteRecords` cannot approve
  requests, including with a legacy approval grant. Direct journal lifecycle
  controls also stay hidden for those operators. Authorized management keeps
  its separately granted controls; role names are not used as authorization.
- Pickup detail edit/delete controls now honor their separate grants. Journal
  hard-delete UI, mutation hook and API helper were removed; existing audited
  void/reversal controls remain dependent on server actions and versions.

The prepared request adapter still uses the existing resource tokens `pickup`,
`invoice`, `journal`, `labels`, `inventory`; `inventory` currently means an
inventory **dispatch**. Its editor currently supports pickup purpose, invoice
receiver name, journal description/amount, barcode description and dispatch notes.
It is not a general editor for every resource field or inventory document type.
The API must publish and agree on its target identifiers, permitted field paths,
version representation, review payload and effective-action response before
expanding this adapter. No missing endpoint or version convention was invented.

## Required backend acceptance tests

Run with separate employee, supervisor and authorized admin/owner identities and
isolated fixtures. The supplied administrator token cannot substitute for those
actors. These tests remain **unverified** until the workflow is deployed:

| Requirement | Observable acceptance test |
| --- | --- |
| Shared policy on all five resources | Exercise create/read/request_update/request_void/approve_change/update/void independently; validate permissions and record status server-side |
| Assigned-route scope | Employee A cannot list/search/get/create against employee B's route, including by changing IDs, filters, pagination, branch or company headers; revoked assignment takes effect on subsequent requests |
| Protected records | Employee direct PUT/PATCH/DELETE/void attempts are denied even with legacy update/delete grants; creation on an assigned route remains valid subject to domain rules |
| Request lifecycle | UPDATE/VOID submission leaves the original unchanged; rejection leaves it unchanged; authorized approval changes the source and request status together |
| Optimistic concurrency | Mutate the source or revoke requester assignment/grants after submission; stale approval fails without partially changing the source or request |
| Active, unreconciled closeout | Authorized approved corrections apply consistently to journals, invoice balances, payment queues, totals and inventory where relevant |
| Closed closeout | Original transaction remains immutable; approval posts linked reversing/adjustment entries into the active closeout without reopening history |
| Reconciled or cleared transaction | Controlled reversal/adjustment is required regardless of closeout status; original reconciliation/clearance evidence is retained |
| Idempotency and concurrency | Repeating or concurrently approving a request applies it once; duplicate reversals are prevented; retry retrieves the committed result |
| Audit and atomicity | Verify immutable requester/reviewer/reason/version/timestamps and linked corrections; inject transaction failure and assert complete rollback |
| Effective permissions | Lists and detail/target context agree on allowed actions; missing/malformed action metadata never enables a protected frontend command |

Backend migrations, indexes, permission seeding and deployment are outside this
portal checkout. See also [financial-controls.md](financial-controls.md) and
[daily-route-accountability.md](daily-route-accountability.md).

## Reproduction and local validation

The new suite defaults to GET requests and never prints tokens or record contents:

```sh
# Set EMSYS_TOKEN and EMSYS_COMPANY_ID securely in the environment.
node scripts/test-daily-route-approvals-api.mjs --bearer \
  --company "$EMSYS_COMPANY_ID" \
  --base-url https://api.embarqueros.com/scalar-api/v1

# Approved mock companies only: add --write-probes for invalid submission/review probes.
```

Validation includes focused permission/command/cache tests and a mocked Chromium
workflow for denied actions, changed target IDs, whitespace reasons, duplicate
submissions, stable retries after version refresh, viewer access and stale review
failures. The fixture tests frontend behavior; it does not prove backend policy.
No list-wide downloads or per-record permission queries were added to resource
screens: request navigation is a link, and target lookup runs only on the request
screen. No measured latency or bundle-size improvement is claimed.

Checks run for this change:

- Focused command/permission/cache tests: **19 passed**.
- Mocked Chromium workflow: **passed** (Chromium required an unsandboxed launch
  because macOS denied its sandboxed process startup).
- `npx tsc --noEmit`: **passed**.
- `npm run lint`: **0 errors, 97 warnings**; the changed request form also passes
  focused ESLint without warnings.
- `npm run build -- --webpack`: **passed**, with the existing named package-version
  import warning in `about-dialog.tsx`.
- Full unit suite: **454 passed / 3 failed**. The same three failures reproduce
  from an unchanged `dev` archive: two Add transaction display expectations in
  `daily-income-start-display.test.mjs`, and the pending-section permission
  expectation in `financial-activity.test.mjs`.
- Script syntax, changed JSON files and `git diff --check`: **passed**.

Changes are local on `feat/daily-route-permissions-alignment`; no commit, push,
backend deployment, permission seeding or migration was performed.
