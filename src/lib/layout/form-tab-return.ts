/**
 * Bridges an add form tab opened with `closeOnSave` back to the form that
 * opened it. The add workspace stashes the created id before closing; the
 * opener consumes it when the tab disappears.
 */

const pendingCreatedIds = new Map<string, string>();

export function stashFormTabCreatedId(feature: string, id: string | number): void {
  const value = String(id).trim();
  if (value) pendingCreatedIds.set(feature, value);
  else pendingCreatedIds.delete(feature);
}

export function consumeFormTabCreatedId(feature: string): string | null {
  const id = pendingCreatedIds.get(feature) ?? null;
  pendingCreatedIds.delete(feature);
  return id;
}
