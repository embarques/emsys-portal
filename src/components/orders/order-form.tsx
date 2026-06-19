"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useCustomerPicker } from "@/lib/customers/hooks/use-customers";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import {
  createEmptyOrderForm,
  resetOrderFormForNextEntry,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import type { Order } from "@/lib/orders/types";

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
  const { data: branchesData } = useBranchPicker();
  const employeesQuery = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });

  const customers = customersData?.items ?? [];
  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setFormError(null);
  }, [initialValues]);

  const senderOptions = useMemo(
    () => customers.filter((customer) => customer.active),
    [customers],
  );

  function updateField<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updateSenderId(senderId: string) {
    const sender = senderOptions.find((customer) => customer.id === senderId) ?? null;
    updateField("senderId", senderId);
    updateField("sender", sender);
  }

  function updateReceiverId(receiverId: string) {
    const receiver = senderOptions.find((customer) => customer.id === receiverId) ?? null;
    updateField("receiverId", receiverId);
    updateField("receiver", receiver);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.sender) {
      const message = "sender is required.";
      setFormError(message);
      onFormErrorChange?.(message);
      return;
    }

    const result = await onSubmit(values);
    onFormErrorChange?.(result.error);
    if (!result.error && !isEditing) {
      setValues(resetOrderFormForNextEntry(values));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {isEditing ? (
          <div className="space-y-2">
            <Label htmlFor="id">Order ID</Label>
            <Input id="id" value={values.id} readOnly className="bg-muted/40 font-mono text-xs" />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="date">
            date <span className="text-destructive">*</span>
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
          <Label htmlFor="purpose">purpose</Label>
          <Input
            id="purpose"
            value={values.purpose}
            onChange={(event) => updateField("purpose", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="branchId">
            branch.id <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="branchId"
            value={String(values.branchId)}
            onValueChange={(next) => updateField("branchId", Number(next))}
            searchPlaceholder="Search branches…"
            required
            options={branches.map((branch) => ({
              value: String(branch.id),
              label: `${branch.name} · ${branch.code}`,
            }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeId">employee.id</Label>
          <SearchableSelect
            id="employeeId"
            value={String(values.employeeId)}
            onValueChange={(next) => updateField("employeeId", next ? Number(next) : "")}
            placeholder="No employee"
            searchPlaceholder="Search employees…"
            options={[
              { value: "", label: "No employee" },
              ...employees.map((employee) => ({
                value: String(employee.id),
                label: `${employee.name} · ${employee.department}`,
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sectorId">sector.id</Label>
          <Input
            id="sectorId"
            type="number"
            min="0"
            value={values.sectorId}
            onChange={(event) =>
              updateField("sectorId", event.target.value ? Number(event.target.value) : "")
            }
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.completed}
              onChange={(event) => updateField("completed", event.target.checked)}
              className="size-4 rounded border-input"
            />
            completed
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="senderId">
            sender <span className="text-destructive">*</span>
          </Label>
          <SearchableSelect
            id="senderId"
            value={values.senderId}
            onValueChange={updateSenderId}
            placeholder="Select sender"
            searchPlaceholder="Search senders…"
            required
            options={[
              { value: "", label: "Select sender" },
              ...senderOptions.map((customer) => ({
                value: customer.id,
                label: customer.name,
              })),
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="receiverId">receiver</Label>
          <SearchableSelect
            id="receiverId"
            value={values.receiverId}
            onValueChange={updateReceiverId}
            placeholder="No receiver"
            searchPlaceholder="Search receivers…"
            options={[
              { value: "", label: "No receiver" },
              ...senderOptions.map((customer) => ({
                value: customer.id,
                label: customer.name,
              })),
            ]}
          />
        </div>
      </div>

      {values.sender ? (
        <SenderOrderHistorySection
          sender={values.sender}
          orders={allOrders}
          currentOrderId={values.id > 0 ? String(values.id) : undefined}
        />
      ) : null}

      <OrderCommentsEditor comments={values.comments} onChange={(comments) => updateField("comments", comments)} />

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
