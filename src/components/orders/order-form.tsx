"use client";

import { CalendarDays, Pencil, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CustomerForm } from "@/components/customers/customer-form";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  useCreateCustomer,
  useCustomerPicker,
  useCustomerSearch,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import { CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS } from "@/lib/customers/search-fields";
import {
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  createEmptyCustomerForm,
  customerHasUnverifiedPrimaryAddress,
  customerToFormValues,
  type Customer,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
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

type FormSectionProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  required?: boolean;
  children: React.ReactNode;
};

function FormSection({ icon: Icon, title, required, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold leading-none text-foreground">
          {title}
          {required ? <span className="text-destructive"> *</span> : null}
        </h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type PartySide = "sender" | "receiver";

type CustomerDialogState = {
  side: PartySide;
  mode: "add" | "edit";
};

/** Phone numbers and the primary street address let users find a party without knowing the name. */
function buildCustomerSearchKeywords(customer: Customer): string[] {
  const keywords: string[] = [];

  for (const phone of customer.phones) {
    if (phone.number) keywords.push(phone.number);
    if (phone.displayNumber) keywords.push(phone.displayNumber);
  }

  if (customer.address.address1) keywords.push(customer.address.address1);

  return keywords;
}

/** Surface the primary phone and street on their own rows so neither is cut off. */
function buildCustomerOptionDescriptionLines(customer: Customer): string[] {
  const phone = getPrimaryPhoneDisplayNumber(customer.phones);
  const address1 = customer.address.address1.trim();
  return [phone, address1].filter((line) => line.trim());
}

function customerToSelectOption(customer: Customer): SearchableSelectOption {
  return {
    value: customer.id,
    label: customer.name,
    descriptionLines: buildCustomerOptionDescriptionLines(customer),
    keywords: buildCustomerSearchKeywords(customer),
  };
}

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
  const { notifyAdded, notifyUpdated } = useFeedback();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const customers = customersData?.items ?? [];
  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

  const dateInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [customerDialog, setCustomerDialog] = useState<CustomerDialogState | null>(null);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const [senderQuery, setSenderQuery] = useState("");
  const [receiverQuery, setReceiverQuery] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const isSavingCustomer = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setFormError(null);
  }, [initialValues]);

  // Senders are customerType 1, receivers are customerType 2 — keep each picker scoped.
  const senderCustomers = useMemo(
    () => customers.filter((customer) => customer.active && isCustomerSenderType(customer.customerType)),
    [customers],
  );

  const receiverCustomers = useMemo(
    () => customers.filter((customer) => customer.active && isCustomerReceiverType(customer.customerType)),
    [customers],
  );

  // Typing in a party picker runs the same POST /customers/search filter endpoint, scoped by
  // customerType and matching name, address 1, or phone (debounced to avoid a request per keystroke).
  const debouncedSenderQuery = useDebouncedValue(senderQuery, 300).trim();
  const debouncedReceiverQuery = useDebouncedValue(receiverQuery, 300).trim();

  const senderSearch = useCustomerSearch(
    debouncedSenderQuery ? { value: debouncedSenderQuery } : undefined,
    {
      customerType: CUSTOMER_TYPE_SENDER,
      orFields: CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS,
      limit: 40,
    },
  );

  const receiverSearch = useCustomerSearch(
    debouncedReceiverQuery ? { value: debouncedReceiverQuery } : undefined,
    {
      customerType: CUSTOMER_TYPE_RECEIVER,
      orFields: CUSTOMER_PARTY_PICKER_OR_SEARCH_FIELDS,
      limit: 40,
    },
  );

  const senderSearchResults = useMemo(
    () =>
      (senderSearch.data?.items ?? []).filter(
        (customer) => customer.active && isCustomerSenderType(customer.customerType),
      ),
    [senderSearch.data],
  );

  const receiverSearchResults = useMemo(
    () =>
      (receiverSearch.data?.items ?? []).filter(
        (customer) => customer.active && isCustomerReceiverType(customer.customerType),
      ),
    [receiverSearch.data],
  );

  // While searching, show server results; otherwise the loaded picker page. The currently
  // selected party is always pinned so its label stays visible even when off the current page
  // (e.g. a customer that was just created or edited inline).
  const senderSelectOptions = useMemo(() => {
    const source = debouncedSenderQuery ? senderSearchResults : senderCustomers;
    const options = source.map(customerToSelectOption);
    if (values.sender && !source.some((customer) => customer.id === values.sender!.id)) {
      options.unshift(customerToSelectOption(values.sender));
    }
    return options;
  }, [debouncedSenderQuery, senderSearchResults, senderCustomers, values.sender]);

  const receiverSelectOptions = useMemo(() => {
    const source = debouncedReceiverQuery ? receiverSearchResults : receiverCustomers;
    const options = source.map(customerToSelectOption);
    if (values.receiver && !source.some((customer) => customer.id === values.receiver!.id)) {
      options.unshift(customerToSelectOption(values.receiver));
    }
    return options;
  }, [debouncedReceiverQuery, receiverSearchResults, receiverCustomers, values.receiver]);

  function updateField<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updateSenderId(senderId: string) {
    const sender =
      senderCustomers.find((customer) => customer.id === senderId) ??
      senderSearchResults.find((customer) => customer.id === senderId) ??
      (values.sender?.id === senderId ? values.sender : null);
    updateField("senderId", senderId);
    updateField("sender", sender);
  }

  function updateReceiverId(receiverId: string) {
    const receiver =
      receiverCustomers.find((customer) => customer.id === receiverId) ??
      receiverSearchResults.find((customer) => customer.id === receiverId) ??
      (values.receiver?.id === receiverId ? values.receiver : null);
    updateField("receiverId", receiverId);
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.sender) {
      const message = "Sender is required.";
      setFormError(message);
      onFormErrorChange?.(message);
      return;
    }

    if (blockForUnverifiedParty) {
      setFormError(unverifiedPartyMessage);
      onFormErrorChange?.(unverifiedPartyMessage);
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
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
      <FormSection icon={CalendarDays} title="Pickup date" required>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="relative">
              <button
                type="button"
                aria-label="Open date picker"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => dateInputRef.current?.showPicker?.()}
              >
                <CalendarDays className="size-4" />
              </button>
              <Input
                ref={dateInputRef}
                id="date"
                type="date"
                value={values.date}
                onChange={(event) => updateField("date", event.target.value)}
                required
                className="pl-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden"
              />
            </div>
          </div>

          {isEditing ? (
            <>
              <div className="space-y-2">
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

              <div className="space-y-2">
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

              <div className="space-y-2">
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

      <div className="border-t border-border/60" />

      <FormSection icon={Users} title="Sender & receiver">

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
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
            <SearchableSelect
              id="senderId"
              value={values.senderId}
              onValueChange={updateSenderId}
              placeholder="Select sender"
              searchPlaceholder="Search by name, phone, or address…"
              required
              manualFiltering
              loading={senderSearch.isFetching}
              onSearchChange={setSenderQuery}
              options={[
                ...(debouncedSenderQuery ? [] : [{ value: "", label: "Select sender" }]),
                ...senderSelectOptions,
              ]}
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

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="receiverId">Receiver</Label>
              <PartyFieldActions
                hasSelection={Boolean(values.receiver)}
                onAdd={() => openAddCustomer("receiver")}
                onEdit={() => openEditCustomer("receiver")}
              />
            </div>
            <SearchableSelect
              id="receiverId"
              value={values.receiverId}
              onValueChange={updateReceiverId}
              placeholder="No receiver"
              searchPlaceholder="Search by name, phone, or address…"
              manualFiltering
              loading={receiverSearch.isFetching}
              onSearchChange={setReceiverQuery}
              options={[
                ...(debouncedReceiverQuery ? [] : [{ value: "", label: "No receiver" }]),
                ...receiverSelectOptions,
              ]}
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
          orders={allOrders}
          currentOrderId={values.id > 0 ? String(values.id) : undefined}
        />
      ) : null}

      <div className="border-t border-border/60" />

      <OrderCommentsEditor comments={values.comments} onChange={(comments) => updateField("comments", comments)} />
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        {formError ? <p className="mb-3 text-sm text-destructive">{formError}</p> : null}
        {!formError && blockForUnverifiedParty ? (
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">{unverifiedPartyMessage}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={blockForUnverifiedParty}
            title={blockForUnverifiedParty ? unverifiedPartyMessage : undefined}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
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
