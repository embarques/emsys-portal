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

Status: requested contract; backend implementation and portal integration are
pending. The local API documentation still describes the older create/open/close
operations. Do not infer a new endpoint or response envelope from this document.

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
