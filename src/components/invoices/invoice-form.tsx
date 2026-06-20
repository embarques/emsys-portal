"use client";

import { ClipboardList, Pencil, Receipt, UserPlus, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { InvoiceLineItemsEditor } from "@/components/invoices/invoice-line-items-editor";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { normalizeApiError } from "@/lib/api/axios";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
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
  customerToFormValues,
  type Customer,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import {
  INVOICE_PAYMENT_LOCATIONS,
  computeInvoiceBalance,
  createEmptyInvoiceForm,
  resetInvoiceFormForNextEntry,
  resolveLineTotal,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import { cloneItems } from "@/lib/items/mock-data";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import { DEFAULT_ORDER_LIST_PARAMS } from "@/lib/orders/types";
import { useOrders } from "@/lib/orders/hooks/use-orders";

type InvoiceFormProps = {
  initialValues?: InvoiceFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  suggestedInvoiceNumber?: string;
  submitLabel: string;
  externalError?: string | null;
  onSubmit: (values: InvoiceFormValues) => InvoiceFormSubmitResult;
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

export function InvoiceForm({
  initialValues,
  isEditing = false,
  suggestedInvoiceNumber,
  submitLabel,
  externalError = null,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: InvoiceFormProps) {
  const { data: customersData } = useCustomerPicker();
  const { data: containersData } = useContainerPicker();
  const ordersQuery = useOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 200 });
  const { notifyAdded, notifyUpdated } = useFeedback();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const customers = customersData?.items ?? [];
  const containers = containersData?.items ?? [];
  const orders = ordersQuery.data?.items ?? [];
  const catalogItems = useMemo(() => cloneItems(), []);
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);

  const [values, setValues] = useState<InvoiceFormValues>(initialValues ?? createEmptyInvoiceForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [customerDialog, setCustomerDialog] = useState<CustomerDialogState | null>(null);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const [senderQuery, setSenderQuery] = useState("");
  const [receiverQuery, setReceiverQuery] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const isSavingCustomer = createCustomerMutation.isPending || updateCustomerMutation.isPending;

  useEffect(() => {
    const base = initialValues ?? createEmptyInvoiceForm();
    setValues(
      !isEditing && suggestedInvoiceNumber && !base.invoiceNumber
        ? { ...base, invoiceNumber: suggestedInvoiceNumber }
        : base,
    );
    setFormError(null);
  }, [initialValues, isEditing, suggestedInvoiceNumber]);

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

  function updateField<K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updateSenderId(senderId: string) {
    const sender =
      senderCustomers.find((customer) => customer.id === senderId) ??
      senderSearchResults.find((customer) => customer.id === senderId) ??
      (values.sender?.id === senderId ? values.sender : null);
    setValues((current) => ({ ...current, senderId, sender }));
    setFormError(null);
  }

  function updateReceiverId(receiverId: string) {
    const receiver =
      receiverCustomers.find((customer) => customer.id === receiverId) ??
      receiverSearchResults.find((customer) => customer.id === receiverId) ??
      (values.receiver?.id === receiverId ? values.receiver : null);
    setValues((current) => ({ ...current, receiverId, receiver }));
    setFormError(null);
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
      setValues((current) => ({ ...current, senderId: customer.id, sender: customer }));
    } else {
      setValues((current) => ({ ...current, receiverId: customer.id, receiver: customer }));
    }
    setFormError(null);
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

  const subtotal = useMemo(
    () => values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0),
    [values.lineItems],
  );
  const discount = Number(values.discount) || 0;
  const amountPaid = Number(values.amountPaid) || 0;
  const balance = computeInvoiceBalance(subtotal, discount, amountPaid);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.sender) {
      const message = "Sender is required.";
      setFormError(message);
      onFormErrorChange?.(message);
      return;
    }

    const result = onSubmit(values);
    setFormError(result.error);
    onFormErrorChange?.(result.error);
    if (!result.error && !isEditing) {
      setValues(
        resetInvoiceFormForNextEntry(values, result.nextInvoiceNumber ?? suggestedInvoiceNumber ?? ""),
      );
    }
  }

  const errorMessage = formError ?? externalError;

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <FormSection icon={Receipt} title="Invoice details" required>
            <div className="grid gap-4 sm:grid-cols-2">
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
                <Label htmlFor="invoiceNumber">
                  Invoice number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoiceNumber"
                  value={values.invoiceNumber}
                  onChange={(event) => updateField("invoiceNumber", event.target.value)}
                  placeholder="INV-2026-0001"
                  required
                />
              </div>

              {/*
                Pickup and route assignment are captured in the UI but are intentionally
                left out of the API add/edit payloads until the invoices API supports them.
              */}
              <div className="space-y-2">
                <Label htmlFor="pickupId">Pickup</Label>
                <SearchableSelect
                  id="pickupId"
                  value={values.pickupId}
                  onValueChange={(next) => updateField("pickupId", next)}
                  placeholder="No pickup"
                  searchPlaceholder="Search pickups…"
                  options={[
                    { value: "", label: "No pickup" },
                    ...orders.map((order) => ({
                      value: String(order.id),
                      label: `#${order.id}`,
                      descriptionLines: [order.sender?.name ?? ""].filter((line) => line.trim()),
                    })),
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="containerId">
                  Container <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="containerId"
                  value={values.containerId}
                  onValueChange={(next) => updateField("containerId", next)}
                  placeholder="Select a container"
                  searchPlaceholder="Search containers…"
                  required
                  options={[
                    { value: "", label: "Select a container" },
                    ...containers.map((container) => ({
                      value: String(container.id),
                      label: formatContainerLabel(container),
                    })),
                  ]}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentLocation">
                  Pending <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="paymentLocation"
                  value={values.paymentLocation}
                  onValueChange={(next) =>
                    updateField("paymentLocation", next as InvoiceFormValues["paymentLocation"])
                  }
                  searchable={false}
                  required
                  options={INVOICE_PAYMENT_LOCATIONS.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="routeAssignmentId">Route assignment</Label>
                <SearchableSelect
                  id="routeAssignmentId"
                  value={values.routeAssignmentId}
                  onValueChange={(next) => updateField("routeAssignmentId", next)}
                  placeholder="No route assignment"
                  searchPlaceholder="Search route assignments…"
                  options={[
                    { value: "", label: "No route assignment" },
                    ...routeAssignments.map((assignment) => ({
                      value: assignment.id,
                      label: assignment.name,
                      descriptionLines: [assignment.truck.name].filter((line) => line.trim()),
                    })),
                  ]}
                />
              </div>
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
                {values.sender ? <CustomerContactSummary customer={values.sender} /> : null}
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
                {values.receiver ? <CustomerContactSummary customer={values.receiver} /> : null}
              </div>
            </div>
          </FormSection>

          <div className="border-t border-border/60" />

          <FormSection icon={ClipboardList} title="Description">
            <InvoiceLineItemsEditor
              lineItems={values.lineItems}
              catalogItems={catalogItems}
              onChange={(lineItems) => updateField("lineItems", lineItems)}
            />
          </FormSection>

          <div className="border-t border-border/60" />

          <FormSection icon={Wallet} title="Totals">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discount">Discount</Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.discount}
                  onChange={(event) => updateField("discount", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Paid</Label>
                <Input id="amountPaid" value={formatInvoiceMoney(amountPaid)} readOnly className="bg-muted/40" />
              </div>
            </div>

            <div className="space-y-2 rounded-lg border bg-background p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{formatInvoiceMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="font-medium">−{formatInvoiceMoney(discount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-medium">−{formatInvoiceMoney(amountPaid)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Balance</span>
                <span>{formatInvoiceMoney(balance)}</span>
              </div>
            </div>
          </FormSection>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-6 py-4">
          {errorMessage ? <p className="mb-3 text-sm text-destructive">{errorMessage}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">{submitLabel}</Button>
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
