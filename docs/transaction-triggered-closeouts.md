> Portal addition: Daily Income's Add transaction now uses the documented
> `POST /income-statements` to create today's closeout before opening transaction
> entry when the server's current lookup is absent or closed. The request contains
> branch/currency/rate, with no client date. RD setup prompts for currency/rate;
> other branches use USD/1. This is distinct from recovery of a draft rejected
> during submission, whose exact error contract remains unconfirmed.

> Update 2026-10-26: The supplied backend summary says **explicit creation** of
> today's closeout closes older open periods. This supersedes the proposal below
> that transaction rejection itself closes them. Creation uses the server date and
> branch timezone; only RD prompts for currency/rate and other branches use USD/1.
> The exact endpoint, error envelope, grants, and response still need verification
> from the updated backend contract before portal recovery can be connected.

# Transaction-triggered closeouts

Status: **partly verified live November 5, 2026**. Current-closeout lookup,
calendar context, retired manual lifecycle guards and server-selected journal
location are deployed. The transaction-time `409 CLOSEOUT_REQUIRED` envelope,
rollover ordering/concurrency and the published documentation remain open.
Do not infer additional endpoints or a live error envelope from the requested
behavior below.

## Live verification — November 5, 2026

Focused GET and authorized mock-journal mutation probes used company
`64d5c0b0d1eab2aaf30b1819`, user 73, whose profile location is branch 1.

| Check | Observed result |
| --- | --- |
| `GET /income-statements/current?branchId=1` | `200`, open closeout **32691**, `businessDate: 2026-11-05`, IANA `timezone: America/New_York`, USD/rate 1. Period boundaries are `2026-11-05T05:00:00Z` through `2026-11-06T05:00:00Z`. |
| `GET /income-statements/context?branchId=1` | `200`, `data` contains `today`, `serverTimezone`, `serverTime`, `current`, `previous`, `latest`. Today's current/latest is 32691; previous is closed 32690. This route is observed live and consumed by `fetchCloseoutCalendar`, not inferred from a proposal. |
| Branch 2 read-only lookups | `/current?branchId=2` returns `200`, `data: null`. `/context?branchId=2` returns `current: null`, closed latest/previous **32650**, and `requiredReason: LATEST_CLOSED`. Its returned `serverTimezone` was `America/New_York`; no independent branch-timezone configuration validation was performed. |
| `POST /income-statements/2147483647/close` and `/open` | Both return `409 closeout lifecycle is server-managed; open today’s closeout with currency and exchange rate when required`. A nonexistent numeric ID exercises the retirement guard without risking an existing period. No live closeout was opened or closed. |
| Journal with branch omitted | One-cent CASH SALES posts to closeout **32691**; GET resolves branch 1. |
| Journal with `branch: { id: 2 }` | Same result: closeout **32691**, branch 1. The caller's profile location remains authoritative even though branch 2 lacks today's closeout. |
| Published Swagger | HTTP `200`, 242 paths. `/income-statements/current` and `/income-statements/context` are absent; the spec contains no `CLOSEOUT_REQUIRED`. Old `/income-statements/{id}/open` and `/close` remain documented, and POST create still has the generic older create description. |

**`409 CLOSEOUT_REQUIRED` remains unverified.** Branch 2's `requiredReason`
is a calendar response, not evidence of that write-conflict status/code/envelope.
The available user is located in branch 1, which already has today's open
closeout. Overriding the journal's branch cannot exercise branch 2's condition.
A valid follow-up needs a separately authorized user actually located in a
branch without a current closeout, or the first transaction across a real
server-timezone date boundary. No user location, clock, existing closeout or
branch configuration was changed to manufacture the condition.

