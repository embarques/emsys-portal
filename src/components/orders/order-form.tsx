"use client";

import { CalendarDays, ChevronsDown, UserPlus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";

import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { CustomerPartySelect } from "@/components/customers/customer-party-select";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { useIsGoogleMapsConfigured } from "@/lib/company/hooks/use-current-company";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";

import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useApplyCustomerOnTabReturn } from "@/lib/customers/hooks/use-apply-customer-on-tab-return";

import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER, type Customer } from "@/lib/customers/types";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import {
  createEmptyOrderForm,
  customerHasUnverifiedAddressAtIndex,
  getCustomerContentAddresses,
  getInitialOrderPartyAddressIndex,
  hasDuplicateOrderCommentItems,
  isOrderCommentComplete,
  isOrderPartyAddressChosen,
  rematchOrderPartyAddressIndex,
  resetOrderFormForNextEntry,
  resolveSelectedOrderPartyAddressIndex,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";

type OrderFormProps = {
  initialValues?: OrderFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: OrderFormValues) => OrderFormSubmitResult | Promise<OrderFormSubmitResult>;
  onFormErrorChange?: (error: string | null) => void;
  onCancel: () => void;
};

type PartySide = "sender" | "receiver";

function resolveAddedAddressIndex(
  previous: Pick<Customer, "addresses">,
  next: Pick<Customer, "addresses">,
): number {
  const previousIds = new Set(
    getCustomerContentAddresses(previous)
      .map((address) => address.id?.trim())
      .filter((id): id is string => Boolean(id)),
  );
  const nextAddresses = getCustomerContentAddresses(next);
  const addedIndex = nextAddresses.findIndex((address) => {
    const id = address.id?.trim();
    if (!id) return false;
    return !previousIds.has(id);
  });
  if (addedIndex >= 0) return addedIndex;
  return Math.max(nextAddresses.length - 1, 0);
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
    <FieldEntityActions
      hasSelection={hasSelection}
      onAdd={onAdd}
      onEdit={onEdit}
      addIcon={UserPlus}
    />
  );
}

