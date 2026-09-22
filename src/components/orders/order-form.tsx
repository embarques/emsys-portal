"use client";

import { CalendarDays, Keyboard, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";

import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { CustomerPartySelect } from "@/components/customers/customer-party-select";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
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
  const { data: branchesData } = useBranchPicker();
  const employeesQuery = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const { openFormTab } = useWorkspaceTabs();

  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const handleEnterNavigation = useFormEnterNavigation();
  const { markPendingPartyEdit, markPendingPartyAdd } = useApplyCustomerOnTabReturn(
    (side, customer, { mode, previousCustomer }) => {
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
        const currentId = current.receiverId?.trim() || current.receiver?.id?.trim() || "";
        if (mode === "edit" && currentId && currentId !== customer.id) {
          return current;
        }
        return {
          ...current,
          receiverId: customer.id,
          receiver: customer,
          receiverAddressIndex:
            addedAddressIndex ??
            (mode === "edit"
              ? rematchOrderPartyAddressIndex(
                  current.receiver,
                  current.receiverAddressIndex,
                  customer,
                )
              : getInitialOrderPartyAddressIndex(customer)),
        };
      });
      setFormError(null);
    },
  );
  const isSubmitting = isSubmittingProp || isLocalSubmitting;

  useEffect(() => {
    setValues(initialValues ?? createEmptyOrderForm());
    setFormError(null);
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

  function updateReceiver(_receiverId: string, receiver: Customer, addressId?: string) {
    setValues((current) => ({
      ...current,
      receiverId: receiver.id,
      receiver,
      receiverAddressIndex: resolveSelectedOrderPartyAddressIndex(receiver, addressId),
    }));
    setFormError(null);
  }

  function openAddCustomer(side: PartySide) {
    const isReceiver = side === "receiver";
    const partyCustomerType = isReceiver ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER;
    markPendingPartyAdd(side, partyCustomerType);
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

  function openEditCustomer(side: PartySide) {
    const current = side === "sender" ? values.sender : values.receiver;
    if (!current?.id) return;

    markPendingPartyEdit(side, current.id);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "edit",
      entityId: current.id,
      customerType: side === "receiver" ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER,
      label:
        side === "receiver"
          ? t("orders.form.partyActions.editReceiver")
          : t("orders.form.partyActions.editSender"),
    });
  }

  function openAddAddress(side: PartySide, customer: Customer) {
    if (!customer.id) return;
    markPendingPartyEdit(side, customer.id, customer);
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
    isGoogleMapsConfigured() &&
    Boolean(
      values.sender &&
        customerHasUnverifiedAddressAtIndex(values.sender, values.senderAddressIndex),
    );

  const hasValidDate = Boolean(values.date.trim()) && !Number.isNaN(new Date(values.date).getTime());

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
    if (values.receiver && !isOrderPartyAddressChosen(values.receiver, values.receiverAddressIndex)) {
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
      }
    } finally {
      setIsLocalSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting} className="@container min-h-0 space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>{t("orders.form.workflow.requiredHint")}</p>
          <p className="flex items-center gap-1.5">
            <Keyboard className="size-3.5" aria-hidden="true" />
            {t("orders.form.workflow.keyboardHint")}
          </p>
        </div>
        <FormSection icon={CalendarDays} title={t("orders.form.workflow.scheduleTitle")} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid items-end gap-4 @2xl:grid-cols-2 @4xl:grid-cols-4">
            <div className="space-y-1.5">
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
            ) : (
              <p className="self-center text-sm text-muted-foreground @4xl:col-span-3">
                {t("orders.form.workflow.scheduleHint")}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection icon={Users} title={t("orders.form.workflow.customersTitle")} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="grid gap-4 @2xl:grid-cols-2">
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
              <p className="text-xs text-muted-foreground">{t("orders.form.workflow.senderHint")}</p>
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
                    onUpdateAddress={() => openEditCustomer("sender")}
                  />
                </>
              ) : null}
            </div>

            <div className="min-w-0 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="receiverId">
                  {t("orders.form.fields.receiver")}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{t("orders.form.workflow.optional")}</span>
                </Label>
                <PartyFieldActions
                  hasSelection={Boolean(values.receiver)}
                  onAdd={() => openAddCustomer("receiver")}
                  onEdit={() => openEditCustomer("receiver")}
                />
              </div>
              <p className="text-xs text-muted-foreground">{t("orders.form.workflow.receiverHint")}</p>
              <CustomerPartySelect
                id="receiverId"
                partyType="receiver"
                value={values.receiverId}
                selectedCustomer={values.receiver}
                onValueChange={updateReceiver}
                onAddAddress={(customer) => void openAddAddress("receiver", customer)}
                placeholder={t("orders.form.placeholders.noReceiver")}
                pickerTitle={t("orders.form.placeholders.selectReceiver")}
                searchPlaceholder={t("orders.form.placeholders.selectReceiver")}
                showAddressLabels={false}
              />
              {values.receiver && isOrderPartyAddressChosen(values.receiver, values.receiverAddressIndex) ? (
                <>
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

        <OrderCommentsEditor comments={values.comments} onChange={(comments) => updateField("comments", comments)} />

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
