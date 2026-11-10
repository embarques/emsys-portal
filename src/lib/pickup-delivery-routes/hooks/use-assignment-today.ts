"use client";

import { useSyncExternalStore } from "react";
import { assignmentToday } from "@/lib/pickup-delivery-routes/assignment-policy";

const serverDay = () => "";
const noSubscription = () => () => {};

/** Browser calendar only; API commit-time business-date validation is authoritative. */
export function subscribeToAssignmentDay(onChange: () => void): () => void {
  let timer: number;

  function schedule() {
    const now = new Date();
    // Calendar construction handles both 23-hour and 25-hour DST days.
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = window.setTimeout(refresh, Math.max(1, midnight.getTime() - now.getTime()));
  }

  function refresh() {
    window.clearTimeout(timer);
    onChange();
    schedule();
  }

  function onVisibilityChange() {
    if (document.visibilityState === "visible") refresh();
  }

  schedule();
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

/** No polling or timers while the assignment UI is closed. */
export function useAssignmentToday(enabled = true): string {
  return useSyncExternalStore(enabled ? subscribeToAssignmentDay : noSubscription, assignmentToday, serverDay);
}
