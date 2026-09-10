"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  getChecksSnapshot,
  getOutstandingChecksCountSnapshot,
  mutateChecksStore,
  subscribeChecksStore,
} from "./store";
import type { Check } from "./types";

export function useChecksStore() {
  const checks = useSyncExternalStore(subscribeChecksStore, getChecksSnapshot, getChecksSnapshot);

  const setChecks = useCallback((next: Check[] | ((current: Check[]) => Check[])) => {
    if (typeof next === "function") {
      mutateChecksStore(next);
      return;
    }

    mutateChecksStore(() => next);
  }, []);

  return { checks, setChecks };
}

export function useOutstandingChecksCount() {
  return useSyncExternalStore(
    subscribeChecksStore,
    getOutstandingChecksCountSnapshot,
    getOutstandingChecksCountSnapshot,
  );
}