export function OrderForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  isSubmitting: isSubmittingProp = false,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: OrderFormProps) {
  const { t } = useTranslation();
  const googleMapsConfigured = useIsGoogleMapsConfigured();
  const { data: branchesData } = useBranchPicker();
  const employeesQuery = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const { openFormTab } = useWorkspaceTabs();

  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [receiverToFocus, setReceiverToFocus] = useState<string | null>(null);
  const receiverPanelRef = useRef<HTMLDivElement>(null);
  const addReceiverButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (receiverToFocus) {
      receiverPanelRef.current?.querySelector<HTMLElement>(`[id="receiver-${receiverToFocus}"]`)?.focus();
    }
  }, [receiverToFocus]);
  const handleEnterNavigation = useFormEnterNavigation();
  const { markPendingPartyEdit, markPendingPartyAdd } = useApplyCustomerOnTabReturn(
    (side, customer, { mode, previousCustomer, contextKey }) => {
      const addedAddressIndex =
        previousCustomer && customer.addresses.length > previousCustomer.addresses.length
          ? resolveAddedAddressIndex(previousCustomer, customer)
          : undefined;
      setValues((current) => {
        if (side === "sender") {
          const currentId = current.senderId?.trim() || current.sender?.id?.trim() || "";
          // Only skip when a different customer is already selected. An empty
          // sender (e.g. after a parent re-render reset) must still accept the
          // customer we just finished editing.
          if (mode === "edit" && currentId && currentId !== customer.id) {
            return current;
          }
          return {
            ...current,
            senderId: customer.id,
            sender: customer,
            senderAddressIndex:
              addedAddressIndex ??
              (mode === "edit"
                ? rematchOrderPartyAddressIndex(
                    current.sender,
                    current.senderAddressIndex,
                    customer,
                  )
                : getInitialOrderPartyAddressIndex(customer)),
          };
        }
        return {
          ...current,
          receivers: current.receivers.map((row) => {
            if (row.key !== contextKey) return row;
            if (mode === "edit" && row.customer?.id && row.customer.id !== customer.id) return row;
            return {
              ...row,
              customer,
              addressIndex: addedAddressIndex ?? (mode === "edit"
                ? rematchOrderPartyAddressIndex(row.customer, row.addressIndex, customer)
                : getInitialOrderPartyAddressIndex(customer)),
            };
          }),
        };
      });
      setFormError(null);
    },
  );
  const isSubmitting = isSubmittingProp || isLocalSubmitting;

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setFormError(null);
    setReceiverToFocus(null);
  }, [initialValues]);

  function updateField<K extends keyof OrderFormValues>(key: K, value: OrderFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  // The party dropdown reports the full customer plus, for a customer with multiple
  // addresses, the specific address the user pressed — mapped back to its index here.
  function updateSender(_senderId: string, sender: Customer, addressId?: string) {
    setValues((current) => ({
      ...current,
      senderId: sender.id,
      sender,
      senderAddressIndex: resolveSelectedOrderPartyAddressIndex(sender, addressId),
    }));
    setFormError(null);
  }

  function addReceiver() {
    const key = crypto.randomUUID();
    setValues((current) => ({
      ...current,
      receivers: [...current.receivers, { key, customer: null, addressIndex: 0 }],
    }));
    setReceiverToFocus(key);
    setFormError(null);
  }

  function removeReceiver(key: string) {
    setValues((current) => ({ ...current, receivers: current.receivers.filter((row) => row.key !== key) }));
    setFormError(null);
    addReceiverButtonRef.current?.focus();
  }

  function updateReceiver(key: string, receiver: Customer, addressId?: string) {
    setValues((current) => ({
      ...current,
      receivers: current.receivers.map((row) => row.key === key ? {
        ...row,
        customer: receiver,
        addressIndex: resolveSelectedOrderPartyAddressIndex(receiver, addressId),
      } : row),
    }));
    setFormError(null);
  }

  function openAddCustomer(side: PartySide, receiverKey?: string) {
    const isReceiver = side === "receiver";
    const partyCustomerType = isReceiver ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER;
    markPendingPartyAdd(side, partyCustomerType, receiverKey);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "add",
      customerType: partyCustomerType,
      label: isReceiver
        ? t("orders.form.partyActions.addReceiver")
        : t("orders.form.partyActions.addSender"),
    });
  }

  function openEditCustomer(side: PartySide, addressIndex?: number, receiverKey?: string) {
    const current = side === "sender" ? values.sender : values.receivers.find((row) => row.key === receiverKey)?.customer;
    if (!current?.id) return;

    markPendingPartyEdit(side, current.id, undefined, receiverKey);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "edit",
      entityId: current.id,
      customerType: side === "receiver" ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER,
      ...(addressIndex != null && addressIndex >= 0 ? { focusAddressIndex: addressIndex } : {}),
      label:
        side === "receiver"
          ? t("orders.form.partyActions.editReceiver")
          : t("orders.form.partyActions.editSender"),
    });
  }

  function openAddAddress(side: PartySide, customer: Customer, receiverKey?: string) {
    if (!customer.id) return;
    markPendingPartyEdit(side, customer.id, customer, receiverKey);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "edit",
      entityId: customer.id,
      customerType: side === "receiver" ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER,
      customerFormIntent: "address",
      label: t("customers.actions.editNamed", { name: customer.name }),
    });
  }

  const unverifiedPartyMessage = t("orders.form.validation.unverifiedSenderAddress");
  // Only senders use Google verification; receivers use a predetermined city list.
  const blockForUnverifiedParty =
    googleMapsConfigured &&
    Boolean(
      values.sender &&
        customerHasUnverifiedAddressAtIndex(values.sender, values.senderAddressIndex),
    );

  const hasValidDate = Boolean(values.date.trim()) && !Number.isNaN(new Date(values.date).getTime());
  const hasMultipleReceivers = values.receivers.length > 1;

  // The single reason the appointment can't be saved yet, evaluated in field order:
  // appointment date → sender → sender address → verified sender → receiver address → comment.
  const blockReason: string | null = (() => {
    if (!hasValidDate) {
      return t("orders.form.validation.pickupDateRequired");
    }
    if (!values.sender) {
      return t("orders.form.validation.senderRequired");
    }
    if (!isOrderPartyAddressChosen(values.sender, values.senderAddressIndex)) {
      return t("orders.form.validation.senderAddressRequired");
    }
    if (blockForUnverifiedParty) {
      return unverifiedPartyMessage;
    }
    if (values.receivers.some((row) => !row.customer)) {
      return t("orders.form.validation.receiverRequired");
    }
    if (new Set(values.receivers.map((row) => row.customer?.id)).size !== values.receivers.length) {
      return t("orders.form.validation.duplicateReceiver");
    }
    if (values.receivers.some((row) => row.customer && !isOrderPartyAddressChosen(row.customer, row.addressIndex))) {
      return t("orders.form.validation.receiverAddressRequired");
    }
    if (!values.comments.some(isOrderCommentComplete)) {
      return t("orders.form.validation.commentRequired");
    }
    if (hasDuplicateOrderCommentItems(values.comments)) {
      return t("orders.form.validation.duplicateCommentItem");
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

    setIsLocalSubmitting(true);
    try {
      const result = await onSubmit(values);
      onFormErrorChange?.(result.error);
      if (!result.error && !isEditing) {
        setValues(resetOrderFormForNextEntry(values));
        setReceiverToFocus(null);
      }
    } finally {
      setIsLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting} className="@container min-h-0 space-y-5 p-4 sm:p-6">
        <div className={isEditing ? "grid gap-5" : "grid items-stretch gap-5 @4xl:grid-cols-2"}>
          <FormSection icon={CalendarDays} title={t("orders.form.workflow.scheduleTitle")} className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div
              className={
                isEditing
                  ? "grid items-end gap-4 @2xl:grid-cols-2 @4xl:grid-cols-4"
                  : "w-full"
              }
            >
              <div className="w-full space-y-1.5">
                <Label htmlFor="date">
                  {t("orders.form.sections.pickupDate")} <span className="text-destructive">*</span>
                </Label>
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
                      {t("orders.form.fields.branch")} <span className="text-destructive">*</span>
                    </Label>
                    <SearchableSelect
                      id="branchId"
                      value={String(values.branchId)}
                      onValueChange={(next) => updateField("branchId", Number(next))}
                      searchPlaceholder={t("orders.form.placeholders.searchBranches")}
                      required
                      mobileSheet
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
                      mobileSheet
                      options={[
                        { value: "", label: t("orders.form.fields.noEmployee") },
                        ...employees.map((employee) => ({
                          value: String(employee.id),
                          label: `${employee.name} · ${employee.department}`,
                        })),
                      ]}
                    />
                  </div>

                  <div className="hidden space-y-1 md:block">
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
                </>
              ) : null}
            </div>
          </FormSection>

          <FormSection
            icon={Users}
            title={t("orders.form.workflow.customersTitle")}
            className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
            action={(
              <Button ref={addReceiverButtonRef} type="button" variant="outline" size="sm" onClick={addReceiver}>
                <UserPlus className="size-4" />
                {t("orders.form.partyActions.addReceiver")}
              </Button>
            )}
          >
            <div ref={receiverPanelRef} className={isEditing ? "grid gap-4 @2xl:grid-cols-2" : "grid gap-4"}>
              <div className="min-w-0 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-4">
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
                <CustomerPartySelect
                  id="senderId"
                  partyType="sender"
                  value={values.senderId}
                  selectedCustomer={values.sender}
                  onValueChange={updateSender}
                  onAddAddress={(customer) => void openAddAddress("sender", customer)}
                  placeholder={t("orders.form.placeholders.selectSender")}
                  required
                  showAddressLabels={false}
                />
                {values.sender && isOrderPartyAddressChosen(values.sender, values.senderAddressIndex) ? (
                  <>
                    <CustomerContactSummary
                      customer={values.sender}
                      addressIndex={values.senderAddressIndex}
                    />
                    <UnverifiedAddressNotice
                      customer={values.sender}
                      addressIndex={values.senderAddressIndex}
                      onUpdateAddress={() => openEditCustomer("sender", values.senderAddressIndex)}
                    />
                  </>
                ) : null}
              </div>

              {values.receivers.length > 0 ? (
                <div className="min-w-0 space-y-2">
                  {hasMultipleReceivers ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
                      <ChevronsDown className="size-3.5 shrink-0" aria-hidden="true" />
                      {t("orders.form.workflow.receiversScrollHint", { count: values.receivers.length })}
                    </p>
                  ) : null}
                  <div
                    className={
                      hasMultipleReceivers
                        ? "max-h-80 space-y-4 overflow-y-auto overscroll-contain rounded-lg pr-1"
                        : "space-y-4"
                    }
                  >
                    {values.receivers.map((row, index) => (
                      <div key={row.key} className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor={`receiver-${row.key}`}>
                            {t("orders.form.fields.receiver")} {index + 1}
                          </Label>
                          <div className="flex items-center gap-1">
                            <PartyFieldActions
                              hasSelection={Boolean(row.customer)}
                              onAdd={() => openAddCustomer("receiver", row.key)}
                              onEdit={() => openEditCustomer("receiver", undefined, row.key)}
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeReceiver(row.key)}
                              aria-label={t("orders.form.partyActions.removeReceiver", { number: index + 1 })}>
                              <X className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <CustomerPartySelect
                          id={`receiver-${row.key}`}
                          partyType="receiver"
                          value={row.customer?.id ?? ""}
                          selectedCustomer={row.customer}
                          onValueChange={(_id, customer, addressId) => updateReceiver(row.key, customer, addressId)}
                          onAddAddress={(customer) => openAddAddress("receiver", customer, row.key)}
                          placeholder={t("orders.form.placeholders.selectReceiver")}
                          pickerTitle={t("orders.form.placeholders.selectReceiver")}
                          searchPlaceholder={t("orders.form.placeholders.selectReceiver")}
                          showAddressLabels={false}
                        />
                        {row.customer && isOrderPartyAddressChosen(row.customer, row.addressIndex) ? (
                          <CustomerContactSummary customer={row.customer} addressIndex={row.addressIndex} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </FormSection>

          <div className={isEditing ? "min-w-0" : "min-w-0 @4xl:col-span-2"}>
            <OrderCommentsEditor comments={values.comments} onChange={(comments) => updateField("comments", comments)} />
          </div>
        </div>

        {values.sender ? (
          <div className="rounded-xl border border-border bg-card p-5">
            <SenderOrderHistorySection
              sender={values.sender}
              currentOrderId={values.id > 0 ? String(values.id) : undefined}
            />
          </div>
        ) : null}
      </FormBody>

      <FormFooter
        error={formError}
        warning={blockReason}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={isBlocked}
        onCancel={onCancel}
      />
    </form>
  );
}
