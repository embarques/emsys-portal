"use client";

import { ArrowLeft, CalendarDays, ClipboardList, Loader2, Save, History, UserPlus, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormBody, FormFooterNoticeMessage, FormSection } from "@/components/forms/form-shell";
import { wizardInputFieldProps, wizardSelectClassNameFor, wizardSelectFieldProps } from "@/components/invoices/invoice-wizard-styles";

import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SwitchField } from "@/components/ui/switch-field";
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
  isOrderPartyAddressChosen,
  rematchOrderPartyAddressIndex,
  resetOrderFormForNextEntry,
  resolveSelectedOrderPartyAddressIndex,
  type OrderFormSubmitResult,
  type OrderFormValues,
} from "@/lib/orders/types";
import {
  getAppointmentDetailsError,
  getAppointmentReceiversError,
  getAppointmentStepError,
  getCompleteAppointmentReceivers,
  getOtherReceiverCustomerIds,
  hasEmptyAppointmentReceiverTemplate,
  withTrailingEmptyAppointmentReceiver,
} from "@/lib/orders/utils/appointment-form-steps";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
type CreatePhase = "details" | "receivers";
type EditPartyTab = "sender" | "receivers";

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
  const [historySenderId, setHistorySenderId] = useState<string | null>(null);
  const showHistory = Boolean(values.sender && historySenderId === values.sender.id);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [skipReceivers, setSkipReceivers] = useState(true);
  const [createPhase, setCreatePhase] = useState<CreatePhase>("details");
  const [editPartyTab, setEditPartyTab] = useState<EditPartyTab>("sender");
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
        const nextReceivers = current.receivers.map((row) => {
          if (row.key !== contextKey) return row;
          if (mode === "edit" && row.customer?.id && row.customer.id !== customer.id) return row;
          return {
            ...row,
            customer,
            addressIndex: addedAddressIndex ?? (mode === "edit"
              ? rematchOrderPartyAddressIndex(row.customer, row.addressIndex, customer)
              : getInitialOrderPartyAddressIndex(customer)),
          };
        });
        return {
          ...current,
          receivers: withTrailingEmptyAppointmentReceiver(nextReceivers),
        };
      });
      setFormError(null);
    },
  );
  const isSubmitting = isSubmittingProp || isLocalSubmitting;
  const showReceiversStep = !isEditing && createPhase === "receivers";

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setHistorySenderId(null);
    setFormError(null);
    setReceiverToFocus(null);
    setSkipReceivers(true);
    setCreatePhase("details");
    setEditPartyTab("sender");
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

  function clearSender() {
    setValues((current) => ({ ...current, senderId: "", sender: null, senderAddressIndex: 0 }));
    setFormError(null);
  }

  function addReceiver() {
    const key = crypto.randomUUID();
    setValues((current) => ({
      ...current,
      receivers: [...current.receivers, { key, customer: null, addressIndex: 0 }],
    }));
    if (isEditing) setEditPartyTab("receivers");
    setReceiverToFocus(key);
    setFormError(null);
  }

  function removeReceiver(key: string) {
    const remaining = values.receivers.filter((row) => row.key !== key);
    setValues((current) => ({ ...current, receivers: current.receivers.filter((row) => row.key !== key) }));
    if (isEditing && remaining.length === 0) setEditPartyTab("sender");
    setFormError(null);
    addReceiverButtonRef.current?.focus();
  }

  function updateReceiver(key: string, receiver: Customer, addressId?: string) {
    const emptyKey = crypto.randomUUID();
    let appendedEmpty = false;
    setValues((current) => {
      const nextReceivers = current.receivers.map((row) =>
        row.key === key
          ? {
              ...row,
              customer: receiver,
              addressIndex: resolveSelectedOrderPartyAddressIndex(receiver, addressId),
            }
          : row,
      );
      if (hasEmptyAppointmentReceiverTemplate(nextReceivers)) {
        return { ...current, receivers: nextReceivers };
      }
      appendedEmpty = true;
      return {
        ...current,
        receivers: [...nextReceivers, { key: emptyKey, customer: null, addressIndex: 0 }],
      };
    });
    if (appendedEmpty) setReceiverToFocus(emptyKey);
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

  // Only senders use Google verification; receivers use a predetermined city list.
  const blockForUnverifiedParty =
    googleMapsConfigured &&
    Boolean(
      values.sender &&
        customerHasUnverifiedAddressAtIndex(values.sender, values.senderAddressIndex),
    );

  const detailsValidationKey = getAppointmentDetailsError(values, blockForUnverifiedParty);
  const receiversValidationKey = getAppointmentReceiversError(values);
  const editValidationKey = isEditing
    ? getAppointmentStepError(values, 3, blockForUnverifiedParty)
    : null;

  const blockReasonKey = showReceiversStep
    ? (detailsValidationKey ?? receiversValidationKey)
    : isEditing
      ? editValidationKey
      : detailsValidationKey;
  const blockReason = blockReasonKey ? t(blockReasonKey) : null;

  const primaryLabel = !isEditing && createPhase === "details" && !skipReceivers
    ? t("orders.form.workflow.next")
    : submitLabel;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (isSubmitting) return;

    if (!isEditing && createPhase === "details" && !skipReceivers) {
      if (detailsValidationKey) {
        const message = t(detailsValidationKey);
        setFormError(message);
        onFormErrorChange?.(message);
        return;
      }
      setFormError(null);
      onFormErrorChange?.(null);
      setValues((current) => ({
        ...current,
        receivers: withTrailingEmptyAppointmentReceiver(current.receivers),
      }));
      setCreatePhase("receivers");
      return;
    }

    if (blockReasonKey) {
      const message = t(blockReasonKey);
      setFormError(message);
      onFormErrorChange?.(message);
      return;
    }

    const submitValues = {
      ...values,
      receivers:
        !isEditing && skipReceivers ? [] : getCompleteAppointmentReceivers(values.receivers),
    };

    setIsLocalSubmitting(true);
    try {
      const result = await onSubmit(submitValues);
      onFormErrorChange?.(result.error);
      if (!result.error && !result.cancelled && !isEditing) {
        setValues(resetOrderFormForNextEntry(values));
        setHistorySenderId(null);
        setReceiverToFocus(null);
        setSkipReceivers(true);
        setCreatePhase("details");
      }
    } finally {
      setIsLocalSubmitting(false);
    }
  }

  function renderReceiverList(fillHeight: boolean) {
    if (values.receivers.length === 0) {
      return (
        <p className="rounded-lg border border-dashed border-input px-3 py-6 text-center text-sm text-foreground/75">
          {t("orders.form.workflow.receiversEmpty")}
        </p>
      );
    }

    return (
      <div
        ref={receiverPanelRef}
        className={cn(
          "-m-1 min-h-0 space-y-3 overflow-y-auto p-1",
          fillHeight ? "max-h-[28rem] flex-1 @3xl:max-h-none @3xl:min-h-0" : "max-h-[28rem]",
        )}
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
              triggerClassName={wizardSelectClassNameFor(row.customer?.id)}
              partyType="receiver"
              value={row.customer?.id ?? ""}
              selectedCustomer={row.customer}
              onValueChange={(_id, customer, addressId) => updateReceiver(row.key, customer, addressId)}
              onAddAddress={(customer) => openAddAddress("receiver", customer, row.key)}
              placeholder={t("orders.form.placeholders.selectReceiver")}
              pickerTitle={t("orders.form.placeholders.selectReceiver")}
              searchPlaceholder={t("orders.form.placeholders.selectReceiver")}
              showAddressLabels={false}
              excludedCustomerIds={getOtherReceiverCustomerIds(values.receivers, row.key)}
            />
            {row.customer && isOrderPartyAddressChosen(row.customer, row.addressIndex) ? (
              <CustomerContactSummary customer={row.customer} addressIndex={row.addressIndex} />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  function renderScheduleSection() {
    const dateInput = (
      <>
        <Label htmlFor="date" className={isEditing ? undefined : "sr-only"}>
          {t("orders.form.sections.pickupDate")}
          {isEditing ? <span className="text-destructive"> *</span> : null}
        </Label>
        <DateInput
          id="date"
          {...wizardInputFieldProps(
            values.date,
            isEditing ? "pl-9 md:pl-8" : "h-9 w-[12.5rem] pl-9 sm:w-[14rem] md:pl-8",
          )}
          value={values.date}
          onChange={(event) => updateField("date", event.target.value)}
          required
        />
      </>
    );

    // Create: one compact header row (title + date) so sender can use the rest of the column.
    if (!isEditing) {
      return (
        <FormSection
          variant="card"
          icon={CalendarDays}
          title={`01 · ${t("orders.form.workflow.scheduleStep")}`}
          required
          className="shrink-0 space-y-0 p-3"
          action={<div className="flex items-center">{dateInput}</div>}
        >
          {null}
        </FormSection>
      );
    }

    return (
      <FormSection
        variant="card"
        icon={CalendarDays}
        title={`01 · ${t("orders.form.workflow.scheduleStep")}`}
        className="shrink-0"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">{dateInput}</div>
          <div className="space-y-1">
            <Label htmlFor="branchId">
              {t("orders.form.fields.branch")} <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="branchId"
              {...wizardSelectFieldProps(values.branchId)}
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
              {...wizardSelectFieldProps(values.employeeId)}
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
              {...wizardInputFieldProps(values.sectorId)}
              type="number"
              min="0"
              value={values.sectorId}
              onChange={(event) =>
                updateField("sectorId", event.target.value ? Number(event.target.value) : "")
              }
            />
          </div>
        </div>
      </FormSection>
    );
  }

  function renderSenderHistoryAction() {
    if (!values.sender) return null;
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setHistorySenderId(showHistory ? null : values.sender?.id ?? null)}
        aria-pressed={showHistory}
      >
        {showHistory ? <ArrowLeft className="size-4" /> : <History className="size-4" />}
        {t(showHistory ? "orders.history.backToDetails" : "orders.history.expand")}
      </Button>
    );
  }

  function renderSenderBody(fill: boolean) {
    return (
      <>
        {showHistory && values.sender ? (
          <SenderOrderHistorySection
            sender={values.sender}
            currentOrderId={values.id > 0 ? String(values.id) : undefined}
            variant="embedded"
          />
        ) : null}
        <div className={cn(showHistory ? "hidden" : undefined, fill && "flex min-h-0 flex-1 flex-col")}>
          <div
            className={cn(
              "min-w-0 space-y-3 rounded-lg border border-primary/20 bg-primary/[0.03] p-4",
              fill && "flex min-h-0 flex-1 flex-col",
            )}
          >
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
              triggerClassName={wizardSelectClassNameFor(values.senderId)}
              partyType="sender"
              value={values.senderId}
              selectedCustomer={values.sender}
              onValueChange={updateSender}
              onClear={clearSender}
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
                  detailed={fill}
                  missingPhoneLabel={t("orders.form.workflow.senderMissingPhone")}
                  missingAddressLabel={t("orders.form.workflow.senderMissingAddress")}
                />
                <UnverifiedAddressNotice
                  customer={values.sender}
                  addressIndex={values.senderAddressIndex}
                  onUpdateAddress={() => openEditCustomer("sender", values.senderAddressIndex)}
                />
              </>
            ) : fill ? (
              <p className="rounded-lg border border-dashed border-input px-3 py-4 text-sm text-foreground/75">
                {t("orders.form.workflow.senderEmptyHint")}
              </p>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  function renderSenderSection(fill: boolean) {
    return (
      <FormSection
        variant="card"
        fill={fill}
        icon={showHistory ? History : Users}
        title={showHistory ? t("orders.history.sectionTitle") : `02 · ${t("orders.form.workflow.senderStep")}`}
        className={cn(fill ? "@3xl:min-h-0 @3xl:flex-1" : "shrink-0", "[&>div:first-child]:flex-wrap")}
        action={renderSenderHistoryAction()}
      >
        {renderSenderBody(fill)}
      </FormSection>
    );
  }

  function renderEditPartySection() {
    const hasReceivers = values.receivers.length > 0;
    const showingReceivers = hasReceivers && editPartyTab === "receivers";
    const showingHistory = !showingReceivers && showHistory;

    return (
      <FormSection
        variant="card"
        fill
        icon={showingReceivers ? Users : showingHistory ? History : Users}
        title={
          showingReceivers
            ? `03 · ${t("orders.form.workflow.receiverStep")}`
            : showingHistory
              ? t("orders.history.sectionTitle")
              : `02 · ${t("orders.form.workflow.senderStep")}`
        }
        description={showingReceivers ? t("orders.form.workflow.receiversStepHint") : undefined}
        className="@3xl:min-h-0 @3xl:flex-1 [&>div:first-child]:flex-wrap"
        action={
          showingReceivers ? (
            <Button ref={addReceiverButtonRef} type="button" variant="outline" size="sm" onClick={addReceiver}>
              <UserPlus className="size-4" />
              {t("orders.form.partyActions.addReceiver")}
            </Button>
          ) : (
            renderSenderHistoryAction()
          )
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {hasReceivers ? (
            <SegmentedControl
              id="edit-party-tab"
              aria-label={t("orders.form.workflow.partyTabGroup")}
              value={editPartyTab}
              onValueChange={setEditPartyTab}
              className="shrink-0"
              options={[
                { value: "sender", label: t("orders.form.workflow.partyTabSender") },
                {
                  value: "receivers",
                  label: t("orders.form.workflow.partyTabReceiversCount", {
                    count: values.receivers.length,
                  }),
                },
              ]}
            />
          ) : null}

          {showingReceivers ? (
            renderReceiverList(true)
          ) : (
            <>
              {renderSenderBody(true)}
              {!hasReceivers ? (
                <Button
                  ref={addReceiverButtonRef}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 self-start"
                  onClick={addReceiver}
                >
                  <UserPlus className="size-4" />
                  {t("orders.form.partyActions.addReceiver")}
                </Button>
              ) : null}
            </>
          )}
        </div>
      </FormSection>
    );
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting} className="@container min-h-0 min-w-0 space-y-5 overflow-x-hidden bg-background p-4 py-5 md:bg-muted/35 md:p-6">
        <fieldset disabled={isSubmitting} className="min-w-0 @3xl:h-full">
          {showReceiversStep ? (
            <FormSection
              variant="card"
              fill
              icon={Users}
              title={`03 · ${t("orders.form.workflow.receiverStep")}`}
              description={t("orders.form.workflow.receiversStepHint")}
              className="@3xl:min-h-0 @3xl:h-full @3xl:self-stretch"
              action={(
                <Button ref={addReceiverButtonRef} type="button" variant="outline" size="sm" onClick={addReceiver}>
                  <UserPlus className="size-4" />{t("orders.form.partyActions.addReceiver")}
                </Button>
              )}
            >
              {renderReceiverList(true)}
            </FormSection>
          ) : (
            <div className="grid items-start gap-5 @3xl:h-full @3xl:grid-cols-2 @3xl:grid-rows-[minmax(0,1fr)]">
              <div className="flex min-h-0 min-w-0 flex-col gap-3 @3xl:h-full @3xl:self-stretch @3xl:overflow-hidden">
                {renderScheduleSection()}
                {isEditing ? (
                  renderEditPartySection()
                ) : (
                  <>
                    {renderSenderSection(true)}
                    <SwitchField
                      id="skip-receivers"
                      className="shrink-0"
                      label={t("orders.form.workflow.skipReceivers")}
                      description={t("orders.form.workflow.skipReceiversHint")}
                      checked={skipReceivers}
                      onCheckedChange={(checked) => {
                        setSkipReceivers(checked);
                        setFormError(null);
                      }}
                    />
                  </>
                )}
              </div>

              <FormSection
                variant="card"
                fill
                icon={ClipboardList}
                title={`04 · ${t("orders.form.workflow.purposeStep")}`}
                required
                className="@3xl:min-h-0 @3xl:self-stretch"
              >
                <OrderCommentsEditor
                  quickEntry
                  comments={values.comments}
                  onChange={(comments) => updateField("comments", comments)}
                  listClassName="max-h-[28rem] @3xl:max-h-none @3xl:min-h-40 @3xl:flex-1"
                  senderId={values.sender?.id || values.senderId}
                  senderName={values.sender?.name}
                />
              </FormSection>
            </div>
          )}
        </fieldset>
      </FormBody>

      <div className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-5 md:pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 md:flex-1">
            {(formError || blockReason) ? (
              <FormFooterNoticeMessage tone={formError ? "error" : "warning"} message={formError || blockReason || ""} />
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0 md:items-center">
            {showReceiversStep ? (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => {
                  setCreatePhase("details");
                  setFormError(null);
                }}
                className="h-12 rounded-xl px-4 text-base md:h-9 md:rounded-md md:text-sm"
              >
                <ArrowLeft className="size-4" />
                {t("orders.form.workflow.backToDetails")}
              </Button>
            ) : (
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={onCancel}
                className="h-12 rounded-xl px-4 text-base md:h-9 md:rounded-md md:text-sm">
                {t("common.actions.cancel")}
              </Button>
            )}
            <Button data-wizard-primary type="submit" disabled={isSubmitting || Boolean(blockReasonKey)}
              className="h-12 rounded-xl px-4 text-base md:h-9 md:rounded-md md:text-sm">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : !isEditing && createPhase === "details" && !skipReceivers ? null : (
                <Save className="size-4" />
              )}
              {isSubmitting ? t("common.actions.saving") : primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
