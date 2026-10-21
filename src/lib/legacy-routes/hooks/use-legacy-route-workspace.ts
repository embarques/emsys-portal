"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useLegacyRouteMutations } from "@/lib/legacy-routes/hooks/use-legacy-routes";
import { legacyRouteFormSchema } from "@/lib/legacy-routes/schemas/legacy-route.schema";
import {
  areLegacyRouteFormValuesEquivalent,
  createEmptyLegacyRouteForm,
  legacyRouteToFormValues,
  type LegacyRoute,
  type LegacyRouteFormValues,
} from "@/lib/legacy-routes/types";

export function useLegacyRouteWorkspace() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const mutations = useLegacyRouteMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LegacyRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LegacyRouteFormValues>({
    resolver: zodResolver(legacyRouteFormSchema),
    defaultValues: createEmptyLegacyRouteForm(),
  });
  const busy =
    mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;

  function edit(item: LegacyRoute | null) {
    setEditing(item);
    setError(null);
    form.reset(item ? legacyRouteToFormValues(item) : createEmptyLegacyRouteForm());
    setOpen(true);
  }

  const save = form.handleSubmit(async (values) => {
    if (busy) return;
    setError(null);
    try {
      if (editing) {
        if (areLegacyRouteFormValuesEquivalent(values, legacyRouteToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setOpen(false);
          return;
        }
        const next = await mutations.update.mutateAsync({ id: editing.id, values });
        feedback.notifyUpdated(t("legacyRoutes.entity"), next.name);
      } else {
        const next = await mutations.create.mutateAsync(values);
        feedback.notifyAdded(t("legacyRoutes.entity"), next.name);
      }
      setOpen(false);
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    }
  });

  async function remove(item: LegacyRoute) {
    if (busy) return;
    if (!window.confirm(t("legacyRoutes.confirmDelete", { name: item.name }))) return;
    try {
      await mutations.remove.mutateAsync(item.id);
      feedback.notifyDeleted(t("legacyRoutes.entity"), 1);
    } catch (cause) {
      feedback.notifyError(normalizeApiError(cause).message);
    }
  }

  return {
    form,
    open,
    editing,
    error,
    busy,
    edit,
    save,
    remove,
    setOpen: (value: boolean) => {
      if (!busy) setOpen(value);
    },
  };
}
