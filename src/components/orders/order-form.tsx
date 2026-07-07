"use client";

import { CalendarDays, Pencil, UserPlus, Users } from "lucide-react";
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
import { PartyAddressSelect } from "@/components/orders/party-address-select";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { formatCustomerMutationError } from "@/lib/customers/customer-create-error";
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
  customerToFormValues,
  getCustomerPrimaryCoreAddress,
  type Customer,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { isCustomerReceiverType, isCustomerSenderType } from "@/lib/customers/customer-type";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import {
  createEmptyOrderForm,
  customerHasUnverifiedAddressAtIndex,
  getDefaultOrderPartyAddressIndex,
  resetOrderFormForNextEntry,
  resolveOrderPartyAddressIndex,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";

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

/** Phone numbers and the primary street address let users find a party without knowing the name. */
function buildCustomerSearchKeywords(customer: Customer): string[] {
  const keywords: string[] = [];

  for (const phone of customer.phones) {
    if (phone.number) keywords.push(phone.number);
    if (phone.displayNumber) keywords.push(phone.displayNumber);
  }

  const primaryAddress = getCustomerPrimaryCoreAddress(customer);
  if (primaryAddress.address1) keywords.push(primaryAddress.address1);

  return keywords;
}

/** Surface the primary phone and street on their own rows so neither is cut off. */
function buildCustomerOptionDescriptionLines(customer: Customer): string[] {
  const phone = getPrimaryPhoneDisplayNumber(customer.phones);
  const address1 = getCustomerPrimaryCoreAddress(customer).address1.trim();
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
  const { t } = useTranslation();

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
        {t("orders.form.partyActions.new")}
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
          {t("orders.form.partyActions.edit")}
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
  const { t } = useTranslation();
  const { data: customersData } = useCustomerPicker();
  const { data: branchesData } = useBranchPicker();
  const employeesQuery = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const { notifyAdded, notifyUpdated } = useFeedback();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const customers = customersData?.items ?? [];
  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

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

    setValues((current) => ({
      ...current,
      senderId,
      sender,
      senderAddressIndex: sender ? getDefaultOrderPartyAddressIndex(sender) : 0,
    }));
    setFormError(null);
  }

  function updateReceiverId(receiverId: string) {
    const receiver =
      receiverCustomers.find((customer) => customer.id === receiverId) ??
      receiverSearchResults.find((customer) => customer.id === receiverId) ??
      (values.receiver?.id === receiverId ? values.receiver : null);

    setValues((current) => ({
      ...current,
      receiverId,
      receiver: receiver ?? null,
      receiverAddressIndex: receiver ? getDefaultOrderPartyAddressIndex(receiver) : 0,
    }));
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
      setValues((current) => ({
        ...current,
        senderId: customer.id,
        sender: customer,
        senderAddressIndex: resolveOrderPartyAddressIndex(
          customer,
          current.senderAddressIndex,
        ),
      }));
    } else {
      setValues((current) => ({
        ...current,
        receiverId: customer.id,
        receiver: customer,
        receiverAddressIndex: resolveOrderPartyAddressIndex(
          customer,
          current.receiverAddressIndex,
        ),
      }));
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
        notifyUpdated(t("customers.entity"), customer.name);
      } else {
        customer = await createCustomerMutation.mutateAsync(formValues);
        notifyAdded(t("customers.entity"), customer.name);
      }

      applyCustomerToSide(customerDialog.side, customer);
      closeCustomerDialog();
    } catch (mutationError) {
      setCustomerFormError(
        formatCustomerMutationError(mutationError, t, {
          mode: customerDialog.mode === "edit" ? "edit" : "create",
        }),
      );
    }
  }

  const unverifiedPartyMessage = t("orders.form.validation.unverifiedSenderAddress");
  // Only senders use Google verification; receivers use a predetermined city list.
  const blockForUnverifiedParty =
    isGoogleMapsConfigured() &&
    Boolean(
      values.sender &&
        customerHasUnverifiedAddressAtIndex(values.sender, values.senderAddressIndex),
    );

  const hasValidDate = Boolean(values.date.trim()) && !Number.isNaN(new Date(values.date).getTime());

  // The single reason the order can't be saved yet, evaluated in field order:
  // pickup date → sender → at least one comment.
  const blockReason: string | null = (() => {
    if (!hasValidDate) {
      return t("orders.form.validation.pickupDateRequired");
    }
    if (!values.sender) {
      return t("orders.form.validation.senderRequired");
    }
    if (blockForUnverifiedParty) {
      return unverifiedPartyMessage;
    }
    if (values.comments.length === 0) {
      return t("orders.form.validation.commentRequired");
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
      <FormSection icon={CalendarDays} title={t("orders.form.sections.pickupDate")} required>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <DateInput
              id="date"
              value={values.date}
              onChange={(event) => updateField("date", event.target.value)}
              required
            />
          </div>

          {isEditing ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="branchId">
                  {t("orders.form.fields.branch")} <span className="text-destructive">*</span>
                </Label>
                <SearchableSelect
                  id="branchId"
                  value={String(values.branchId)}
                  onValueChange={(next) => updateField("branchId", Number(next))}
                  searchPlaceholder={t("orders.form.placeholders.searchBranches")}
                  required
                  options={branches.map((branch) => ({
                    value: String(branch.id),
                    label: `${branch.name} · ${branch.code}`,
                  }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="employeeId">{t("orders.form.fields.employee")}</Label>
                <SearchableSelect
                  id="employeeId"
                  value={String(values.employeeId)}
                  onValueChange={(next) => updateField("employeeId", next ? Number(next) : "")}
                  placeholder={t("orders.form.fields.noEmployee")}
                  searchPlaceholder={t("orders.form.placeholders.searchEmployees")}
                  options={[
                    { value: "", label: t("orders.form.fields.noEmployee") },
                    ...employees.map((employee) => ({
                      value: String(employee.id),
                      label: `${employee.name} · ${employee.department}`,
                    })),
                  ]}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sectorId">{t("orders.form.fields.sector")}</Label>
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
            </div>
          ) : null}
        </div>
      </FormSection>

      <FormSection icon={Users} title={t("orders.form.sections.senderReceiver")}>
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="senderId">
                {t("orders.form.fields.sender")} <span className="text-destructive">*</span>
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
              placeholder={t("orders.form.placeholders.selectSender")}
              searchPlaceholder={t("orders.form.placeholders.searchParty")}
              required
              manualFiltering
              loading={senderSearch.isFetching}
              onSearchChange={setSenderQuery}
              options={[
                ...(debouncedSenderQuery
                  ? []
                  : [{ value: "", label: t("orders.form.placeholders.selectSender") }]),
                ...senderSelectOptions,
              ]}
            />
            {values.sender ? (
              <>
                <PartyAddressSelect
                  id="senderAddress"
                  customer={values.sender}
                  value={values.senderAddressIndex}
                  onChange={(index) => updateField("senderAddressIndex", index)}
                />
                <CustomerContactSummary
                  customer={values.sender}
                  addressIndex={values.senderAddressIndex}
                />
                <UnverifiedAddressNotice
                  customer={values.sender}
                  addressIndex={values.senderAddressIndex}
                  onUpdateAddress={() => openEditCustomer("sender")}
                />
              </>
            ) : null}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="receiverId">{t("orders.form.fields.receiver")}</Label>
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
              placeholder={t("orders.form.placeholders.noReceiver")}
              searchPlaceholder={t("orders.form.placeholders.searchParty")}
              manualFiltering
              loading={receiverSearch.isFetching}
              onSearchChange={setReceiverQuery}
              options={[
                ...(debouncedReceiverQuery
                  ? []
                  : [{ value: "", label: t("orders.form.placeholders.noReceiver") }]),
                ...receiverSelectOptions,
              ]}
            />
            {values.receiver ? (
              <>
                <PartyAddressSelect
                  id="receiverAddress"
                  customer={values.receiver}
                  value={values.receiverAddressIndex}
                  onChange={(index) => updateField("receiverAddressIndex", index)}
                />
                <CustomerContactSummary
                  customer={values.receiver}
                  addressIndex={values.receiverAddressIndex}
                />
                <UnverifiedAddressNotice
                  customer={values.receiver}
                  addressIndex={values.receiverAddressIndex}
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
                ? customerDialog.side === "receiver"
                  ? t("orders.form.partyActions.editReceiver")
                  : t("orders.form.partyActions.editSender")
                : customerDialog?.side === "receiver"
                  ? t("orders.form.partyActions.addReceiver")
                  : t("orders.form.partyActions.addSender")}
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
              submitLabel={
                customerDialog.mode === "edit"
                  ? t("common.actions.saveChanges")
                  : t("customers.actions.add")
              }
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
