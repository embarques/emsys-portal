"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
          <>
            <div className="space-y-2">
        <Label htmlFor="id">Order ID</Label>
              <Input id="id" value={values.id} readOnly className="bg-muted/40 font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oldID">oldID</Label>
              <Input id="oldID" value={values.oldID} readOnly className="bg-muted/40 font-mono text-xs" />
            </div>
          </>
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
          <select
            id="branchId"
            className={selectClassName}
            value={values.branchId}
            onChange={(event) => updateField("branchId", Number(event.target.value))}
            required
          >
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} · {branch.code}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="employeeId">employee.id</Label>
          <select
            id="employeeId"
            className={selectClassName}
            value={values.employeeId}
            onChange={(event) =>
              updateField("employeeId", event.target.value ? Number(event.target.value) : "")
            }
          >
            <option value="">No employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} · {employee.department}
              </option>
            ))}
          </select>
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
          <select
            id="senderId"
            className={selectClassName}
            value={values.senderId}
            onChange={(event) => updateSenderId(event.target.value)}
            required
          >
            <option value="">Select sender</option>
            {senderOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.oldID > 0 ? ` · oldID ${customer.oldID}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="receiverId">receiver</Label>
          <select
            id="receiverId"
            className={selectClassName}
            value={values.receiverId}
            onChange={(event) => updateReceiverId(event.target.value)}
          >
            <option value="">No receiver</option>
            {senderOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
                {customer.oldID > 0 ? ` · oldID ${customer.oldID}` : ""}
              </option>
            ))}
          </select>
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
