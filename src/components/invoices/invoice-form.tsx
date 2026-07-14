"use client";

import { ClipboardList, Pencil, Receipt, UserPlus, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
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
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { UnverifiedAddressNotice } from "@/components/addresses/unverified-address-notice";
import { InvoiceLineItemsEditor } from "@/components/invoices/invoice-line-items-editor";
import { WizardField } from "@/components/invoices/invoice-wizard-field";
import {
  wizardInputFieldProps,
  wizardSelectClassNameFor,
  wizardSelectFieldProps,
} from "@/components/invoices/invoice-wizard-styles";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { formatCustomerMutationError } from "@/lib/customers/customer-create-error";
import { useTranslation } from "@/lib/i18n";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import {
  useCreateCustomer,
  useEnsureCustomerDetail,
  useUpdateCustomer,
} from "@/lib/customers/hooks/use-customers";
import {
  CUSTOMER_TYPE_RECEIVER,
  CUSTOMER_TYPE_SENDER,
  areCustomerFormValuesEquivalent,
  createEmptyCustomerForm,
  customerHasUnverifiedPrimaryAddress,
  customerToFormValues,
  getCustomerPrimaryCoreAddress,
  type Customer,
  type CustomerFormValues,
} from "@/lib/customers/types";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { buildTransactionAssigneeOptions } from "@/lib/accounting/daily-income/assignee";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import type { Branch } from "@/lib/branches/types";
import { useEmployeeSearch, useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS, type Employee } from "@/lib/employees/types";
import {
  INVOICE_PAYMENT_LOCATIONS,
  INVOICE_PICKUP_SOURCES,
  computeInvoiceBalance,
  createEmptyInvoiceForm,
  isInvoiceEmployeePickupSource,
  resetInvoiceFormForNextEntry,
  resolveLineTotal,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
  type InvoicePickupSource,
} from "@/lib/invoices/types";
import { useItemPicker } from "@/lib/items/hooks/use-items";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { DEFAULT_ORDER_LIST_PARAMS, type Order } from "@/lib/orders/types";
import { useOrder, useOrderSearch, useOrders } from "@/lib/orders/hooks/use-orders";
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

/** Sender name, phone, and street let users find a pickup without knowing the order id. */
function buildPickupSearchKeywords(order: Order): string[] {
  const sender = order.sender;
  if (!sender) return [];

  const keywords: string[] = [];
  const name = sender.name.trim();
  if (name) keywords.push(name);

  for (const phone of sender.phones) {
    if (phone.number) keywords.push(phone.number);
    if (phone.displayNumber) keywords.push(phone.displayNumber);
  }

  const primaryAddress = getCustomerPrimaryCoreAddress(sender);
  if (primaryAddress.address1) keywords.push(primaryAddress.address1);

  return keywords;
}

function buildPickupOptionDescriptionLines(order: Order): string[] {
  const sender = order.sender;
  if (!sender) return [];

  const phone = getPrimaryPhoneDisplayNumber(sender.phones);
  const address1 = getCustomerPrimaryCoreAddress(sender).address1.trim();
  return [phone, address1].filter((line) => line.trim());
}

function orderToPickupSelectOption(order: Order): SearchableSelectOption {
  const senderName = order.sender?.name?.trim() ?? "";
  return {
    value: String(order.id),
    label: senderName ? `#${order.id} ${senderName}` : `#${order.id}`,
    descriptionLines: buildPickupOptionDescriptionLines(order),
    keywords: buildPickupSearchKeywords(order),
  };
}

function employeeMatchesPickupSource(
  employee: Employee,
  pickupSource: InvoicePickupSource,
  branchesById: Map<number, Pick<Branch, "type">>,
): boolean {
  if (!employee.active) return false;

  const branchType = branchesById.get(employee.branch.id)?.type.trim().toLowerCase() ?? "";
  const department = employee.department.trim().toLowerCase();
  const title = employee.title.trim().toLowerCase();
  const isWarehouseRole = department === "warehouse" || title === "warehouse";

  if (pickupSource === "warehouse") {
    return branchType === "warehouse" || isWarehouseRole;
  }

  if (pickupSource === "office") {
    return branchType === "office" || (!isWarehouseRole && branchType !== "warehouse");
  }

  return false;
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
        {t("invoices.form.partyActions.new")}
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
          {t("invoices.form.partyActions.edit")}
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
  const { t } = useTranslation();
  const isWizard = appearance === "wizard";
  const { data: containersData } = useContainerPicker();
  const ordersQuery = useOrders(DEFAULT_ORDER_LIST_PARAMS);
  const { notifyAdded, notifySuccess, notifyUpdated } = useFeedback();
  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const ensureCustomerDetail = useEnsureCustomerDetail();

  const { data: itemsData } = useItemPicker();
  const containers = containersData?.items ?? [];
  const defaultOrders = ordersQuery.data?.items ?? [];
  const catalogItems = itemsData?.items ?? [];

  const [values, setValues] = useState<InvoiceFormValues>(() => {
    const base = initialValues ?? createEmptyInvoiceForm();
    if (!isEditing && suggestedInvoiceNumber && !base.invoiceNumber) {
      return { ...base, invoiceNumber: suggestedInvoiceNumber };
    }
    return base;
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [customerDialog, setCustomerDialog] = useState<CustomerDialogState | null>(null);
  const [customerFormError, setCustomerFormError] = useState<string | null>(null);
  const [isLoadingEditCustomer, setIsLoadingEditCustomer] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [pickupEmployeeQuery, setPickupEmployeeQuery] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const isSavingCustomer =
    createCustomerMutation.isPending ||
    updateCustomerMutation.isPending ||
    isLoadingEditCustomer;

  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200);
  const pickupRoutes = pickupRoutesQuery.data?.items ?? [];
  const { data: branchesData } = useBranchPicker();
  const branches = branchesData?.items ?? [];
  const branchesById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch])),
    [branches],
  );
  const isEmployeePickupSource = isInvoiceEmployeePickupSource(values.pickupSource);
  const employeesQuery = useEmployees({
    ...DEFAULT_EMPLOYEE_LIST_PARAMS,
    limit: 200,
    active: true,
  });
  const debouncedPickupEmployeeQuery = useDebouncedValue(pickupEmployeeQuery, 300).trim();
  const pickupEmployeeSearch = useEmployeeSearch(
    debouncedPickupEmployeeQuery
      ? { field: "name", operator: "contains", value: debouncedPickupEmployeeQuery }
      : undefined,
    { enabled: isEmployeePickupSource },
  );
  const pickupRouteOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(pickupRoutes, t),
    [pickupRoutes, t],
  );
  const pickupSourceEmployees = useMemo(() => {
    const source = debouncedPickupEmployeeQuery
      ? (pickupEmployeeSearch.data?.items ?? [])
      : (employeesQuery.data?.items ?? []);

    const filtered = source.filter((employee) =>
      employeeMatchesPickupSource(employee, values.pickupSource, branchesById),
    );

    return filtered.length > 0 ? filtered : source.filter((employee) => employee.active);
  }, [
    branchesById,
    debouncedPickupEmployeeQuery,
    employeesQuery.data?.items,
    pickupEmployeeSearch.data?.items,
    values.pickupSource,
  ]);
  const pickupEmployeeOptions = useMemo(() => {
    const options = buildTransactionAssigneeOptions(pickupSourceEmployees);
    if (
      values.pickupEmployeeId &&
      !options.some((option) => option.value === values.pickupEmployeeId)
    ) {
      const name = values.pickupEmployeeName.trim();
      if (name) {
        options.unshift({ value: values.pickupEmployeeId, label: name });
      }
    }
    return options;
  }, [pickupSourceEmployees, values.pickupEmployeeId, values.pickupEmployeeName]);

  const commitValues = useCallback(
    (updater: InvoiceFormValues | ((current: InvoiceFormValues) => InvoiceFormValues)) => {
      setValues((current) => (typeof updater === "function" ? updater(current) : updater));
    },
    [],
  );

  useEffect(() => {
    if (isWizard) return;

    const base = initialValues ?? createEmptyInvoiceForm();
    setValues(
      !isEditing && suggestedInvoiceNumber && !base.invoiceNumber
        ? { ...base, invoiceNumber: suggestedInvoiceNumber }
        : base,
    );
    setFormError(null);
  }, [initialValues, isEditing, isWizard, suggestedInvoiceNumber]);

  useEffect(() => {
    onValuesChange?.(values);
  }, [onValuesChange, values]);

  const showAllSections = wizardStep == null;
  const showDetailsSection = showAllSections || wizardStep === 1;
  const showPartiesSection = showAllSections || wizardStep === 2;
  const showLineItemsSection = showAllSections || wizardStep === 3;
  const showTotalsSection = (showAllSections || wizardStep === 3) && !isWizard;

  const debouncedPickupQuery = useDebouncedValue(pickupQuery, 300).trim();
  const pickupSearch = useOrderSearch(
    debouncedPickupQuery ? { value: debouncedPickupQuery } : undefined,
    { limit: 40 },
  );
  const selectedPickupQuery = useOrder(values.pickupId || null, Boolean(values.pickupId));

  const pickupSearchResults = pickupSearch.data?.items ?? [];

  const pickupSelectOptions = useMemo(() => {
    const source = debouncedPickupQuery ? pickupSearchResults : defaultOrders;
    const options = source.map(orderToPickupSelectOption);

    const selectedOrder =
      source.find((order) => String(order.id) === values.pickupId) ??
      (selectedPickupQuery.data && String(selectedPickupQuery.data.id) === values.pickupId
        ? selectedPickupQuery.data
        : null);

    if (selectedOrder && !source.some((order) => String(order.id) === values.pickupId)) {
      options.unshift(orderToPickupSelectOption(selectedOrder));
    }

    return options;
  }, [
    debouncedPickupQuery,
    defaultOrders,
    pickupSearchResults,
    selectedPickupQuery.data,
    values.pickupId,
  ]);

  function updateField<K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]) {
    commitValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updatePickupSource(next: InvoicePickupSource) {
    if (next === values.pickupSource) return;
    commitValues((current) => ({
      ...current,
      pickupSource: next,
      routeId: next === "route" ? current.routeId : "",
      officeBranchId: "",
      officeBranchName: "",
      pickupEmployeeId: "",
      pickupEmployeeName: "",
    }));
    setFormError(null);
    setPickupEmployeeQuery("");
  }

  function updatePickupEmployee(employeeId: string) {
    const employee = pickupSourceEmployees.find((entry) => String(entry.id) === employeeId);
    commitValues((current) => ({
      ...current,
      pickupEmployeeId: employeeId,
      pickupEmployeeName: employee?.name ?? "",
      officeBranchId: employee ? String(employee.branch.id) : "",
      officeBranchName: employee
        ? `${employee.branch.code} — ${employee.branch.name}`.trim()
        : "",
    }));
    setFormError(null);
  }

  function updatePickupReference(next: string) {
    const source = debouncedPickupQuery ? pickupSearchResults : defaultOrders;
    const selectedOrder =
      source.find((order) => String(order.id) === next) ??
      (selectedPickupQuery.data && String(selectedPickupQuery.data.id) === next
        ? selectedPickupQuery.data
        : undefined);

    commitValues((current) => ({
      ...current,
      pickupId: next,
      ...(selectedOrder?.sender
        ? { senderId: selectedOrder.sender.id, sender: selectedOrder.sender }
        : {}),
    }));
    setFormError(null);
  }

  function updateSender(_senderId: string, sender: Customer) {
    commitValues((current) => ({ ...current, senderId: sender.id, sender }));
    setFormError(null);
  }

  function updateReceiver(_receiverId: string, receiver: Customer) {
    commitValues((current) => ({ ...current, receiverId: receiver.id, receiver }));
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

  async function openEditCustomer(side: PartySide) {
    const current = side === "sender" ? values.sender : values.receiver;
    if (!current?.id) return;

    setCustomerFormError(null);
    setIsLoadingEditCustomer(true);

    try {
      // Invoice parties are often a single `party.address` snapshot (marked primary).
      // Reload GET /customers/{id} so Edit shows the full address book — same as orders.
      const fullCustomer = await ensureCustomerDetail(current.id);
      applyCustomerToSide(side, fullCustomer);
      setEditCustomer(fullCustomer);
      setCustomerDialog({ side, mode: "edit" });
    } catch {
      setEditCustomer(null);
      setCustomerFormError(t("common.errors.fallback"));
    } finally {
      setIsLoadingEditCustomer(false);
    }
  }

  function closeCustomerDialog() {
    setCustomerDialog(null);
    setEditCustomer(null);
    setCustomerFormError(null);
  }

  function applyCustomerToSide(side: PartySide, customer: Customer) {
    if (side === "sender") {
      commitValues((current) => ({ ...current, senderId: customer.id, sender: customer }));
    } else {
      commitValues((current) => ({ ...current, receiverId: customer.id, receiver: customer }));
    }
    setFormError(null);
  }

  async function handleCustomerSubmit(formValues: CustomerFormValues) {
    if (!customerDialog) return;
    setCustomerFormError(null);

    try {
      let customer: Customer;

      if (customerDialog.mode === "edit" && dialogCustomer) {
        if (areCustomerFormValuesEquivalent(formValues, customerToFormValues(dialogCustomer))) {
          notifySuccess(t("common.form.noChanges"));
          closeCustomerDialog();
          return;
        }

        customer = await updateCustomerMutation.mutateAsync({
          customerId: (editCustomer ?? dialogCustomer).id,
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

  const subtotal = useMemo(
    () => values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0),
    [values.lineItems],
  );
  const discount = Number(values.discount) || 0;
  const amountPaid = Number(values.amountPaid) || 0;
  const balance = computeInvoiceBalance(subtotal, discount, amountPaid);

  const unverifiedPartyMessage = t("invoices.wizard.validation.unverifiedSenderAddress");
  // Only senders use Google verification; receivers use a predetermined city list.
  const blockForUnverifiedParty =
    isGoogleMapsConfigured() &&
    Boolean(values.sender && customerHasUnverifiedPrimaryAddress(values.sender));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!values.sender) {
      const message = t("invoices.form.validation.senderRequired");
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

  const pickupEmployeeFieldLabel =
    values.pickupSource === "warehouse"
      ? t("invoices.form.fields.warehouseEmployee")
      : t("invoices.form.fields.officeEmployee");
  const pickupEmployeePlaceholder =
    values.pickupSource === "warehouse"
      ? t("invoices.form.placeholders.selectWarehouseEmployee")
      : t("invoices.form.placeholders.selectOfficeEmployee");

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

  const pickupReferenceField = renderField(
    t("invoices.form.fields.pickupReference"),
    "pickupId",
    false,
    <SearchableSelect
      id="pickupId"
      value={values.pickupId}
      onValueChange={updatePickupReference}
      placeholder={t("invoices.form.placeholders.noPickupReference")}
      searchPlaceholder={t("invoices.form.placeholders.searchPickupReferences")}
      manualFiltering
      loading={pickupSearch.isFetching}
      onSearchChange={setPickupQuery}
      {...(isWizard ? wizardSelectFieldProps(values.pickupId) : {})}
      options={[
        ...(debouncedPickupQuery
          ? []
          : [{ value: "", label: t("invoices.form.placeholders.noPickupReference") }]),
        ...pickupSelectOptions,
      ]}
    />,
  );

  const detailsFields = (
    <div className={cn("grid gap-5", isWizard ? "sm:grid-cols-2" : "gap-2.5 sm:grid-cols-2")}>
      {renderField(
        t("invoices.form.fields.date"),
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
        t("invoices.form.fields.invoiceNumber"),
        "invoiceNumber",
        true,
        <Input
          id="invoiceNumber"
          value={values.invoiceNumber}
          onChange={(event) => updateField("invoiceNumber", event.target.value)}
          placeholder={t("invoices.form.placeholders.invoiceNumber")}
          {...(isWizard ? wizardInputFieldProps(values.invoiceNumber) : {})}
          required
        />,
      )}
      {renderField(
        t("invoices.form.fields.container"),
        "containerId",
        true,
        <SearchableSelect
          id="containerId"
          value={values.containerId}
          onValueChange={(next) => updateField("containerId", next)}
          placeholder={t("invoices.form.placeholders.selectContainer")}
          searchPlaceholder={t("invoices.form.placeholders.searchContainers")}
          {...(isWizard ? wizardSelectFieldProps(values.containerId) : {})}
          required
          options={[
            { value: "", label: t("invoices.form.placeholders.selectContainer") },
            ...containers.map((container) => ({
              value: String(container.id),
              label: formatContainerLabel(container),
            })),
          ]}
        />,
      )}
      {renderField(
        t("invoices.form.fields.pending"),
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
        t("invoices.form.fields.pickupSource"),
        "pickupSource",
        false,
        <SearchableSelect
          id="pickupSource"
          value={values.pickupSource}
          onValueChange={(next) => updatePickupSource(next as InvoicePickupSource)}
          searchable={false}
          {...(isWizard ? wizardSelectFieldProps(values.pickupSource) : {})}
          options={INVOICE_PICKUP_SOURCES.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />,
      )}
      {values.pickupSource === "route"
        ? renderField(
            t("invoices.form.fields.pickupRoute"),
            "routeId",
            true,
            <SearchableSelect
              id="routeId"
              value={values.routeId}
              onValueChange={(next) => updateField("routeId", next)}
              placeholder={t("invoices.form.placeholders.selectPickupRoute")}
              searchPlaceholder={t("invoices.form.placeholders.searchPickupRoutes")}
              loading={pickupRoutesQuery.isFetching}
              required
              {...(isWizard ? wizardSelectFieldProps(values.routeId) : {})}
              options={[
                { value: "", label: t("invoices.form.placeholders.selectPickupRoute") },
                ...pickupRouteOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
            />,
          )
        : renderField(
            pickupEmployeeFieldLabel,
            "pickupEmployeeId",
            true,
            <SearchableSelect
              id="pickupEmployeeId"
              value={values.pickupEmployeeId}
              onValueChange={updatePickupEmployee}
              placeholder={pickupEmployeePlaceholder}
              searchPlaceholder={t("invoices.form.placeholders.searchEmployees")}
              manualFiltering
              loading={pickupEmployeeSearch.isFetching || employeesQuery.isFetching}
              onSearchChange={setPickupEmployeeQuery}
              required
              {...(isWizard ? wizardSelectFieldProps(values.pickupEmployeeId) : {})}
              options={[
                ...(debouncedPickupEmployeeQuery
                  ? []
                  : [{ value: "", label: pickupEmployeePlaceholder }]),
                ...pickupEmployeeOptions,
              ]}
            />,
          )}
    </div>
  );

  const partiesFields = (
    <div className={cn("grid gap-5", isWizard ? "sm:grid-cols-2" : "gap-2.5 sm:grid-cols-2")}>
      <div className="sm:col-span-2">{pickupReferenceField}</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          {isWizard ? (
            <Label htmlFor="senderId" className="text-xs font-normal text-muted-foreground">
              {t("invoices.form.fields.sender")} <span className="text-destructive">*</span>
            </Label>
          ) : (
            <Label htmlFor="senderId">
              {t("invoices.form.fields.sender")} <span className="text-destructive">*</span>
            </Label>
          )}
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
          placeholder={t("invoices.form.placeholders.selectSender")}
          required
          showAddressLabels={false}
          triggerClassName={isWizard ? wizardSelectClassNameFor(values.senderId) : undefined}
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
              {t("invoices.form.fields.receiver")}
            </Label>
          ) : (
            <Label htmlFor="receiverId">{t("invoices.form.fields.receiver")}</Label>
          )}
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
          placeholder={t("invoices.form.placeholders.noReceiver")}
          showAddressLabels={false}
          triggerClassName={isWizard ? wizardSelectClassNameFor(values.receiverId) : undefined}
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
              <FormSection icon={Receipt} title={t("invoices.form.sections.invoiceDetails")} required>
                {detailsFields}
              </FormSection>
            )
          ) : null}

          {showPartiesSection ? (
            isWizard ? (
              partiesFields
            ) : (
              <FormSection icon={Users} title={t("invoices.form.sections.senderReceiver")}>
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
              <FormSection icon={ClipboardList} title={t("invoices.form.sections.description")}>
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
                ? customerDialog.side === "receiver"
                  ? t("invoices.form.partyActions.editReceiver")
                  : t("invoices.form.partyActions.editSender")
                : customerDialog?.side === "receiver"
                  ? t("invoices.form.partyActions.addReceiver")
                  : t("invoices.form.partyActions.addSender")}
            </DialogTitle>
          </DialogHeader>
          {customerDialog ? (
            <CustomerForm
              key={`${customerDialog.side}-${customerDialog.mode}-${editCustomer?.id ?? dialogCustomer?.id ?? "new"}-${editCustomer?.addresses.length ?? 0}`}
              initialValues={
                customerDialog.mode === "edit" && editCustomer
                  ? customerToFormValues(editCustomer)
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
