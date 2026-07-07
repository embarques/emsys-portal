"use client";

import { CalendarDays, Pencil, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerPartySelect } from "@/components/customers/customer-party-select";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
} from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  useCreateCustomer,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import {
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  createEmptyCustomerForm,
  customerHasUnverifiedPrimaryAddress,
  customerToFormValues,
  type Customer,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import {
  createEmptyOrderForm,
  resetOrderFormForNextEntry,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";

type OrderFormProps = {
  initialValues?: OrderFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: OrderFormValues) => OrderFormSubmitResult | Promise<OrderFormSubmitResult>;
  onFormErrorChange?: (error: string | null) => void;
  onCancel: () => void;
};

type PartySide = "sender" | "receiver";

type CustomerDialogState = {
  side: PartySide;
  mode: "add" | "edit";
};

function PartyFieldActions({
  hasSelection,
  onAdd,
  onEdit,
}: {
  hasSelection: boolean;
  onAdd: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={onAdd}
      >
        <UserPlus className="size-3.5" />
        New
      </Button>
      {hasSelection ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          Edit
        </Button>
      ) : null}
    </div>
  );
}

export function OrderForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: OrderFormProps) {
  const { data: branchesData } = useBranchPicker();
  const employeesQuery = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const { notifyAdded, notifyUpdated } = useFeedback();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [customerDialog, setCustomerDialog] = useState<CustomerDialogState | null>(null);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const isSavingCustomer = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setFormError(null);
  }, [initialValues]);

  function updateField<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updateSender(_senderId: string, sender: Customer) {
    updateField("senderId", sender.id);
    updateField("sender", sender);
  }

  function updateReceiver(_receiverId: string, receiver: Customer) {
    updateField("receiverId", receiver.id);
    updateField("receiver", receiver);
  }

  const dialogCustomer =
    customerDialog?.side === "sender"
      ? values.sender
      : customerDialog?.side === "receiver"
        ? values.receiver
        : null;

  function openAddCustomer(side: PartySide) {
    setCustomerFormError(null);
    setCustomerDialog({ side, mode: "add" });
  }

  function openEditCustomer(side: PartySide) {
    setCustomerFormError(null);
    setCustomerDialog({ side, mode: "edit" });
  }

  function closeCustomerDialog() {
    setCustomerDialog(null);
    setCustomerFormError(null);
  }

  function applyCustomerToSide(side: PartySide, customer: Customer) {
    if (side === "sender") {
      updateField("senderId", customer.id);
      updateField("sender", customer);
    } else {
      updateField("receiverId", customer.id);
      updateField("receiver", customer);
    }
  }

  async function handleCustomerSubmit(formValues: CustomerFormValues) {
    if (!customerDialog) return;
    setCustomerFormError(null);

    try {
      let customer: Customer;

      if (customerDialog.mode === "edit" && dialogCustomer) {
        customer = await updateCustomerMutation.mutateAsync({
          customerId: dialogCustomer.id,
          values: formValues,
        });
        notifyUpdated("Customer", customer.name);
      } else {
        customer = await createCustomerMutation.mutateAsync(formValues);
        notifyAdded("Customer", customer.name);
      }

      applyCustomerToSide(customerDialog.side, customer);
      closeCustomerDialog();
    } catch (mutationError) {
      setCustomerFormError(normalizeApiError(mutationError).message);
    }
  }

  const unverifiedPartyMessage =
    "Verify the sender's address before saving. Open the sender and update it with a Google-suggested address.";
  // Only senders use Google verification; receivers use a predetermined city list.
  const blockForUnverifiedParty =
    isGoogleMapsConfigured() &&
    Boolean(values.sender && customerHasUnverifiedPrimaryAddress(values.sender));

  const hasValidDate = Boolean(values.date.trim()) && !Number.isNaN(new Date(values.date).getTime());

  // The single reason the order can't be saved yet, evaluated in field order:
  // pickup date → sender → at least one comment.
  const blockReason: string | null = (() => {
    if (!hasValidDate) {
      return "Select a valid pickup date.";
    }
    if (!values.sender) {
      return "Select a sender.";
    }
    if (blockForUnverifiedParty) {
      return unverifiedPartyMessage;
    }
    if (values.comments.length === 0) {
      return "Add at least one comment.";
    }
    return null;
  })();

  const isBlocked = blockReason != null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (blockReason) {
      setFormError(blockReason);
      onFormErrorChange?.(blockReason);
      return;
    }

    const result = await onSubmit(values);
    onFormErrorChange?.(result.error);
    if (!result.error && !isEditing) {
      setValues(resetOrderFormForNextEntry(values));
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
      <FormSection icon={CalendarDays} title="Pickup date" required>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <DateInput
              id="date"
              value={values.date}
              onChange={(event) => updateField("date", event.target.value)}
              required
            />
          </div>

          {isEditing ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="branchId">
                  Branch <span className="text-destructive">*</span>
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

              <div className="space-y-1">
                <Label htmlFor="employeeId">Employee</Label>
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

              <div className="space-y-1">
                <Label htmlFor="sectorId">Sector</Label>
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
            </>
          ) : null}
        </div>
      </FormSection>

      <FormSection icon={Users} title="Sender & receiver">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="senderId">
                Sender <span className="text-destructive">*</span>
              </Label>
              <PartyFieldActions
                hasSelection={Boolean(values.sender)}
                onAdd={() => openAddCustomer("sender")}
                onEdit={() => openEditCustomer("sender")}
              />
            </div>
            <CustomerPartySelect
              id="senderId"
              partyType="sender"
              value={values.senderId}
              selectedCustomer={values.sender}
              onValueChange={updateSender}
              placeholder="Select sender"
              required
            />
            {values.sender ? (
              <>
                <CustomerContactSummary customer={values.sender} />
                <UnverifiedAddressNotice
                  customer={values.sender}
                  onUpdateAddress={() => openEditCustomer("sender")}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="receiverId">Receiver</Label>
              <PartyFieldActions
                hasSelection={Boolean(values.receiver)}
                onAdd={() => openAddCustomer("receiver")}
                onEdit={() => openEditCustomer("receiver")}
              />
            </div>
            <CustomerPartySelect
              id="receiverId"
              partyType="receiver"
              value={values.receiverId}
              selectedCustomer={values.receiver}
              onValueChange={updateReceiver}
              placeholder="No receiver"
            />
            {values.receiver ? (
              <>
                <CustomerContactSummary customer={values.receiver} />
                <UnverifiedAddressNotice
                  customer={values.receiver}
                  onUpdateAddress={() => openEditCustomer("receiver")}
                />
              </>
            ) : null}
          </div>
        </div>
      </FormSection>

      {values.sender ? (
        <SenderOrderHistorySection
          sender={values.sender}
          currentOrderId={values.id > 0 ? String(values.id) : undefined}
        />
      ) : null}

      <OrderCommentsEditor comments={values.comments} onChange={(comments) => updateField("comments", comments)} />
      </FormBody>

      <FormFooter
        error={formError}
        warning={blockReason}
        submitLabel={submitLabel}
        submitDisabled={isBlocked}
        onCancel={onCancel}
      />
    </form>

      <Dialog
        open={customerDialog !== null}
        onOpenChange={(open) => {
          if (!open) closeCustomerDialog();
        }}
      >
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {customerDialog?.mode === "edit"
                ? `Edit ${customerDialog.side}`
                : `Add ${customerDialog?.side ?? "customer"}`}
            </DialogTitle>
          </DialogHeader>
          {customerDialog ? (
            <CustomerForm
              key={`${customerDialog.side}-${customerDialog.mode}-${dialogCustomer?.id ?? "new"}`}
              initialValues={
                customerDialog.mode === "edit" && dialogCustomer
                  ? customerToFormValues(dialogCustomer)
                  : {
                      ...createEmptyCustomerForm(),
                      customerType:
                        customerDialog.side === "receiver"
                          ? CUSTOMER_TYPE_RECEIVER
                          : CUSTOMER_TYPE_SENDER,
                    }
              }
              isEditing={customerDialog.mode === "edit"}
              submitLabel={customerDialog.mode === "edit" ? "Save changes" : "Add customer"}
              isSubmitting={isSavingCustomer}
              externalError={customerFormError}
              lockCustomerType
              onSubmit={handleCustomerSubmit}
              onCancel={closeCustomerDialog}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
