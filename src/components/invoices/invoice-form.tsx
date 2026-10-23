"use client";

import { ClipboardList, Container as ContainerIcon, Receipt, Route, UserPlus, Users, Wallet } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useFormEnterNavigation, selectFormFieldTextOnFocus } from "@/hooks/use-form-enter-navigation";
import { ContainerForm } from "@/components/containers/container-form";

import { CustomerPartySelect } from "@/components/customers/customer-party-select";
import { EmployeeForm } from "@/components/employees/employee-form";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";

import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { InvoiceNumberModeFields } from "@/components/invoices/invoice-number-switch";
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
import { focusInvoiceWizardField } from "@/components/invoices/invoice-wizard-focus";
import {
  wizardInputFieldProps,
  wizardSelectClassNameFor,
  wizardSelectFieldProps,
} from "@/components/invoices/invoice-wizard-styles";
import { useIsGoogleMapsConfigured } from "@/lib/company/hooks/use-current-company";

import { useApplyCustomerOnTabReturn } from "@/lib/customers/hooks/use-apply-customer-on-tab-return";
import { useTranslation } from "@/lib/i18n";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { normalizeApiError } from "@/lib/api/axios";
import { useContainerPicker, useCreateContainer } from "@/lib/containers/hooks/use-containers";
import {
  createEmptyContainerForm,
  type ContainerFormValues,
} from "@/lib/containers/types";
import { useEnsureCustomerDetail } from "@/lib/customers/hooks/use-customers";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER, coreAddressHasContent, customerHasUnverifiedPrimaryAddress, getCustomerPrimaryCoreAddress, type Customer } from "@/lib/customers/types";
import { formatContainerIdLabel, formatContainerLabel } from "@/lib/containers/display";
import { formatInvoiceDate, formatInvoiceMoney } from "@/lib/invoices/display";
import { INVOICE_WIZARD_FIELDS } from "@/lib/invoices/invoice-wizard-validation";
import { getPrimaryPhoneDisplayNumber } from "@/lib/phones/phones";
import { buildTransactionAssigneeOptions } from "@/lib/accounting/daily-income/assignee";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import type { Branch } from "@/lib/branches/types";
import {
  useCreateEmployee,
  useEmployeeSearch,
  useEmployees,
  useEnsureEmployeeDetail,
} from "@/lib/employees/hooks/use-employees";
import { useApplyCreatedOnTabReturn } from "@/lib/layout/hooks/use-apply-created-on-tab-return";
import {
  createEmptyEmployeeForm,
  DEFAULT_EMPLOYEE_LIST_PARAMS,
  type Employee,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import {
  mapPaymentLocationToPaidRegion,
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
import {
  PICKUP_ROUTE_FORM_FEATURE,
  PICKUP_ROUTES_DIRECTORY_VARIANT,
} from "@/lib/pickup-delivery-routes/directory-variant";
import {
  buildActiveRouteAssignmentOptions,
  formatActiveRouteAssignmentLabel,
} from "@/lib/pickup-delivery-routes/display";
import { isDeliveryBranchCode } from "@/lib/pickup-delivery-routes/types";
import {
  useActiveRoutePicker,
  useEnsurePickupRouteDetail,
} from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { DEFAULT_ORDER_LIST_PARAMS, getUniqueOrderReceivers, type Order } from "@/lib/orders/types";
import { useOrder, useOrderSearch, useOrders } from "@/lib/orders/hooks/use-orders";
import { cn } from "@/lib/utils";

type InvoiceFormProps = {
  initialValues?: InvoiceFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  externalError?: string | null;
  onSubmit: (values: InvoiceFormValues) => InvoiceFormSubmitResult;
  onFormErrorChange?: (error: string | null) => void;
  onCancel: () => void;
  /** When set, only the matching section is rendered (wizard mode). */
  wizardStep?: 1 | 2 | 3;
  wizardTotalSteps?: number;
  appearance?: "default" | "wizard" | "phoneWizard";
  showFooter?: boolean;
  /** Hide pending payment branch when the wizard payment step owns that field. */
  showPaymentLocation?: boolean;
  onValuesChange?: (values: InvoiceFormValues) => void;
  /** Wizard Next: called when Enter is pressed on invoice number or the last field. */
  onContinue?: () => void;
  /** Focus this field after a wizard validation error. */
  focusFieldId?: string | null;
  focusFieldKey?: number;
  /** Open this line item in edit mode when the line-items step mounts. */
  requestEditLineItemId?: string | null;
  /** Preselect the newest container when the form opens without one (new invoices only). */
  defaultToLatestContainer?: boolean;
  /**
   * `canCreateAssignedInvoice` flow: details are read-only and parties come only
   * from the appointment (choose among its receivers; no customer add/edit).
   */
  assignedMode?: boolean;
};

function ReadOnlyField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}

type PartySide = "sender" | "receiver";

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

const getPickupReceivers = getUniqueOrderReceivers;

function receiverToPickupSelectOption(receiver: Customer): SearchableSelectOption {
  const phone = getPrimaryPhoneDisplayNumber(receiver.phones);
  const address = getCustomerPrimaryCoreAddress(receiver);
  const location = [address.address1, address.city].map((part) => part.trim()).filter(Boolean).join(", ");
  return {
    value: receiver.id,
    label: receiver.name,
    descriptionLines: [phone, location].filter((line) => line.trim()),
    keywords: [receiver.name, phone, address.address1, address.city].filter((value) => value.trim()),
  };
}

function employeeMatchesPickupSource(
  employee: Employee,
  pickupSource: InvoicePickupSource,
  branchesById: Map<number, Pick<Branch, "type">>,
): boolean {
  if (!employee.active || isDeliveryBranchCode(employee.branch.code)) return false;

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
  return (
    <FieldEntityActions
      hasSelection={hasSelection}
      onAdd={onAdd}
      onEdit={onEdit}
      addIcon={UserPlus}
    />
  );
}

export function InvoiceForm({
  initialValues,
  isEditing = false,
  submitLabel,
  externalError = null,
  onSubmit,
  onFormErrorChange,
  onCancel,
  wizardStep,
  appearance = "default",
  showFooter = true,
  showPaymentLocation = true,
  onValuesChange,
  onContinue,
  focusFieldId = null,
  focusFieldKey = 0,
  requestEditLineItemId = null,
  defaultToLatestContainer = false,
  assignedMode = false,
}: InvoiceFormProps) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canUseManualNumber = hasPermission(PERMISSIONS.invoicesManualNumber.name, PERMISSIONS.invoicesManualNumber.resourceType);
  const googleMapsConfigured = useIsGoogleMapsConfigured();
  const isPhoneWizard = appearance === "phoneWizard";
  const isWizard = appearance === "wizard" || isPhoneWizard;
  const { data: containersData } = useContainerPicker();
  const ordersQuery = useOrders(DEFAULT_ORDER_LIST_PARAMS);
  const { openFormTab, isDesktopTabs } = useWorkspaceTabs();
  const ensureCustomerDetail = useEnsureCustomerDetail();
  const ensureEmployeeDetail = useEnsureEmployeeDetail();
  const ensurePickupRouteDetail = useEnsurePickupRouteDetail();
  const { markPendingAdd } = useApplyCreatedOnTabReturn((feature, id) => {
    if (feature === "containers") {
      updateField("containerId", id);
      return;
    }
    if (feature === "employees") {
      ensureEmployeeDetail(id)
        .then(applyCreatedEmployee)
        .catch(() => setFormError(t("invoices.form.validation.createdEmployeeLoadFailed")));
      return;
    }
    if (feature === PICKUP_ROUTE_FORM_FEATURE) {
      ensurePickupRouteDetail(id)
        .then(selectCreatedRoute)
        .catch(() => setFormError(t("invoices.form.validation.createdRouteLoadFailed")));
    }
  });

  const { data: itemsData } = useItemPicker();
  const containers = containersData?.items ?? [];
  const defaultOrders = ordersQuery.data?.items ?? [];
  const catalogItems = itemsData?.items ?? [];

  const [values, setValues] = useState<InvoiceFormValues>(
    () => {
      const initial = initialValues ?? createEmptyInvoiceForm();
      return !isEditing && !canUseManualNumber ? { ...initial, autoGenerateNumber: true } : initial;
    },
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [entityDialog, setEntityDialog] = useState<"container" | "employee" | "route" | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [pickupQuery, setPickupQuery] = useState("");
  const [pickupEmployeeQuery, setPickupEmployeeQuery] = useState("");
  const [pickupAssignmentOpenKey, setPickupAssignmentOpenKey] = useState(0);
  const navigateOnEnter = useFormEnterNavigation({
    advanceTextareas: Boolean(onContinue),
    submitOnLast: !onContinue,
    onComplete: onContinue,
  });
  const handleEnterNavigation = navigateOnEnter;
  const createContainerMutation = useCreateContainer();
  const createEmployeeMutation = useCreateEmployee();

  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200);
  const pickupRoutes = useMemo(
    () => (pickupRoutesQuery.data?.items ?? []).filter(
      (route) => !isDeliveryBranchCode(route.branch?.code),
    ),
    [pickupRoutesQuery.data?.items],
  );
  const { data: branchesData, isLoading: branchesLoading } = useBranchPicker();
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
    () => buildActiveRouteAssignmentOptions(pickupRoutes, t, { order: "created" }),
    [pickupRoutes, t],
  );
  const pickupSourceEmployees = useMemo(() => {
    const source = debouncedPickupEmployeeQuery
      ? (pickupEmployeeSearch.data?.items ?? [])
      : (employeesQuery.data?.items ?? []);

    const filtered = source.filter((employee) =>
      employeeMatchesPickupSource(employee, values.pickupSource, branchesById),
    );

    return filtered.length > 0
      ? filtered
      : source.filter(
          (employee) => employee.active && !isDeliveryBranchCode(employee.branch.code),
        );
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
    if (values.pickupSource !== "route" || !values.routeId || values.routeCrewId) return;
    const route = pickupRoutes.find((entry) => entry.id === values.routeId);
    if (!route) return;
    const crewName =
      route.route.name.trim() ||
      route.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ");
    if (!route.route.id && !crewName) return;
    commitValues((current) => {
      if (
        current.pickupSource !== "route" ||
        current.routeId !== route.id ||
        current.routeCrewId
      ) {
        return current;
      }
      return {
        ...current,
        routeCrewId: route.route.id,
        routeCrewName: crewName,
      };
    });
  }, [commitValues, pickupRoutes, values.pickupSource, values.routeCrewId, values.routeId]);

  const { markPendingPartyEdit, markPendingPartyAdd } = useApplyCustomerOnTabReturn((side, customer, { mode }) => {
    if (side === "sender") {
      commitValues((current) => {
        const currentId = current.senderId?.trim() || current.sender?.id?.trim() || "";
        if (mode === "edit" && currentId && currentId !== customer.id) {
          return current;
        }
        return { ...current, senderId: customer.id, sender: customer };
      });
    } else {
      commitValues((current) => {
        const currentId = current.receiverId?.trim() || current.receiver?.id?.trim() || "";
        if (mode === "edit" && currentId && currentId !== customer.id) {
          return current;
        }
        return { ...current, receiverId: customer.id, receiver: customer };
      });
    }
    setFormError(null);
  });

  useEffect(() => {
    if (isWizard) return;

    const initial = initialValues ?? createEmptyInvoiceForm();
    setValues(!isEditing && !canUseManualNumber ? { ...initial, autoGenerateNumber: true } : initial);
    setFormError(null);
  }, [initialValues, isWizard, isEditing, canUseManualNumber]);

  // Containers come sorted newest-first (id:desc); apply once so a user-cleared field stays cleared.
  const latestContainerId = containers[0] ? String(containers[0].id) : "";
  const appliedLatestContainerRef = useRef(false);
  useEffect(() => {
    if (!defaultToLatestContainer || appliedLatestContainerRef.current || !latestContainerId) return;
    appliedLatestContainerRef.current = true;
    commitValues((current) =>
      current.containerId ? current : { ...current, containerId: latestContainerId },
    );
  }, [commitValues, defaultToLatestContainer, latestContainerId]);

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

  function findPickupOrder(pickupId: string): Order | undefined {
    if (!pickupId) return undefined;
    return (
      pickupSearchResults.find((order) => String(order.id) === pickupId) ??
      defaultOrders.find((order) => String(order.id) === pickupId) ??
      (selectedPickupQuery.data && String(selectedPickupQuery.data.id) === pickupId
        ? selectedPickupQuery.data
        : undefined)
    );
  }

  const pickupReceivers = getPickupReceivers(findPickupOrder(values.pickupId));
  const pickupReceiverOptions = pickupReceivers.map(receiverToPickupSelectOption);
  const pickupReceiverValue = pickupReceivers.some((receiver) => receiver.id === values.receiverId)
    ? values.receiverId
    : "";

  function updateField<K extends keyof InvoiceFormValues>(key: K, value: InvoiceFormValues[K]) {
    commitValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updatePickupSource(next: InvoicePickupSource) {
    if (next !== values.pickupSource) {
      commitValues((current) => ({
        ...current,
        pickupSource: next,
        routeId: next === "route" ? current.routeId : "",
        routeCrewId: next === "route" ? current.routeCrewId : "",
        routeCrewName: next === "route" ? current.routeCrewName : "",
        officeBranchId: "",
        officeBranchName: "",
        pickupEmployeeId: "",
        pickupEmployeeName: "",
      }));
      setPickupEmployeeQuery("");
    }
    setFormError(null);
    if (isWizard) {
      setPickupAssignmentOpenKey((key) => key + 1);
    }
  }

  function updatePickupRoute(routeId: string) {
    const route = pickupRoutes.find((entry) => entry.id === routeId);
    const crewName =
      route?.route.name.trim() ||
      route?.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") ||
      "";
    commitValues((current) => ({
      ...current,
      routeId,
      routeCrewId: route?.route.id ?? "",
      routeCrewName: crewName,
    }));
    setFormError(null);
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

  function openAddContainer() {
    if (isDesktopTabs) {
      markPendingAdd("containers");
      openFormTab({
        feature: "containers",
        baseHref: "/containers",
        mode: "add",
        label: t("containers.actions.add"),
        closeOnSave: true,
      });
      return;
    }
    setEntityError(null);
    setEntityDialog("container");
  }

  function openAddEmployee() {
    if (isDesktopTabs) {
      markPendingAdd("employees");
      openFormTab({
        feature: "employees",
        baseHref: "/employees",
        mode: "add",
        label: t("employees.actions.add"),
        closeOnSave: true,
      });
      return;
    }
    setEntityError(null);
    setEntityDialog("employee");
  }

  function applyCreatedEmployee(employee: Employee) {
    commitValues((current) => ({
      ...current,
      pickupSource: current.pickupSource === "route" ? "office" : current.pickupSource,
      pickupEmployeeId: String(employee.id),
      pickupEmployeeName: employee.name,
      officeBranchId: String(employee.branch.id),
      officeBranchName: `${employee.branch.code} — ${employee.branch.name}`.trim(),
      routeId: "",
      routeCrewId: "",
      routeCrewName: "",
    }));
    setFormError(null);
  }

  function openAddRoute() {
    if (isDesktopTabs) {
      markPendingAdd(PICKUP_ROUTE_FORM_FEATURE);
      openFormTab({
        feature: PICKUP_ROUTE_FORM_FEATURE,
        baseHref: PICKUP_ROUTES_DIRECTORY_VARIANT.baseHref,
        mode: "add",
        label: t("routes.pickupRoutes.addTabLabel"),
        closeOnSave: true,
      });
      return;
    }
    setEntityError(null);
    setEntityDialog("route");
  }

  async function saveContainer(formValues: ContainerFormValues) {
    try {
      setEntityError(null);
      const saved = await createContainerMutation.mutateAsync(formValues);
      updateField("containerId", String(saved.id));
      setEntityDialog(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  async function saveEmployee(formValues: EmployeeFormValues) {
    try {
      setEntityError(null);
      const saved = await createEmployeeMutation.mutateAsync(formValues);
      applyCreatedEmployee(saved);
      setEntityDialog(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  function selectCreatedRoute(route?: ActiveRoute) {
    if (!route) {
      setEntityDialog(null);
      return;
    }
    const crewName =
      route.route?.name.trim() ||
      route.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") ||
      "";
    commitValues((current) => ({
      ...current,
      pickupSource: "route",
      routeId: route.id,
      routeCrewId: route.route?.id ?? "",
      routeCrewName: crewName,
      pickupEmployeeId: "",
      pickupEmployeeName: "",
      officeBranchId: "",
      officeBranchName: "",
    }));
    setEntityDialog(null);
    setFormError(null);
  }

  async function loadLiveReceiver(pickupId: string, receiverId: string) {
    try {
      const liveReceiver = await ensureCustomerDetail(receiverId, { staleTime: 0 });
      commitValues((current) => {
        if (current.pickupId !== pickupId || current.receiverId !== receiverId) return current;
        return { ...current, receiverId: liveReceiver.id, receiver: liveReceiver };
      });
    } catch {
      // Keep the pickup snapshot if the live customer cannot be loaded.
    }
  }

  async function updatePickupReference(next: string) {
    const selectedOrder = findPickupOrder(next);
    const snapshotSender = selectedOrder?.sender ?? null;
    const senderId = snapshotSender?.id?.trim() ?? "";
    const receivers = getPickupReceivers(selectedOrder);
    const onlyReceiver = receivers.length === 1 ? receivers[0] : null;

    commitValues((current) => {
      const keepsReceiver = receivers.some((receiver) => receiver.id === current.receiverId);
      return {
        ...current,
        pickupId: next,
        ...(snapshotSender
          ? { senderId: snapshotSender.id, sender: snapshotSender }
          : {}),
        ...(onlyReceiver
          ? { receiverId: onlyReceiver.id, receiver: onlyReceiver }
          : receivers.length > 1 && !keepsReceiver
            ? { receiverId: "", receiver: null }
            : {}),
      };
    });
    setFormError(null);

    // Pickup auto-fills sender — skip sender and open the receiver choice next.
    window.setTimeout(() => {
      focusInvoiceWizardField(
        !senderId ? "senderId" : receivers.length > 1 ? "pickupReceiverId" : "receiverId",
      );
    }, 0);

    if (onlyReceiver) void loadLiveReceiver(next, onlyReceiver.id);

    if (!senderId) return;

    try {
      // Pickup parties are a create-time address snapshot and can omit a later
      // Google verification. Load GET /customers/{id} — same as sender search.
      const liveSender = await ensureCustomerDetail(senderId, { staleTime: 0 });
      commitValues((current) => {
        if (current.pickupId !== next) return current;
        return { ...current, senderId: liveSender.id, sender: liveSender };
      });
    } catch {
      // Keep the pickup snapshot if the live customer cannot be loaded.
    }
  }

  function updatePickupReceiver(receiverId: string) {
    const receiver = pickupReceivers.find((entry) => entry.id === receiverId);
    if (!receiver) return;
    commitValues((current) => ({ ...current, receiverId: receiver.id, receiver }));
    setFormError(null);
    void loadLiveReceiver(values.pickupId, receiver.id);
  }

  function updateSender(_senderId: string, sender: Customer) {
    commitValues((current) => ({ ...current, senderId: sender.id, sender }));
    setFormError(null);
  }

  function updateReceiver(_receiverId: string, receiver: Customer) {
    commitValues((current) => ({ ...current, receiverId: receiver.id, receiver }));
    setFormError(null);
  }

  function openAddCustomer(side: PartySide) {
    const customerType = side === "receiver" ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER;
    markPendingPartyAdd(side, customerType);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "add",
      customerType,
      label: t(side === "receiver" ? "invoices.form.partyActions.addReceiver" : "invoices.form.partyActions.addSender"),
    });
  }

  function openEditCustomer(side: PartySide, addressIndex?: number) {
    const current = side === "sender" ? values.sender : values.receiver;
    if (!current?.id) return;

    markPendingPartyEdit(side, current.id);
    openFormTab({
      feature: "customers",
      baseHref: "/customers",
      mode: "edit",
      entityId: current.id,
      customerType: side === "receiver" ? CUSTOMER_TYPE_RECEIVER : CUSTOMER_TYPE_SENDER,
      ...(addressIndex != null && addressIndex >= 0 ? { focusAddressIndex: addressIndex } : {}),
      label:
        side === "receiver"
          ? t("invoices.form.partyActions.editReceiver")
          : t("invoices.form.partyActions.editSender"),
    });
  }

  function primaryAddressContentIndex(customer: Customer): number {
    const content = customer.addresses.filter(coreAddressHasContent);
    const primaryIndex = content.findIndex((address) => address.isPrimary);
    return primaryIndex >= 0 ? primaryIndex : 0;
  }

  function openAddAddress(side: PartySide, customer: Customer) {
    if (!customer.id) return;
    markPendingPartyEdit(side, customer.id);
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

  const subtotal = useMemo(
    () => values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0),
    [values.lineItems],
  );
  const discount = Number(values.discount) || 0;
  const amountPaid = Number(values.amountPaid) || 0;
  const balance = computeInvoiceBalance(subtotal, discount, amountPaid);

  const unverifiedPartyMessage = t("invoices.wizard.validation.unverifiedSenderAddress");
  // Only senders use Google verification; receivers use a predetermined city list.
  const warnForUnverifiedParty =
    googleMapsConfigured &&
    Boolean(values.sender && customerHasUnverifiedPrimaryAddress(values.sender));

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (onContinue) {
      onContinue();
      return;
    }

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
      setValues(resetInvoiceFormForNextEntry(values));
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
  const wizardFieldCol = isPhoneWizard ? undefined : isWizard ? "@2xl:col-span-1" : undefined;
  const openPickupAssignment = isWizard && pickupAssignmentOpenKey > 0;

  function renderField(
    label: string,
    htmlFor: string,
    required: boolean | undefined,
    control: React.ReactNode,
    fieldClassName?: string,
    action?: React.ReactNode,
  ) {
    if (isWizard) {
      return (
        <WizardField
          label={label}
          htmlFor={htmlFor}
          required={required}
          className={fieldClassName}
          action={action}
        >
          {control}
        </WizardField>
      );
    }

    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={htmlFor}>
            {label}
            {required ? <span className="text-destructive"> *</span> : null}
          </Label>
          {action}
        </div>
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
      advanceFocusOnSelect={false}
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
    <div
      className={cn(
        "grid min-w-0",
        isPhoneWizard
          ? "grid-cols-1 gap-4"
          : "grid-cols-1 gap-4 @2xl:grid-cols-2",
      )}
    >
      {renderField(
        t("invoices.form.fields.date"),
        "date",
        true,
        <DateInput
          id="date"
          value={values.date}
          onChange={(event) => updateField("date", event.target.value)}
          {...(isWizard ? wizardInputFieldProps(values.date, "pl-9 md:pl-8") : {})}
          required
        />,
        wizardFieldCol,
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
              label: container.name,
            })),
          ]}
        />,
        wizardFieldCol,
        <FieldEntityActions onAdd={openAddContainer} addIcon={ContainerIcon} />,
      )}
      {renderField(
        t("invoices.form.fields.pickupSource"),
        "pickupSource",
        false,
        <SearchableSelect
          id="pickupSource"
          value={values.pickupSource}
          onValueChange={(next) => updatePickupSource(next as InvoicePickupSource)}
          placeholder={t("invoices.form.fields.pickupSource")}
          searchable={false}
          {...(isWizard ? wizardSelectFieldProps(values.pickupSource) : {})}
          options={INVOICE_PICKUP_SOURCES.map((option) => ({
            value: option.value,
            label: t(option.labelKey),
          }))}
        />,
        wizardFieldCol,
      )}
      {values.pickupSource === "route"
        ? renderField(
            t("invoices.form.fields.pickupRoute"),
            "routeId",
            true,
            <SearchableSelect
              key={isWizard ? `routeId-${pickupAssignmentOpenKey}` : "routeId"}
              id="routeId"
              value={values.routeId}
              onValueChange={updatePickupRoute}
              placeholder={t("invoices.form.placeholders.selectPickupRoute")}
              searchPlaceholder={t("invoices.form.placeholders.searchPickupRoutes")}
              loading={pickupRoutesQuery.isFetching}
              required
              autoFocus={openPickupAssignment}
              defaultOpen={openPickupAssignment}
              openOnNavigationFocus
              {...(isWizard ? wizardSelectFieldProps(values.routeId) : {})}
              options={[
                { value: "", label: t("invoices.form.placeholders.selectPickupRoute") },
                ...pickupRouteOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
            />,
            wizardFieldCol,
            <FieldEntityActions onAdd={openAddRoute} addIcon={Route} />,
          )
        : renderField(
            pickupEmployeeFieldLabel,
            "pickupEmployeeId",
            true,
            <SearchableSelect
              key={isWizard ? `pickupEmployeeId-${pickupAssignmentOpenKey}` : "pickupEmployeeId"}
              id="pickupEmployeeId"
              value={values.pickupEmployeeId}
              onValueChange={updatePickupEmployee}
              placeholder={pickupEmployeePlaceholder}
              searchPlaceholder={t("invoices.form.placeholders.searchEmployees")}
              manualFiltering
              loading={pickupEmployeeSearch.isFetching || employeesQuery.isFetching}
              onSearchChange={setPickupEmployeeQuery}
              required
              autoFocus={openPickupAssignment}
              defaultOpen={openPickupAssignment}
              {...(isWizard ? wizardSelectFieldProps(values.pickupEmployeeId) : {})}
              options={[
                ...(debouncedPickupEmployeeQuery
                  ? []
                  : [{ value: "", label: pickupEmployeePlaceholder }]),
                ...pickupEmployeeOptions,
              ]}
            />,
            wizardFieldCol,
            <FieldEntityActions onAdd={openAddEmployee} addIcon={UserPlus} />,
          )}
      {showPaymentLocation
        ? renderField(
            t("invoices.form.fields.paymentLocation"),
            "paymentLocation",
            true,
            <SearchableSelect
              id="paymentLocation"
              value={mapPaymentLocationToPaidRegion(values.paymentLocation)}
              onValueChange={(next) =>
                updateField("paymentLocation", next as InvoiceFormValues["paymentLocation"])
              }
              placeholder={t("invoices.form.fields.paymentLocation")}
              {...(isWizard ? wizardSelectFieldProps(values.paymentLocation) : {})}
              required
              loading={branchesLoading}
              options={branches.filter((branch) => branch.code.trim()).map((branch) => ({
                value: branch.code.trim().toUpperCase(),
                label: branch.code.trim().toUpperCase(),
              }))}
            />,
            wizardFieldCol,
          )
        : null}
      {isEditing ? (
        renderField(
          t("invoices.form.fields.invoiceNumber"),
          "invoiceNumber",
          true,
          <Input
            id="invoiceNumber"
            value={values.invoiceNumber}
            onChange={(event) => updateField("invoiceNumber", event.target.value)}
            disabled={!canUseManualNumber}
            placeholder={t("invoices.form.placeholders.invoiceNumber")}
            required
          />,
          wizardFieldCol,
        )
      ) : (
        <div className={cn(isPhoneWizard ? undefined : isWizard ? "@2xl:col-span-2" : "sm:col-span-2")}>
          <InvoiceNumberModeFields
            id="invoiceNumber"
            autoGenerate={Boolean(values.autoGenerateNumber)}
            invoiceNumber={values.invoiceNumber}
            generatedInvoiceNumber={values.generatedInvoiceNumber}
            canUseManualNumber={canUseManualNumber}
            onModeChange={(nextAutoGenerate) => {
              updateField("autoGenerateNumber", nextAutoGenerate);
              if (nextAutoGenerate) {
                updateField("invoiceNumber", "");
              }
            }}
            onInvoiceNumberChange={(next) => updateField("invoiceNumber", next)}
            inputProps={
              isWizard && !values.autoGenerateNumber
                ? wizardInputFieldProps(values.invoiceNumber)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );

  const dash = t("common.empty.dash");
  const assignedContainer = containers.find((container) => String(container.id) === values.containerId);
  const assignedRoute = pickupRoutes.find((route) => route.id === values.routeId);
  const assignedSourceOption = INVOICE_PICKUP_SOURCES.find((option) => option.value === values.pickupSource);
  const assignedPickupOrder = findPickupOrder(values.pickupId);

  const assignedDetailsFields = (
    <div className="min-w-0 space-y-3">
      <p className="text-sm text-muted-foreground">{t("invoices.assigned.detailsHint")}</p>
      <div className={cn("grid min-w-0 gap-3", !isPhoneWizard && "@2xl:grid-cols-2")}>
        <ReadOnlyField label={t("invoices.form.fields.date")}>
          {values.date ? formatInvoiceDate(values.date) : dash}
        </ReadOnlyField>
        <ReadOnlyField label={t("invoices.form.fields.container")}>
          {assignedContainer
            ? formatContainerLabel(assignedContainer)
            : values.containerId
              ? formatContainerIdLabel(values.containerId)
              : dash}
        </ReadOnlyField>
        <ReadOnlyField label={t("invoices.form.fields.pickupSource")}>
          {assignedSourceOption ? t(assignedSourceOption.labelKey) : dash}
        </ReadOnlyField>
        {values.pickupSource === "route" ? (
          <ReadOnlyField label={t("invoices.form.fields.pickupRoute")}>
            {assignedRoute
              ? formatActiveRouteAssignmentLabel(assignedRoute, t)
              : values.routeCrewName.trim() || dash}
          </ReadOnlyField>
        ) : (
          <ReadOnlyField label={pickupEmployeeFieldLabel}>
            {[values.pickupEmployeeName.trim(), values.officeBranchName.trim()].filter(Boolean).join(" · ") ||
              dash}
          </ReadOnlyField>
        )}
        <ReadOnlyField label={t("invoices.form.fields.invoiceNumber")}>
          {values.autoGenerateNumber
            ? t("invoices.form.autoNumber.assignedOnSave")
            : values.invoiceNumber.trim() || dash}
        </ReadOnlyField>
      </div>
    </div>
  );

  const partyBoxClassName = cn(
    "space-y-2",
    isPhoneWizard ? "border-b border-border/70 px-1 pb-4" : "min-w-0 rounded-lg border border-border bg-muted/20 p-4",
  );

  const assignedPartiesFields = (
    <div className={cn("grid min-w-0", isPhoneWizard ? "gap-4" : "gap-4 @2xl:grid-cols-2")}>
      <div className={isPhoneWizard ? undefined : "@2xl:col-span-2"}>
        <ReadOnlyField label={t("invoices.form.fields.pickupReference")}>
          {assignedPickupOrder
            ? orderToPickupSelectOption(assignedPickupOrder).label
            : values.pickupId
              ? `#${values.pickupId}`
              : dash}
        </ReadOnlyField>
      </div>
      <div className={partyBoxClassName}>
        <p className="text-sm font-medium">{t("invoices.form.fields.sender")}</p>
        {values.sender ? <CustomerContactSummary customer={values.sender} /> : <p className="text-sm text-muted-foreground">{dash}</p>}
      </div>
      <div className={partyBoxClassName}>
        <p className="text-sm font-medium">{t("invoices.form.fields.receiver")}</p>
        {pickupReceivers.length > 1 ? (
          <div className="space-y-1">
            <Label htmlFor="pickupReceiverId" className="text-xs font-medium text-muted-foreground">
              {t("invoices.form.fields.pickupReceiver")}
            </Label>
            <SearchableSelect
              id="pickupReceiverId"
              value={pickupReceiverValue}
              onValueChange={updatePickupReceiver}
              placeholder={t("invoices.form.placeholders.selectPickupReceiver")}
              searchPlaceholder={t("invoices.form.placeholders.searchPickupReceivers")}
              {...(isWizard ? wizardSelectFieldProps(pickupReceiverValue) : {})}
              options={pickupReceiverOptions}
            />
          </div>
        ) : null}
        {values.receiver ? (
          <CustomerContactSummary customer={values.receiver} />
        ) : pickupReceivers.length <= 1 ? (
          <p className="text-sm text-muted-foreground">{t("invoices.form.placeholders.noReceiver")}</p>
        ) : null}
      </div>
    </div>
  );

  const partiesFields = assignedMode ? assignedPartiesFields : (
    <div
      className={cn(
        "grid min-w-0",
        isPhoneWizard ? "gap-4" : "gap-4 @2xl:grid-cols-2",
      )}
    >
      <div className={isPhoneWizard ? undefined : "@2xl:col-span-2"}>{pickupReferenceField}</div>
      <div
        className={cn(
          "space-y-2",
          isPhoneWizard ? "border-b border-border/70 px-1 pb-4" : "min-w-0 rounded-lg border border-border bg-muted/20 p-4",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {isWizard ? (
            <Label htmlFor="senderId" className="text-sm font-medium">
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
          onAddAddress={(customer) => void openAddAddress("sender", customer)}
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
              onUpdateAddress={() =>
                values.sender ? openEditCustomer("sender", primaryAddressContentIndex(values.sender)) : undefined
              }
            />
          </>
        ) : null}
      </div>

      <div
        className={cn(
          "space-y-2",
          isPhoneWizard ? "border-b border-border/70 px-1 pb-4" : "min-w-0 rounded-lg border border-border bg-muted/20 p-4",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          {isWizard ? (
            <Label htmlFor="receiverId" className="text-sm font-medium">
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
        {pickupReceivers.length > 1 ? (
          <div className="space-y-1">
            <Label htmlFor="pickupReceiverId" className="text-xs font-medium text-muted-foreground">
              {t("invoices.form.fields.pickupReceiver")}
            </Label>
            <SearchableSelect
              id="pickupReceiverId"
              value={pickupReceiverValue}
              onValueChange={updatePickupReceiver}
              placeholder={t("invoices.form.placeholders.selectPickupReceiver")}
              searchPlaceholder={t("invoices.form.placeholders.searchPickupReceivers")}
              {...(isWizard ? wizardSelectFieldProps(pickupReceiverValue) : {})}
              options={pickupReceiverOptions}
            />
          </div>
        ) : null}
        <CustomerPartySelect
          id="receiverId"
          partyType="receiver"
          value={values.receiverId}
          selectedCustomer={values.receiver}
          onValueChange={updateReceiver}
          onAddAddress={(customer) => void openAddAddress("receiver", customer)}
          placeholder={t("invoices.form.placeholders.noReceiver")}
          pickerTitle={t("invoices.form.placeholders.selectReceiver")}
          searchPlaceholder={t("invoices.form.placeholders.selectReceiver")}
          showAddressLabels={false}
          triggerClassName={isWizard ? wizardSelectClassNameFor(values.receiverId) : undefined}
        />
        {values.receiver ? (
          <>
            <CustomerContactSummary customer={values.receiver} />
            <UnverifiedAddressNotice
              customer={values.receiver}
              onUpdateAddress={() =>
                values.receiver
                  ? openEditCustomer("receiver", primaryAddressContentIndex(values.receiver))
                  : undefined
              }
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
          workflow={!isPhoneWizard}
          className={
            isPhoneWizard
              ? "min-w-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto bg-background px-4 py-5 pb-[calc(5rem+env(safe-area-inset-bottom))]"
              : isWizard
              ? "min-w-0 flex-1 space-y-5 overflow-y-auto bg-muted/35 p-4 sm:p-6"
              : undefined
          }
        >
          {showDetailsSection ? (
            isPhoneWizard ? (
              <section className="min-w-0 space-y-5">
                {assignedMode ? assignedDetailsFields : detailsFields}
              </section>
            ) : (
              <FormSection variant="card" icon={Receipt} title={`01 · ${t("invoices.form.sections.invoiceDetails")}`}>
                {assignedMode ? assignedDetailsFields : detailsFields}
              </FormSection>
            )
          ) : null}

          {showPartiesSection ? (
            isPhoneWizard ? (
              <section className="min-w-0 space-y-4">
                {partiesFields}
              </section>
            ) : (
              <FormSection variant="card" icon={Users} title={`02 · ${t("invoices.form.sections.senderReceiver")}`} description={t("invoices.form.design.partiesHint")}>
                {partiesFields}
              </FormSection>
            )
          ) : null}

          {showLineItemsSection ? (
            isWizard ? (
              <div className={isPhoneWizard ? undefined : "min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"}>
                {!isPhoneWizard ? <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{t("invoices.form.design.itemsHint")}</p> : null}
                <InvoiceLineItemsEditor
                  lineItems={values.lineItems}
                  catalogItems={catalogItems}
                  appearance={isPhoneWizard ? "phoneWizard" : "wizard"}
                  onChange={(lineItems) => updateField("lineItems", lineItems)}
                  requestFocusKey={
                    focusFieldId === INVOICE_WIZARD_FIELDS.lineItems ? focusFieldKey : 0
                  }
                  requestEditLineItemId={requestEditLineItemId}
                />
              </div>
            ) : (
              <FormSection variant="card" description={t("invoices.form.design.itemsHint")} icon={ClipboardList} title={t("invoices.form.sections.description")}>
                <InvoiceLineItemsEditor
                  lineItems={values.lineItems}
                  catalogItems={catalogItems}
                  onChange={(lineItems) => updateField("lineItems", lineItems)}
                />
              </FormSection>
            )
          ) : null}

          {showTotalsSection ? (
          <FormSection variant="card" icon={Wallet} title={t("invoices.form.design.totals")}>
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
                  onFocus={selectFormFieldTextOnFocus}
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
          warning={warnForUnverifiedParty ? unverifiedPartyMessage : null}
          submitLabel={submitLabel}
          onCancel={onCancel}
        />
        ) : null}
      </form>

      <Dialog open={entityDialog === "container"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("containers.form.addTitle")}</DialogTitle>
          </DialogHeader>
          <ContainerForm
            key="new-container"
            initialValues={createEmptyContainerForm()}
            submitLabel={t("containers.actions.add")}
            isSubmitting={createContainerMutation.isPending}
            externalError={entityError}
            onSubmit={saveContainer}
            onCancel={() => setEntityDialog(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={entityDialog === "employee"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("employees.form.addTitle")}</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            key="new-employee"
            initialValues={createEmptyEmployeeForm()}
            submitLabel={t("employees.actions.add")}
            isSubmitting={createEmployeeMutation.isPending}
            externalError={entityError}
            onSubmit={saveEmployee}
            onCancel={() => setEntityDialog(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={entityDialog === "route"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("routes.pickupRoutes.addTabLabel")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActiveRouteSection
              key="new-pickup-route"
              variant={PICKUP_ROUTES_DIRECTORY_VARIANT}
              defaultDate={values.date.slice(0, 10) || undefined}
              onSaved={selectCreatedRoute}
              onCancel={() => setEntityDialog(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
