"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useEmployeeTitles, useEmployeeTitleMutations } from "@/lib/employee-titles/hooks/use-employee-titles";
import { titleFormSchema } from "@/lib/employee-titles/schemas/title.schema";
import { titleToFormValues, type EmployeeTitle, type EmployeeTitleFormValues } from "@/lib/employee-titles/types";

export function useTitleWorkspace(options: { onSaved?: (item: EmployeeTitle) => void } = {}) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const query = useEmployeeTitles();
  const mutations = useEmployeeTitleMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeTitle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmployeeTitleFormValues>({ resolver: zodResolver(titleFormSchema), defaultValues: { name: "", active: true } });
  const busy = mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;
  function edit(item: EmployeeTitle | null) {
    setEditing(item);
    setError(null);
    form.reset(item ? titleToFormValues(item) : { name: "", active: true });
    setOpen(true);
  }
  const save = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (editing) {
        if (areFormValuesEquivalent(values, titleToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setOpen(false);
          return;
        }
        const next = await mutations.update.mutateAsync({ id: editing.id, values });
        feedback.notifyUpdated(t("employeeTitles.entity"), next.name);
        options.onSaved?.(next);
      } else {
        const next = await mutations.create.mutateAsync(values);
        feedback.notifyAdded(t("employeeTitles.entity"), next.name);
        options.onSaved?.(next);
      }
      setOpen(false);
    } catch (cause) { setError(normalizeApiError(cause).message); }
  });
  async function remove(item: EmployeeTitle) {
    if (!window.confirm(t("employeeTitles.confirmDelete", { name: item.name }))) return;
    try {
      await mutations.remove.mutateAsync(item.id);
      feedback.notifyDeleted(t("employeeTitles.entity"), 1);
    } catch (cause) { feedback.notifyError(normalizeApiError(cause).message); }
  }
  return { query, form, open, editing, error, busy, edit, save, remove, setOpen: (value: boolean) => { if (!busy) setOpen(value); } };
}
