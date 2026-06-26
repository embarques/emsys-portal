"use client";

import { useCallback, useEffect, useState } from "react";

import type { TableFilterRowState } from "@/lib/table/filter-types";
import { createRandomId } from "@/lib/utils/id";

export type TableFilterPreset = {
  id: string;
  name: string;
  rows: TableFilterRowState[];
};

const STORAGE_PREFIX = "emsys:filter-presets:";

function storageKeyFor(scope: string): string {
  return `${STORAGE_PREFIX}${scope}`;
}

function isFilterRow(value: unknown): value is TableFilterRowState {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.field === "string" &&
    typeof row.operator === "string" &&
    typeof row.value === "string" &&
    (row.join === "and" || row.join === "or")
  );
}

function isPreset(value: unknown): value is TableFilterPreset {
  if (!value || typeof value !== "object") return false;
  const preset = value as Record<string, unknown>;
  return (
    typeof preset.id === "string" &&
    typeof preset.name === "string" &&
    Array.isArray(preset.rows) &&
    preset.rows.every(isFilterRow)
  );
}

function readPresets(scope: string): TableFilterPreset[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKeyFor(scope));
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isPreset);
  } catch {
    return [];
  }
}

function writePresets(scope: string, presets: TableFilterPreset[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKeyFor(scope), JSON.stringify(presets));
  } catch {
    // Ignore quota/serialization errors — presets are a convenience, not critical state.
  }
}

function sortByName(presets: TableFilterPreset[]): TableFilterPreset[] {
  return [...presets].sort((a, b) => a.name.localeCompare(b.name));
}

export type UseFilterPresetsResult = {
  presets: TableFilterPreset[];
  savePreset: (name: string, rows: TableFilterRowState[]) => void;
  deletePreset: (id: string) => void;
};

/**
 * Persists named advanced-filter presets per workspace in localStorage.
 *
 * Saving with an existing name (case-insensitive) overwrites that preset so
 * users can update a preset without creating duplicates.
 */
export function useFilterPresets(scope: string): UseFilterPresetsResult {
  const [presets, setPresets] = useState<TableFilterPreset[]>([]);

  useEffect(() => {
    setPresets(sortByName(readPresets(scope)));
  }, [scope]);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.key === storageKeyFor(scope)) {
        setPresets(sortByName(readPresets(scope)));
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [scope]);

  const savePreset = useCallback(
    (name: string, rows: TableFilterRowState[]) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;

      const clonedRows = rows.map((row) => ({ ...row }));

      setPresets((current) => {
        const existingIndex = current.findIndex(
          (preset) => preset.name.toLowerCase() === trimmedName.toLowerCase(),
        );

        let next: TableFilterPreset[];
        if (existingIndex >= 0) {
          next = current.map((preset, index) =>
            index === existingIndex ? { ...preset, name: trimmedName, rows: clonedRows } : preset,
          );
        } else {
          next = [...current, { id: createRandomId(), name: trimmedName, rows: clonedRows }];
        }

        const sorted = sortByName(next);
        writePresets(scope, sorted);
        return sorted;
      });
    },
    [scope],
  );

  const deletePreset = useCallback(
    (id: string) => {
      setPresets((current) => {
        const next = current.filter((preset) => preset.id !== id);
        writePresets(scope, next);
        return next;
      });
    },
    [scope],
  );

  return { presets, savePreset, deletePreset };
}
