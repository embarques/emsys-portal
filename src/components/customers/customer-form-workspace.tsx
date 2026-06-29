"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
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
      updateTabLabel(tabId, `Edit ${editingCustomer.name}`);
    }
  }, [editingCustomer?.name, isEditing, tabId, updateTabLabel]);

  async function saveCustomer(values: CustomerFormValues) {
    setFormError(null);

    try {
      if (isEditing && editingCustomer) {
        const nextCustomer = await updateCustomerMutation.mutateAsync({
          customerId: editingCustomer.id,
          values,
        });
        notifyUpdated("Customer", nextCustomer.name);
        closeFormTabAndReturn(tabId);
        return;
      }

      const nextCustomer = await createCustomerMutation.mutateAsync(values);
      notifyAdded("Customer", nextCustomer.name);
      // Keep the tab open and reset to a blank template for the next entry.
      setFormInstance((value) => value + 1);
    } catch (mutationError) {
      const { message, status } = normalizeApiError(mutationError);
      const detail =
        status === 403
          ? isEditing
            ? `${message} Ask an admin to enable customer update (canUpdateCustomer) on your role.`
            : `${message} Ask an admin to enable customer create (canCreateCustomer) on your role.`
          : message;
      setFormError(detail);
    }
  }

  if (isEditing && customerQuery.isLoading) {
    return (
      <FormTabShell title="Edit customer">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading customer…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (customerQuery.isError || !editingCustomer)) {
    const message = customerQuery.isError
      ? normalizeApiError(customerQuery.error).message
      : "This customer could not be found.";
    return (
      <FormTabShell title="Edit customer">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            Close
          </Button>
        </div>
      </FormTabShell>
    );
  }

  return (
    <FormTabShell
      title={isEditing ? "Edit customer" : "Add customer"}
      description={
        isEditing && editingCustomer ? editingCustomer.name : "Create a new customer record."
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
        submitLabel={isEditing ? "Save changes" : "Add customer"}
        isSubmitting={isSaving}
        externalError={formError}
        onSubmit={saveCustomer}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
