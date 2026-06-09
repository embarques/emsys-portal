"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { OrderPartyEditor } from "@/components/orders/order-party-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { useCustomerPicker } from "@/lib/customers/hooks/use-customers";
import { cloneContainers } from "@/lib/containers/mock-data";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import { cloneRoutes } from "@/lib/routes/mock-data";
import {
  ORDER_BRANCHES,
  createEmptyOrderForm,
  createEmptyOrderParty,
  resetOrderFormForNextEntry,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import type { Order } from "@/lib/orders/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type OrderFormProps = {
  initialValues?: OrderFormValues;
  allOrders?: Order[];
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: OrderFormValues) => OrderFormSubmitResult | Promise<OrderFormSubmitResult>;
  onFormErrorChange?: (error: string | null) => void;
  onCancel: () => void;
};

export function OrderForm({
  initialValues,
  allOrders = [],
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: OrderFormProps) {
  const { data: customersData } = useCustomerPicker();
  const customers = customersData?.items ?? [];
  const containers = useMemo(() => cloneContainers(), []);
  const routes = useMemo(() => cloneRoutes(), []);
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);

  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setFormError(null);
  }, [initialValues]);

  function updateField<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = await onSubmit(values);
    onFormErrorChange?.(result.error);
    if (!result.error && !isEditing) {
      setValues(resetOrderFormForNextEntry(values));
    }
  }

  const filteredRoutes = routes.filter((route) => route.branch === values.branch);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="orderId">Order ID</Label>
          <Input id="orderId" value={values.orderId} readOnly className="bg-muted/40 font-mono text-xs" />
          {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new orders.</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">
            Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="date"
            type="date"
            value={values.date}
            onChange={(event) => updateField("date", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="containerId">
            Container <span className="text-destructive">*</span>
          </Label>
          <select
            id="containerId"
            className={selectClassName}
            value={values.containerId}
            onChange={(event) => updateField("containerId", event.target.value)}
            required
          >
            <option value="">Select a container</option>
            {containers.map((container) => (
              <option key={container.containerId} value={container.containerId}>
                {container.containerCode} · {container.containerNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pending">
            Pending <span className="text-destructive">*</span>
          </Label>
          <select
            id="pending"
            className={selectClassName}
            value={values.pending}
            onChange={(event) =>
              updateField("pending", event.target.value as OrderFormValues["pending"])
            }
            required
          >
            {ORDER_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="branch">
            Branch <span className="text-destructive">*</span>
          </Label>
          <select
            id="branch"
            className={selectClassName}
            value={values.branch}
            onChange={(event) =>
              updateField("branch", event.target.value as OrderFormValues["branch"])
            }
            required
          >
            {ORDER_BRANCHES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="routeId">
            Route <span className="text-destructive">*</span>
          </Label>
          <select
            id="routeId"
            className={selectClassName}
            value={values.routeId}
            onChange={(event) => updateField("routeId", event.target.value)}
            required
          >
            <option value="">Select a route</option>
            {filteredRoutes.map((route) => (
              <option key={route.routeId} value={route.routeId}>
                {route.name} · {route.branch.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="routeAssignmentId">
            Route assignment <span className="text-destructive">*</span>
          </Label>
          <select
            id="routeAssignmentId"
            className={selectClassName}
            value={values.routeAssignmentId}
            onChange={(event) => updateField("routeAssignmentId", event.target.value)}
            required
          >
            <option value="">Select a route assignment</option>
            {routeAssignments.map((assignment) => (
              <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                {assignment.name} · {assignment.date}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.completed}
              onChange={(event) => updateField("completed", event.target.checked)}
              className="size-4 rounded border-input"
            />
            Mark order as completed
          </label>
        </div>
      </div>

      <OrderPartyEditor
        title="Sender"
        description="Manage sender phones and addresses. Select the address used for this order."
        values={values.sender}
        customers={customers}
        customerFilter="sender"
        onChange={(sender) => updateField("sender", sender)}
      />

      {values.sender.name.trim() ? (
        <SenderOrderHistorySection
          sender={{
            id: values.sender.id,
            clientId: values.sender.clientId || undefined,
            name: values.sender.name,
            documentId: values.sender.documentId || undefined,
            email: values.sender.email || undefined,
            phones: [],
            addresses: [],
            orderAddressId: values.sender.orderAddressId,
          }}
          orders={allOrders}
          currentOrderId={values.orderId}
        />
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Receivers</h3>
            <p className="text-sm text-muted-foreground">Add zero or more receivers with their own order addresses.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => updateField("receivers", [...values.receivers, createEmptyOrderParty()])}
          >
            <Plus className="h-4 w-4" />
            Add receiver
          </Button>
        </div>

        {values.receivers.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            No receivers on this order.
          </p>
        ) : (
          values.receivers.map((receiver, index) => (
            <OrderPartyEditor
              key={receiver.id}
              title={`Receiver ${index + 1}`}
              values={receiver}
              customers={customers}
              customerFilter="receiver"
              onChange={(nextReceiver) =>
                updateField(
                  "receivers",
                  values.receivers.map((entry, entryIndex) => (entryIndex === index ? nextReceiver : entry))
                )
              }
              onRemove={() =>
                updateField(
                  "receivers",
                  values.receivers.filter((_, entryIndex) => entryIndex !== index)
                )
              }
            />
          ))
        )}
      </section>

      <OrderCommentsEditor comments={values.comments} onChange={(comments) => updateField("comments", comments)} />

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
