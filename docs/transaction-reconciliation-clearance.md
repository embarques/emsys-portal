# Independent reconciliation and clearance

Status: **proposed backend contract; portal implementation prepared locally**.
This implements the separate Accounting queues requested on November 4, 2026.
The supplied transaction-lifecycle TODO is the source of the business distinction.
The new wire fields and clearance command below are a proposed integration
contract for the backend change, not verified deployed API behavior.

This supersedes statements in `pending-transactions-update.md` that reconciliation
is the sole cleared status. Neither queue is constrained to today's closeout.

## Workspaces and meaning

- **Pending Reconciliation** retains `/accounting/pending-financial-activity`.
  The company has not yet verified custody of money or supporting documents.
- **Pending Clearance** uses `/accounting/pending-clearance`. The financial
  channel has not yet settled or verified the payment.
- Today's Transactions retains `/accounting/daily-income` and historical browsing.

A journal can be in both queues. Reconciling removes it only from the first;
clearing removes it only from the second. A reconciled payment can still await
clearance, and a cleared payment can still await reconciliation. Cash or other
transactions without a settlement step have clearance status `NOT_REQUIRED`.
The backend determines which transactions require settlement; the frontend does
not infer that from payment method or reuse legacy payment `status` fields.

Closing a closeout freezes financial entries but does not prevent later
reconciliation or clearance. These commands append audited events without
changing transaction date, original closeout, amounts, assignee, payment method,
invoice association, or invoice balances. No reopening is required.

## Journal response and search

Keep `reconciliationStatus: OUTSTANDING | RECONCILED` independent of:

```ts
clearanceStatus?: "NOT_REQUIRED" | "OUTSTANDING" | "CLEARED";
clearedAt?: string | null;
clearedBy?: { id: string | number; name: string } | null;
allowedActions?: {
  edit?: boolean; void?: boolean; reverse?: boolean; correct?: boolean;
  clear?: boolean;
};
restrictionReason?: string;
```

Return these fields consistently in journal list/detail responses. Missing or
unknown clearance status is displayed as unavailable, never inferred from
reconciliation. Clearance action eligibility requires `allowedActions.clear === true`.

`POST /v1/journals/search` must allow `clearanceStatus` (`eq`, `neq`) in addition
to the existing journal filters. The two queues use separate mandatory AND
filters outside user OR groups:

- Reconciliation: `reconciliationStatus eq OUTSTANDING`.
- Clearance: `clearanceStatus eq OUTSTANDING`.

No closeout/date filter is injected. Pagination, sorting, search, totals and
tenant/branch authorization remain server-side. Counts use the same search with
`page: 1, limit: 1`, reading `total`; they do not download the queue. The sidebar
group count counts pending tasks, so a transaction in both queues counts twice.

## Commands and authorization

Viewing either queue requires `canViewJournal` on `journal`, matching journal
search, summary and the sidebar gate. Keep `canReconcileJournal` for
`POST /v1/journals/reconcile`. Add and seed **`canClearJournal`** on `journal`
for the proposed **`POST /v1/journals/clear`** command. There is no legacy
reconciliation/update/payment permission fallback for journal clearance.

Clearance request:

```json
{ "requestId": "stable-uuid", "ids": ["journal-id"] }
```

Response follows the existing command envelope:

```json
{ "success": true, "data": { "cleared": ["journal-id"], "clearedAt": "ISO timestamp" } }
```

The frontend caps batches at 200 journals of one payment method, shows
server-calculated selected totals by currency, and asks for confirmation. It
preserves the command/request ID on failure and serializes submissions. Changing
selection or filters creates a new command. Backend must revalidate grants,
company/branch access, effective transaction status, correction approvals,
clearance eligibility and the batch limit atomically; append audit history and
make request IDs idempotent. A closed closeout alone must not reject settlement.
Reject voided/reversed or otherwise ineligible records with no partial writes.
Legacy payment-clearing APIs must never be substituted for this command.

Clearance refreshes company-scoped journal lists, selected summaries, both
queue counts and existing detail caches for the affected journal IDs. It does
not invalidate invoice balances or the whole application.
Reconciliation keeps its existing invalidation behavior.

## Financial corrections

This change adds the two queues, not the full void/reverse/correct workflow.
Cleared journals and explicit `allowedActions.edit: false` block direct edits in
addition to existing current-open-closeout and reconciliation restrictions.
Backend must enforce the supplied TODO's financial edit/void invariants, retain
records instead of hard deletion, implement optimistic concurrency and atomic
current-closeout reversals/corrections, and audit each action. A ledger reversal
must never be presented as an actual bank refund or settlement reversal.

Existing auto-reconcile remains reconciliation only; it must not implicitly
clear a payment. Legacy payment directories and any invoice-clearance overrides
need coordinated backend migration; they are not repurposed by these queues.

## Release requirements

Deploy the response/search/command changes and seed the independent clearance
grant before enabling the new clearance workflow in a release. Verify queue
independence, closed-period commands, idempotent retries, concurrency, audit
events, denied permissions and tenant isolation in an approved non-production
environment. Local mocked tests cannot verify those backend invariants.
