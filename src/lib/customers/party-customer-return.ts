/**
 * Bridges a customer add form tab opened from an appointment/invoice party
 * action back to the parent form. The add workspace stashes the created id
 * before closing; the parent hook consumes it when the tab disappears.
 */

let pendingCreatedCustomerId: string | null = null;

export function stashPartyReturnCustomerId(customerId: string): void {
  const id = customerId.trim();
  pendingCreatedCustomerId = id || null;
}

export function consumePartyReturnCustomerId(): string | null {
  const id = pendingCreatedCustomerId;
  pendingCreatedCustomerId = null;
  return id;
}
