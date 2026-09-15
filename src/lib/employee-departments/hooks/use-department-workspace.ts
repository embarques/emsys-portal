"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useEmployeeDepartments, useEmployeeDepartmentMutations } from "@/lib/employee-departments/hooks/use-employee-departments";
import { departmentFormSchema } from "@/lib/employee-departments/schemas/department.schema";
import { departmentToFormValues, type EmployeeDepartment, type EmployeeDepartmentFormValues } from "@/lib/employee-departments/types";

export function useDepartmentWorkspace(options: { onSaved?: (item: EmployeeDepartment) => void } = {}) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const query = useEmployeeDepartments();
  const mutations = useEmployeeDepartmentMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeDepartment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<EmployeeDepartmentFormValues>({ resolver: zodResolver(departmentFormSchema), defaultValues: { name: "", active: true } });
  const busy = mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;
  function edit(item: EmployeeDepartment | null) {
    setEditing(item);
    setError(null);
    form.reset(item ? departmentToFormValues(item) : { name: "", active: true });
    setOpen(true);
  }
  const save = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (editing) {
        if (areFormValuesEquivalent(values, departmentToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setOpen(false);
          return;
        }
        const next = await mutations.update.mutateAsync({ id: editing.id, values });
        feedback.notifyUpdated(t("employeeDepartments.entity"), next.name);
        options.onSaved?.(next);
      } else {
        const next = await mutations.create.mutateAsync(values);
        feedback.notifyAdded(t("employeeDepartments.entity"), next.name);
        options.onSaved?.(next);
      }
      setOpen(false);
    } catch (cause) { setError(normalizeApiError(cause).message); }
  });
  async function remove(item: EmployeeDepartment) {
    if (!window.confirm(t("employeeDepartments.confirmDelete", { name: item.name }))) return;
    try {
      await mutations.remove.mutateAsync(item.id);
      feedback.notifyDeleted(t("employeeDepartments.entity"), 1);
    } catch (cause) { feedback.notifyError(normalizeApiError(cause).message); }
  }
  return { query, form, open, editing, error, busy, edit, save, remove, setOpen: (value: boolean) => { if (!busy) setOpen(value); } };
}
