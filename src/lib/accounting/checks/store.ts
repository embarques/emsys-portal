import { cloneChecks } from "./mock-data";
import type { Check } from "./types";

let checksStore: Check[] = cloneChecks();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeChecksStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChecksSnapshot(): Check[] {
  return checksStore;
}

export function getOutstandingChecksCountSnapshot(): number {
  return checksStore.reduce((count, check) => (check.status === "outstanding" ? count + 1 : count), 0);
}

export function setChecksStore(next: Check[]) {
  checksStore = next.map((check) => ({ ...check }));
  emit();
}

export function mutateChecksStore(mutator: (current: Check[]) => Check[]) {
  checksStore = mutator(checksStore.map((check) => ({ ...check })));
  emit();
}