Portal source currently consumes the context route and opens rollover recovery
only for an Axios HTTP 409 with `response.data.data.code === CLOSEOUT_REQUIRED`.
That shape is a **local integration assumption**, not a verified live error.
`node --test tests/unit/closeout-calendar.test.mjs` passed **3/3**: creation
omits the client date/branch in the standard create path, nullable calendar
metadata is preserved, and unrelated conflicts do not trigger recovery. These
mocked tests do not prove server concurrency or the real conflict envelope.

Cleanup: both one-cent SALES probes were reversed successfully. Labeled
originals/reversals remain under `ZZ_CLOSEOUT_PROBE_20261105_1793900225189`.
Current lookup after the probes still returned the same open closeout 32691.
No new closeout was created.

The remaining sections describe requested lifecycle behavior and acceptance
criteria unless explicitly verified above. The historical design notes at the
top are not evidence that transaction-time closure or retry semantics are live.

## Transaction operation

- Resolve the authorized company and location on the server.
- Compute today from the server clock in the location's timezone.
- Create the transaction only when the latest closeout is open and dated today.
- Otherwise return HTTP 409 with code `CLOSEOUT_REQUIRED`. The informational
  reason is `NONE_EXISTS`, `STALE_OPEN_CLOSEOUT`, or `LATEST_CLOSED`.
- On a date mismatch, the backend closes the old closeouts and signals the
  frontend to collect currency and exchange rate for the new closeout. This
  clarification supersedes the earlier no-closing-on-transaction requirement.
- The frontend never decides rollover from its own clock and offers no standalone
  create, open, close, or reopen action.
- The browser date and transaction occurrence date cannot select the closeout.

## Backend-directed setup during a transaction

The setup prompt is shown only in response to the backend requiring a new
closeout during a transaction. The user supplies currency and exchange rate,
then the frontend continues that pending transaction. This is not a manual
closeout-management screen. Timezone identifiers must remain
raw IANA keys. The server determines the date and stores the effective timezone.

The backend must serialize closeout changes for the authorized location and
lock its closeout rows. If today already has an open closeout,
preserve and return it; never close it or insert a duplicate. Close the other
open closeouts for the location, regardless of their date. Otherwise close all
open closeouts and insert today's open closeout. Return the resulting closeout
and the list of closeouts closed by this operation.

Interpretation to confirm in the API contract: an existing open closeout for
today survives while other open rows are closed. Its currency and rate should
be returned unchanged rather than overwritten during a retry.

Locking must also serialize an initially empty location, where no closeout rows
exist to lock. Transaction creation and rollover must coordinate so an entry
cannot be written into a closeout concurrently being closed.

## Portal integration and remaining contract details

The automatic closing form, branch overrides, automation hooks and API helpers
have been removed. Existing server jobs still need removal in the API/deployment.

Before wiring the replacement, confirm:

- API repository and backend-directed setup route/method.
- Exact ordering of old-closeout closure, the conflict response, and new-closeout
  creation, including what happens if the user cancels setup.
- Location reference field, timezone source, currency/rate payload, and grants.
- Error envelope containing `CLOSEOUT_REQUIRED` and its reason.
- Response fields containing the current closeout and the closed closeouts.
- Current-closeout lookup behavior when today's closeout is absent.
- Idempotency/retry behavior and currency/rate validation.

Use React Hook Form/Zod for the setup prompt and TanStack Query for rollover.
Keep pending transaction inputs when setup is canceled or fails. Scope pending
work to company and location; cancel it when context changes. After rollover,
use the returned closeout's currency/rate, invalidate affected current/history
queries, and retry only the blocked transaction with existing duplicate-submit
protections. Cover journals, invoice payments/registration, delivery payments,
and loans without duplicating a successfully recorded operation.

## Required verification

Test all three conflict reasons, server/browser date differences, timezone
midnight boundaries, multiple stale open rows, today's existing open row,
simultaneous first transactions, empty-location concurrency, rollback on error,
permission and tenant isolation, and response lists containing only rows closed
by that operation. Verify cancellation after backend closure preserves the
pending transaction and allows setup to resume without duplicate closeouts.
