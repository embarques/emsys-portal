"use client";

import { useState } from "react";

/** Background invalidation must never replace an open editor's original read. */
export function usePinnedEditSnapshot<T>(
  identity: string,
  data: T | null | undefined,
): T | null {
  const [snapshot, setSnapshot] = useState<{ identity: string; value: T } | null>(null);
  if (data && (!snapshot || snapshot.identity !== identity)) {
    setSnapshot({ identity, value: data });
    return data;
  }
  return snapshot?.identity === identity ? snapshot.value : null;
}
