/** Only identifiers explicitly acknowledged by the server have a known outcome. */
export function atomicBatchOutcome(submitted: readonly string[], acknowledged: unknown) {
 const requested = new Set(submitted);
 const confirmed = Array.isArray(acknowledged)
  ? [...new Set(acknowledged.filter((id): id is string => typeof id === "string" && requested.has(id)))]
  : [];
 const known = new Set(confirmed);
 const unconfirmed = submitted.filter(id => !known.has(id));
 return {confirmed, unconfirmed, complete: unconfirmed.length === 0 && confirmed.length === requested.size};
}
