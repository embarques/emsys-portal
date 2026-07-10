"use client";

import { CalendarDays, Pencil, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { CustomerPartySelect } from "@/components/customers/customer-party-select";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { OrderCommentsEditor } from "@/components/orders/order-comments-editor";
import { SenderOrderHistorySection } from "@/components/orders/sender-order-history-section";
import { formatCustomerMutationError } from "@/lib/customers/customer-create-error";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import {
  useCreateCustomer,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import {
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  createEmptyCustomerForm,
  customerToFormValues,
  type Customer,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import {
  createEmptyOrderForm,
  customerHasUnverifiedAddressAtIndex,
  getInitialOrderPartyAddressIndex,
  isOrderPartyAddressChosen,
  resetOrderFormForNextEntry,
  resolveOrderPartyAddressIndex,
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
  isSubmitting: isSubmittingProp = false,
  onSubmit,
  onFormErrorChange,
  onCancel,
}: OrderFormProps) {
  const { t } = useTranslation();
  const { data: branchesData } = useBranchPicker();
  const employeesQuery = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { isDesktopTabs, openFormTab } = useWorkspaceTabs();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  const branches = branchesData?.items ?? [];
  const employees = employeesQuery.data?.items ?? [];

  const [values, setValues] = useState<OrderFormValues>(initialValues ?? createEmptyOrderForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  const [customerDialog, setCustomerDialog] = useState<CustomerDialogState | null>(null);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const isSavingCustomer = createCustomerMutation.isPending || updateCustomerMutation.isPending;
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

  const dialogCustomer =
    customerDialog?.side === "sender"
      ? values.sender
      : customerDialog?.side === "receiver"
        ? values.receiver
        : null;

  function openAddCustomer(side: PartySide) {
    const isReceiver = side === "receiver";
    // On desktop, open the customer add form in its own workspace tab (party type locked);
    // mobile has no tab bar, so keep the inline dialog.
    if (isDesktopTabs) {
      openFormTab({
        feature: "customers",
        baseHref: "/customers",
        mode: "add",
        customerType: isReceiver ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER,
        label: isReceiver
          ? t("orders.form.partyActions.addReceiver")
          : t("orders.form.partyActions.addSender"),
      });
      return;
    }
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

  // Newly added customers behave like a fresh selection (unset when multi-address);
  // edits keep the previously chosen address when it is still valid.
  function nextPartyAddressIndex(
    customer: Customer,
    mode: "add" | "edit",
    currentIndex: number,
  ): number {
    if (mode === "edit" && currentIndex >= 0) {
      return resolveOrderPartyAddressIndex(customer, currentIndex);
    }
    return getInitialOrderPartyAddressIndex(customer);
  }

  function applyCustomerToSide(side: PartySide, customer: Customer, mode: "add" | "edit") {
    if (side === "sender") {
      setValues((current) => ({
        ...current,
        senderId: customer.id,
        sender: customer,
        senderAddressIndex: nextPartyAddressIndex(customer, mode, current.senderAddressIndex),
      }));
    } else {
      setValues((current) => ({
        ...current,
        receiverId: customer.id,
        receiver: customer,
        receiverAddressIndex: nextPartyAddressIndex(customer, mode, current.receiverAddressIndex),
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

      applyCustomerToSide(customerDialog.side, customer, customerDialog.mode);
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
  // pickup date → sender → sender address → verified sender → receiver address → comment.
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
    if (values.comments.length === 0) {
      return t("orders.form.validation.commentRequired");
    }
    return null;
  })();

  const isBlocked = blockReason != null;
  const unverifiedSenderWarning = blockForUnverifiedParty ? unverifiedPartyMessage : null;

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
    <>
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
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
            <CustomerPartySelect
              id="senderId"
              partyType="sender"
              value={values.senderId}
              selectedCustomer={values.sender}
              onValueChange={updateSender}
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

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="receiverId">{t("orders.form.fields.receiver")}</Label>
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
              placeholder={t("orders.form.placeholders.noReceiver")}
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
        warning={unverifiedSenderWarning}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
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
