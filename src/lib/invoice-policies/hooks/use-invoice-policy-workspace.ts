"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import { useTranslation } from "@/lib/i18n";
import {
  useInvoicePolicies,
  useInvoicePolicyMutations,
} from "@/lib/invoice-policies/hooks/use-invoice-policies";
import { invoicePolicyFormSchema } from "@/lib/invoice-policies/schemas/invoice-policy.schema";
import {
  createEmptyPolicyForm,
  policyToFormValues,
  type InvoicePolicy,
  type InvoicePolicyFormValues,
} from "@/lib/invoice-policies/types";

export function useInvoicePolicyWorkspace(
  options: { onSaved?: (item: InvoicePolicy) => void } = {},
) {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const query = useInvoicePolicies();
  const mutations = useInvoicePolicyMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InvoicePolicy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<InvoicePolicyFormValues>({
    resolver: zodResolver(invoicePolicyFormSchema),
    defaultValues: createEmptyPolicyForm(),
  });
  const busy =
    mutations.create.isPending || mutations.update.isPending || mutations.remove.isPending;

  function edit(item: InvoicePolicy | null) {
    setEditing(item);
    setError(null);
    form.reset(item ? policyToFormValues(item) : createEmptyPolicyForm());
    setOpen(true);
  }

  const save = form.handleSubmit(async (values) => {
    setError(null);
    try {
      if (editing) {
        if (areFormValuesEquivalent(values, policyToFormValues(editing))) {
          feedback.notifySuccess(t("common.form.noChanges"));
          setOpen(false);
          return;
        }
        const next = await mutations.update.mutateAsync({ id: editing.id, values });
        feedback.notifyUpdated(t("invoicePolicies.entity"), next.title);
        options.onSaved?.(next);
      } else {
        const next = await mutations.create.mutateAsync(values);
        feedback.notifyAdded(t("invoicePolicies.entity"), next.title);
        options.onSaved?.(next);
      }
      setOpen(false);
    } catch (cause) {
      setError(normalizeApiError(cause).message);
    }
  });

  async function remove(item: InvoicePolicy) {
    if (!window.confirm(t("invoicePolicies.confirmDelete", { name: item.title }))) return;
    try {
      await mutations.remove.mutateAsync(item.id);
      feedback.notifyDeleted(t("invoicePolicies.entity"), 1);
    } catch (cause) {
      feedback.notifyError(normalizeApiError(cause).message);
    }
  }

  return {
    query,
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
