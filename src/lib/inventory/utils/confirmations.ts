import { readApiUserUsername } from "@/lib/table/api-table-fields";
import {
  confirmActionForParty,
  INVENTORY_CONFIRMATION_PARTIES,
  type InventoryConfirmation,
  type InventoryConfirmationAction,
  type InventoryConfirmationParty,
  type InventoryConfirmationState,
} from "@/lib/inventory/types/common";

const ACTIONS: readonly InventoryConfirmationAction[] = ["CONFIRM_WAREHOUSE", "CONFIRM_CUSTODIAN", "REJECT"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function readConfirmation(value: unknown): InventoryConfirmation | null {
  const entry = asRecord(value);
  if (!entry || !text(entry.confirmedAt)) return null;
  return { confirmedAt: text(entry.confirmedAt), confirmedBy: readApiUserUsername(entry.confirmedBy), notes: text(entry.notes) };
}

function readParty(value: unknown): InventoryConfirmationParty | null {
  return typeof value === "string" && (INVENTORY_CONFIRMATION_PARTIES as readonly string[]).includes(value)
    ? (value as InventoryConfirmationParty)
    : null;
}

/** Reads `confirmations`, `rejection` and `allowedActions`; missing fields mean nothing is confirmed or allowed. */
export function readConfirmationState(entry: Record<string, unknown>): InventoryConfirmationState {
  const confirmations = asRecord(entry.confirmations) ?? {};
  const rejection = asRecord(entry.rejection);
  return {
    confirmations: {
      warehouse: readConfirmation(confirmations.warehouse),
      custodian: readConfirmation(confirmations.custodian),
    },
    rejection: rejection && text(rejection.reason)
      ? {
          rejectedAt: text(rejection.rejectedAt),
          rejectedBy: readApiUserUsername(rejection.rejectedBy),
          party: readParty(rejection.party),
          reason: text(rejection.reason),
        }
      : null,
    allowedActions: Array.isArray(entry.allowedActions)
      ? entry.allowedActions.filter((action): action is InventoryConfirmationAction => ACTIONS.includes(action as InventoryConfirmationAction))
      : [],
  };
}

export type ConfirmationActionOption = { kind: "confirm" | "reject"; party: InventoryConfirmationParty };

function isConfirmed(state: InventoryConfirmationState, party: InventoryConfirmationParty): boolean {
  return Boolean(party === "WAREHOUSE" ? state.confirmations.warehouse : state.confirmations.custodian);
}

/**
 * Actions to offer: the user needs the party permission and the API must list the action
 * (it also checks custodian eligibility and that one user does not confirm both parties).
 */
export function resolveConfirmationActions(
  state: InventoryConfirmationState,
  parties: readonly InventoryConfirmationParty[],
  permitted: Record<InventoryConfirmationParty, boolean>,
): ConfirmationActionOption[] {
  const confirmable = parties.filter((party) =>
    permitted[party] && !isConfirmed(state, party) && state.allowedActions.includes(confirmActionForParty(party)));
  const options: ConfirmationActionOption[] = confirmable.map((party) => ({ kind: "confirm", party }));
  const rejectingParty = confirmable[0] ?? parties.find((party) => permitted[party]);
  if (state.allowedActions.includes("REJECT") && rejectingParty) {
    options.push({ kind: "reject", party: rejectingParty });
  }
  return options;
}

/** Idempotency key for a confirmation: one per record, version and party, so a retry cannot confirm twice. */
export function confirmationIdempotencyKey(kind: string, id: string, version: number | null, party: InventoryConfirmationParty): string {
  return `inventory-${kind}-confirm:${id}:v${version ?? "x"}:${party}`;
}
