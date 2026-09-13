"use client";

import { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  createFilterPreset,
  deleteFilterPreset,
  fetchFilterPresets,
  updateFilterPreset,
} from "@/lib/filter-presets/api/filter-presets-api";
import type { FilterPreset } from "@/lib/filter-presets/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { queryKeys } from "@/lib/query/query-keys";
import { useAppSelector } from "@/lib/store/hooks";
import type { TableFilterRowState } from "@/lib/table/filter-types";

function sortByName(presets: FilterPreset[]): FilterPreset[] {
  return [...presets].sort((a, b) => a.name.localeCompare(b.name));
}

export type UseFilterPresetsResult = {
  presets: FilterPreset[];
  isLoading: boolean;
  isMutating: boolean;
  savePreset: (name: string, rows: TableFilterRowState[]) => void;
  deletePreset: (id: string) => void;
};

/**
 * Loads and mutates the authenticated user's advanced-filter presets for a
 * workspace via the EMSYS API. Presets are user-scoped (not tenant-scoped), so
 * the underlying requests omit the `x-company-id` header.
 *
 * Saving with an existing name (case-insensitive) updates that preset so users
 * can refine a preset without creating duplicates.
 */
export function useFilterPresets(scope: string): UseFilterPresetsResult {
  const queryClient = useQueryClient();
  const { loading } = useAuth();
  const idToken = useAppSelector((state) => state.auth.idToken);
  const normalizedScope = scope.trim();
  const queryEnabled = !loading && Boolean(idToken) && Boolean(normalizedScope);

  const presetsQuery = useWorkspaceQuery({
    queryKey: queryKeys.filterPresets.list(normalizedScope),
    queryFn: () => fetchFilterPresets(normalizedScope),
    enabled: queryEnabled,
  });

  const presets = presetsQuery.data
    ? sortByName(
        presetsQuery.data.filter((preset) => preset.scope.trim() === normalizedScope),
      )
    : [];

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: queryKeys.filterPresets.list(normalizedScope) });
  }

  const saveMutation = useMutation({
    mutationFn: ({ name, rows }: { name: string; rows: TableFilterRowState[] }) => {
      const trimmedName = name.trim();
      const existing = (presetsQuery.data ?? []).find(
        (preset) =>
          preset.scope.trim() === normalizedScope &&
          preset.name.toLowerCase() === trimmedName.toLowerCase(),
      );
      const input = { scope: normalizedScope, name: trimmedName, rows };

      return existing
        ? updateFilterPreset(existing.id, input)
        : createFilterPreset(input);
    },
    onSuccess: () => invalidate(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFilterPreset(id),
    onSuccess: () => invalidate(),
  });

  const savePreset = useCallback(
    (name: string, rows: TableFilterRowState[]) => {
      const trimmedName = name.trim();
      if (!trimmedName) return;

      const clonedRows = rows.map((row) => ({ ...row }));
      saveMutation.mutate({ name: trimmedName, rows: clonedRows });
    },
    [saveMutation],
  );

  const deletePreset = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  return {
    presets,
    isLoading: presetsQuery.isLoading,
    isMutating: saveMutation.isPending || deleteMutation.isPending,
    savePreset,
    deletePreset,
  };
}
