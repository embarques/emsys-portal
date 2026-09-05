"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  latestTimestamp,
  readLastLegacySyncedAt,
  writeLastLegacySyncedAt,
  type LegacySyncResource,
} from "@/lib/legacy-sync/last-synced";

export function useLegacyLastSynced(
  resource: LegacySyncResource,
  options: {
    enabled?: boolean;
    timestamps?: Array<string | null | undefined>;
  } = {},
) {
  const { companyId } = useAuth();
  const enabled = options.enabled ?? true;
  const timestamps = options.timestamps;
  const timestampsKey = (timestamps ?? []).map((value) => value?.trim() ?? "").join("|");
  const timestampsRef = useRef(timestamps);
  timestampsRef.current = timestamps;

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !companyId) {
      setLastSyncedAt(null);
      return;
    }

    const stored = readLastLegacySyncedAt(companyId, resource);
    const latest = latestTimestamp(stored, ...(timestampsRef.current ?? []));
    if (latest && latest !== stored) {
      writeLastLegacySyncedAt(companyId, resource, latest);
    }
    setLastSyncedAt(latest);
  }, [companyId, enabled, resource, timestampsKey]);

  const markSynced = useCallback(
    (iso?: string) => {
      if (!companyId) return;
      const next = latestTimestamp(iso, new Date().toISOString());
      if (!next) return;
      writeLastLegacySyncedAt(companyId, resource, next);
      setLastSyncedAt((current) => latestTimestamp(current, next));
    },
    [companyId, resource],
  );

  return {
    lastSyncedAt: enabled ? lastSyncedAt : null,
    markSynced,
  };
}
