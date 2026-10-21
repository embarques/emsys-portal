"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";
import {
  createLegacyRoute,
  deleteLegacyRoute,
  updateLegacyRoute,
} from "@/lib/legacy-routes/api/legacy-routes-api";
import type { LegacyRouteFormValues } from "@/lib/legacy-routes/types";

export function useLegacyRouteMutations() {
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.legacyRoutes.all });
  return {
    create: useMutation({ mutationFn: createLegacyRoute, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: number; values: LegacyRouteFormValues }) =>
        updateLegacyRoute(id, values),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteLegacyRoute, onSuccess: invalidate }),
  };
}
