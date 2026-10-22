"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { usePredefinedRouteMutations } from "@/lib/predefined-routes/hooks/use-predefined-routes";
import { predefinedRouteFormSchema } from "@/lib/predefined-routes/schemas/predefined-route.schema";
import {
  arePredefinedRouteFormValuesEquivalent,
  createEmptyPredefinedRouteForm,
  predefinedRouteToFormValues,
  type PredefinedRoute,
  type PredefinedRouteFormValues,
} from "@/lib/predefined-routes/types";

export function usePredefinedRouteWorkspace(onCreated?: (route: PredefinedRoute) => void) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const mutations = usePredefinedRouteMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PredefinedRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<PredefinedRouteFormValues>({
    resolver: zodResolver(predefinedRouteFormSchema),
    defaultValues: createEmptyPredefinedRouteForm(),
  });
  const busy =
    mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;

  function edit(item: PredefinedRoute | null) {
    setEditing(item);
    setError(null);
    form.reset(item ? predefinedRouteToFormValues(item) : createEmptyPredefinedRouteForm());
    setOpen(true);
  }

  const save = form.handleSubmit(async (values) => {
    if (busy) return;
    setError(null);
    try {
      if (editing) {
        if (arePredefinedRouteFormValuesEquivalent(values, predefinedRouteToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setOpen(false);
          return;
        }
        const next = await mutations.update.mutateAsync({ id: editing.id, values });
        feedback.notifyUpdated(t("predefinedRoutes.entity"), next.name);
      } else {
        const next = await mutations.create.mutateAsync(values);
        feedback.notifyAdded(t("predefinedRoutes.entity"), next.name);
        onCreated?.(next);
      }
      setOpen(false);
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    }
  });

  async function remove(item: PredefinedRoute) {
    if (busy) return;
    if (!window.confirm(t("predefinedRoutes.confirmDelete", { name: item.name }))) return;
    try {
      await mutations.remove.mutateAsync(item.id);
      feedback.notifyDeleted(t("predefinedRoutes.entity"), 1);
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
