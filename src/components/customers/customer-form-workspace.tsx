"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import {
  createEmptyCustomerForm,
  customerToFormValues,
  type CustomerFormValues,
} from "@/lib/customers/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function CustomerFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { formatError, toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const customerQuery = useCustomer(isEditing ? (entityId ?? null) : null);

  const [formError, setFormError] = useState<string | null>(null);
  // Bumping this remounts CustomerForm to reset fields after a successful add.
  const [formInstance, setFormInstance] = useState(0);

  const editingCustomer = isEditing ? (customerQuery.data ?? null) : null;
  const isSaving = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  useEffect(() => {
    if (isEditing && editingCustomer?.name) {
      updateTabLabel(tabId, t("customers.actions.editNamed", { name: editingCustomer.name }));
    }
  }, [editingCustomer?.name, isEditing, tabId, t, updateTabLabel]);

  async function saveCustomer(values: CustomerFormValues) {
    setFormError(null);

    try {
      if (isEditing && editingCustomer) {
        const nextCustomer = await updateCustomerMutation.mutateAsync({
          customerId: editingCustomer.id,
          values,
        });
        notifyUpdated(t("customers.entity"), nextCustomer.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const nextCustomer = await createCustomerMutation.mutateAsync(values);
      notifyAdded(t("customers.entity"), nextCustomer.name);
      // Keep the tab open and reset to a blank template for the next entry.
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      const { status, category } = formatError(mutationError);
      setFormError(
        toErrorMessage(mutationError, {
          hint:
            status === 403 || category === "forbidden"
              ? t("common.errors.permissionHint")
              : undefined,
        }),
      );
    }
  }

  if (isEditing && customerQuery.isLoading) {
    return (
      <FormTabShell title={t("customers.form.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("customers.loading.customer")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (customerQuery.isError || !editingCustomer)) {
    const message = customerQuery.isError
      ? toErrorMessage(customerQuery.error)
      : t("customers.form.notFound");
    return (
      <FormTabShell title={t("customers.form.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? t("customers.form.editTitle") : t("customers.form.addTitle")}
      description={
        isEditing && editingCustomer ? editingCustomer.name : t("customers.form.addDescription")
      }
    >
      <CustomerForm
        key={isEditing ? (editingCustomer?.id ?? "edit") : `new-${formInstance}`}
        initialValues={
          isEditing && editingCustomer
            ? customerToFormValues(editingCustomer)
            : createEmptyCustomerForm()
        }
        isEditing={isEditing}
        submitLabel={
          isEditing ? t("common.actions.saveChanges") : t("customers.actions.add")
        }
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={saveCustomer}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
