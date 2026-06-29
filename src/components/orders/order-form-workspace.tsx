"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { OrderForm } from "@/components/orders/order-form";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useCreateOrder, useOrder, useUpdateOrder } from "@/lib/orders/hooks/use-orders";
import {
  createEmptyOrderForm,
  getOrderRecordId,
  orderToFormValues,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import { formatOrderId } from "@/lib/orders/display";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function OrderFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();

  const createMutation = useCreateOrder();
  const updateMutation = useUpdateOrder();
  const detailQuery = useOrder(isEditing ? (entityId ?? null) : null);

  const [, setFormError] = useState<string | null>(null);

  const editing = isEditing ? (detailQuery.data ?? null) : null;
  const editingLabel = editing ? formatOrderId(editing) : undefined;

  useEffect(() => {
    if (isEditing && editingLabel) {
      updateTabLabel(tabId, `Edit ${editingLabel}`);
    }
  }, [editingLabel, isEditing, tabId, updateTabLabel]);

  async function save(values: OrderFormValues): Promise<OrderFormSubmitResult> {
    setFormError(null);

    try {
      if (isEditing && editing) {
        const next = await updateMutation.mutateAsync({
          orderId: getOrderRecordId(editing),
          values,
        });
        notifyUpdated("Order", formatOrderId(next));
        closeFormTabAndReturn(tabId);
        return { error: null };
      }

      const next = await createMutation.mutateAsync(values);
      notifyAdded("Order", formatOrderId(next));
      // OrderForm resets itself for the next entry when add succeeds.
      return { error: null };
    } catch (mutationError) {
      const message = normalizeApiError(mutationError).message;
      setFormError(message);
      return { error: message };
    }
  }

  if (isEditing && detailQuery.isLoading) {
    return (
      <FormTabShell title="Edit order">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading order…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (detailQuery.isError || !editing)) {
    const message = detailQuery.isError
      ? normalizeApiError(detailQuery.error).message
      : "This order could not be found.";
    return (
      <FormTabShell title="Edit order">
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
      title={isEditing ? "Edit order" : "Add order"}
      description={isEditing && editingLabel ? editingLabel : "Create a new order."}
    >
      <OrderForm
        key={isEditing ? (editing ? getOrderRecordId(editing) : "edit") : "new"}
        initialValues={isEditing && editing ? orderToFormValues(editing) : createEmptyOrderForm()}
        isEditing={isEditing}
        updatedAt={editing?.updatedAt}
        submitLabel={isEditing ? "Save changes" : "Add order"}
        onSubmit={save}
        onFormErrorChange={setFormError}
        onCancel={() => closeFormTabAndReturn(tabId)}
      />
    </FormTabShell>
  );
}
