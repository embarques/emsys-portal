"use client";

import { ClipboardList, Pencil, Receipt, UserPlus, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { CustomerForm } from "@/components/customers/customer-form";
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
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { InvoiceLineItemsEditor } from "@/components/invoices/invoice-line-items-editor";
import { WizardField } from "@/components/invoices/invoice-wizard-field";
import {
  wizardInputFieldProps,
  wizardSelectFieldProps,
} from "@/components/invoices/invoice-wizard-styles";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
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
  customerHasUnverifiedPrimaryAddress,
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
import { useItemPicker } from "@/lib/items/hooks/use-items";
import { useRoutePicker } from "@/lib/route-manager/hooks/use-route-manager";
import { DEFAULT_ORDER_LIST_PARAMS } from "@/lib/orders/types";
import { useOrders } from "@/lib/orders/hooks/use-orders";
import { cn } from "@/lib/utils";

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
  /** When set, only the matching section is rendered (wizard mode). */
  wizardStep?: 1 | 2 | 3;
  appearance?: "default" | "wizard";
  showFooter?: boolean;
  onValuesChange?: (values: InvoiceFormValues) => void;
};

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
  wizardStep,
  appearance = "default",
  showFooter = true,
  onValuesChange,
}: InvoiceFormProps) {
  const isWizard = appearance === "wizard";
  const { data: customersData } = useCustomerPicker();
  const { data: containersData } = useContainerPicker();
  const ordersQuery = useOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 200 });
  const { notifyAdded, notifyUpdated } = useFeedback();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const { data: itemsData } = useItemPicker();
  const customers = customersData?.items ?? [];
  const containers = containersData?.items ?? [];
  const orders = ordersQuery.data?.items ?? [];
  const catalogItems = itemsData?.items ?? [];
  const { data: routesData } = useRoutePicker();
  const routes = routesData?.items ?? [];

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

  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);

  const showAllSections = wizardStep == null;
  const showDetailsSection = showAllSections || wizardStep === 1;
  const showPartiesSection = showAllSections || wizardStep === 2;
  const showLineItemsSection = showAllSections || wizardStep === 3;
  const showTotalsSection = (showAllSections || wizardStep === 3) && !isWizard;

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

  const unverifiedPartyMessage =
    "Verify the sender's address before saving. Open the sender and update it with a Google-suggested address.";
  // Only senders use Google verification; receivers use a predetermined city list.
  const blockForUnverifiedParty =
    isGoogleMapsConfigured() &&
    Boolean(values.sender && customerHasUnverifiedPrimaryAddress(values.sender));

  function handleSubmit(event: React.FormEvent) {
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

  function renderField(
    label: string,
    htmlFor: string,
    required: boolean | undefined,
    control: React.ReactNode,
  ) {
    if (isWizard) {
      return (
        <WizardField label={label} htmlFor={htmlFor} required={required}>
          {control}
        </WizardField>
      );
    }

    return (
      <div className="space-y-1">
        <Label htmlFor={htmlFor}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        {control}
      </div>
    );
  }

  const detailsFields = (
    <div className={cn("grid gap-5", isWizard ? "sm:grid-cols-2" : "gap-2.5 sm:grid-cols-2")}>
      {renderField(
        "Date",
        "date",
        true,
        <DateInput
          id="date"
          value={values.date}
          onChange={(event) => updateField("date", event.target.value)}
          {...(isWizard ? wizardInputFieldProps(values.date, "pl-8") : {})}
          required
        />,
      )}
      {renderField(
        "Invoice number",
        "invoiceNumber",
        true,
        <Input
          id="invoiceNumber"
          value={values.invoiceNumber}
          onChange={(event) => updateField("invoiceNumber", event.target.value)}
          placeholder="INV-2026-0001"
          {...(isWizard ? wizardInputFieldProps(values.invoiceNumber) : {})}
          required
        />,
      )}
      {renderField(
        "Pickup",
        "pickupId",
        false,
        <SearchableSelect
          id="pickupId"
          value={values.pickupId}
          onValueChange={(next) => updateField("pickupId", next)}
          placeholder="No pickup"
          searchPlaceholder="Search pickups…"
          {...(isWizard ? wizardSelectFieldProps(values.pickupId) : {})}
          options={[
            { value: "", label: "No pickup" },
            ...orders.map((order) => ({
              value: String(order.id),
              label: `#${order.id}`,
              descriptionLines: [order.sender?.name ?? ""].filter((line) => line.trim()),
            })),
          ]}
        />,
      )}
      {renderField(
        "Container",
        "containerId",
        true,
        <SearchableSelect
          id="containerId"
          value={values.containerId}
          onValueChange={(next) => updateField("containerId", next)}
          placeholder="Select a container"
          searchPlaceholder="Search containers…"
          {...(isWizard ? wizardSelectFieldProps(values.containerId) : {})}
          required
          options={[
            { value: "", label: "Select a container" },
            ...containers.map((container) => ({
              value: String(container.id),
              label: formatContainerLabel(container),
            })),
          ]}
        />,
      )}
      {renderField(
        "Pending",
        "paymentLocation",
        true,
        <SearchableSelect
          id="paymentLocation"
          value={values.paymentLocation}
          onValueChange={(next) =>
            updateField("paymentLocation", next as InvoiceFormValues["paymentLocation"])
          }
          {...(isWizard ? wizardSelectFieldProps(values.paymentLocation) : {})}
          required
          options={INVOICE_PAYMENT_LOCATIONS.map((option) => ({
            value: option.value,
            label: option.label,
          }))}
        />,
      )}
      {renderField(
        "Route",
        "routeId",
        false,
        <SearchableSelect
          id="routeId"
          value={values.routeId}
          onValueChange={(next) => updateField("routeId", next)}
          placeholder="No route"
          searchPlaceholder="Search routes…"
          {...(isWizard ? wizardSelectFieldProps(values.routeId) : {})}
          options={[
            { value: "", label: "No route" },
            ...routes.map((assignment) => ({
              value: assignment.id,
              label: assignment.name,
              descriptionLines: [assignment.vehicle.name].filter((line) => line.trim()),
            })),
          ]}
        />,
      )}
    </div>
  );

  const partiesFields = (
    <div className={cn("grid gap-5", isWizard ? "sm:grid-cols-2" : "gap-2.5 sm:grid-cols-2")}>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          {isWizard ? (
            <Label htmlFor="senderId" className="text-xs font-normal text-muted-foreground">
              Sender <span className="text-destructive">*</span>
            </Label>
          ) : (
            <Label htmlFor="senderId">
              Sender <span className="text-destructive">*</span>
            </Label>
          )}
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
          {...(isWizard ? wizardSelectFieldProps(values.senderId) : {})}
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

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          {isWizard ? (
            <Label htmlFor="receiverId" className="text-xs font-normal text-muted-foreground">
              Receiver
            </Label>
          ) : (
            <Label htmlFor="receiverId">Receiver</Label>
          )}
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
          {...(isWizard ? wizardSelectFieldProps(values.receiverId) : {})}
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
  );

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody
          className={
            isWizard ? "flex-1 space-y-6 overflow-y-auto bg-card px-5 pt-4 pb-10 sm:px-8 sm:pb-12" : undefined
          }
        >
          {showDetailsSection ? (
            isWizard ? (
              detailsFields
            ) : (
              <FormSection icon={Receipt} title="Invoice details" required>
                {detailsFields}
              </FormSection>
            )
          ) : null}

          {showPartiesSection ? (
            isWizard ? (
              partiesFields
            ) : (
              <FormSection icon={Users} title="Sender & receiver">
                {partiesFields}
              </FormSection>
            )
          ) : null}

          {showLineItemsSection ? (
            isWizard ? (
              <InvoiceLineItemsEditor
                lineItems={values.lineItems}
                catalogItems={catalogItems}
                appearance="wizard"
                onChange={(lineItems) => updateField("lineItems", lineItems)}
              />
            ) : (
              <FormSection icon={ClipboardList} title="Description">
                <InvoiceLineItemsEditor
                  lineItems={values.lineItems}
                  catalogItems={catalogItems}
                  onChange={(lineItems) => updateField("lineItems", lineItems)}
                />
              </FormSection>
            )
          ) : null}

          {showTotalsSection ? (
          <FormSection icon={Wallet} title="Totals">
            <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
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
              <div className="space-y-1">
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
            </div>
          </FormSection>
          ) : null}
        </FormBody>

        {showFooter ? (
        <FormFooter
          error={errorMessage}
          warning={blockForUnverifiedParty ? unverifiedPartyMessage : null}
          submitLabel={submitLabel}
          submitDisabled={blockForUnverifiedParty}
          onCancel={onCancel}
        />
        ) : null}
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
