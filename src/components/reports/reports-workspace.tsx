"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Banknote,
  Barcode,
  BookOpenText,
  CalendarClock,
  Download,
  FileDown,
  HandCoins,
  MapPinned,
  PackageOpen,
  type LucideIcon,
} from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { buildIncomeReportRequest } from "@/lib/accounting/daily-income/print-income-report";
import { fetchIncomeStatement } from "@/lib/accounting/daily-income/api";
import { transactionTypeLabel, withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { useDailyIncomeJournals, useIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import { buildLoanReportFilters } from "@/lib/accounting/loans/api";
import { normalizeApiError } from "@/lib/api/axios";
import { createBarcodeSearchFilter } from "@/lib/barcodes/types";
import { useBarcodeSearch } from "@/lib/barcodes/hooks/use-barcodes";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { submitFormOnEnterKeyDown } from "@/hooks/use-form-enter-navigation";
import { useTranslation } from "@/lib/i18n";
import { createInvoiceSearchFilter } from "@/lib/invoices/types";
import { useInvoiceSearch } from "@/lib/invoices/hooks/use-invoices";
import { fetchAllPickupsByRoutes } from "@/lib/orders/api/orders-api";
import { formatOrderDate, getOrderFeedbackName } from "@/lib/orders/display";
import { createOrderSearchFilter, getOrderRecordId } from "@/lib/orders/types";
import { useOrderSearch } from "@/lib/orders/hooks/use-orders";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { REPORT_TYPE_ORDER } from "@/lib/reports/catalog";
import { useGenerateReport } from "@/lib/reports/hooks/use-reports";
import { buildLoanReportListParams } from "@/lib/reports/loan-report-params";
import { downloadReportFile, openReportUrl } from "@/lib/reports/open-report";
import type { ReportRequest, ReportResult, ReportType } from "@/lib/reports/types";
import { todayDateInputValue } from "@/lib/route-manager/types";
import { cn } from "@/lib/utils";

const ALL_VALUE = "all";

const REPORT_TYPE_ICONS: Record<ReportType, LucideIcon> = {
  pickup: CalendarClock,
  delivery: MapPinned,
  invoice: PackageOpen,
  label: Barcode,
  income: HandCoins,
  journal: BookOpenText,
  loan: Banknote,
};

type PickupSource = "appointment" | "route";
type LabelSource = "invoice" | "barcode";
type GenerateMode = "open" | "download";

function Field({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function formatExpiresAt(value: string, locale: string) {
  if (!value.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function ReportsWorkspace() {
  const { t, locale } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const generateReportMutation = useGenerateReport();

  const [type, setType] = useState<ReportType>("pickup");
  const [pickupSource, setPickupSource] = useState<PickupSource>("appointment");
  const [labelSource, setLabelSource] = useState<LabelSource>("invoice");
  const [appointmentId, setAppointmentId] = useState("");
  const [appointmentLabel, setAppointmentLabel] = useState("");
  const [appointmentQuery, setAppointmentQuery] = useState("");
  const [pickupRouteId, setPickupRouteId] = useState("");
  const [deliveryRouteId, setDeliveryRouteId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [invoiceLabel, setInvoiceLabel] = useState("");
  const [invoiceQuery, setInvoiceQuery] = useState("");
  const [barcodeNumber, setBarcodeNumber] = useState("");
  const [barcodeLabel, setBarcodeLabel] = useState("");
  const [barcodeQuery, setBarcodeQuery] = useState("");
  const [branchId, setBranchId] = useState("");
  const [date, setDate] = useState(todayDateInputValue());
  const [employeeId, setEmployeeId] = useState(ALL_VALUE);
  const [journalId, setJournalId] = useState("");
  const [loanEmployeeId, setLoanEmployeeId] = useState(ALL_VALUE);
  const [loanDateFrom, setLoanDateFrom] = useState("");
  const [loanDateTo, setLoanDateTo] = useState("");
  const [loanStatus, setLoanStatus] = useState(ALL_VALUE);
  const [lastResult, setLastResult] = useState<ReportResult | null>(null);
  const [downloading, setDownloading] = useState(false);

  const debouncedAppointmentQuery = useDebouncedValue(appointmentQuery.trim(), 300);
  const debouncedInvoiceQuery = useDebouncedValue(invoiceQuery.trim(), 300);
  const debouncedBarcodeQuery = useDebouncedValue(barcodeQuery.trim(), 300);

  const appointmentSearch = useOrderSearch(createOrderSearchFilter(debouncedAppointmentQuery), {
    enabled: type === "pickup" && pickupSource === "appointment" && Boolean(debouncedAppointmentQuery),
  });
  const invoiceSearch = useInvoiceSearch(createInvoiceSearchFilter(debouncedInvoiceQuery), {
    enabled: (type === "invoice" || (type === "label" && labelSource === "invoice")) && Boolean(debouncedInvoiceQuery),
  });
  const barcodeSearch = useBarcodeSearch(createBarcodeSearchFilter(debouncedBarcodeQuery), {
    enabled: type === "label" && labelSource === "barcode" && Boolean(debouncedBarcodeQuery),
  });
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, {
    enabled: type === "pickup" && pickupSource === "route",
  });
  const deliveryRoutesQuery = useActiveRoutePicker("delivery", 200, {
    enabled: type === "delivery",
  });
  const branchesQuery = useBranchPicker(200, { enabled: type === "income" || type === "journal" });
  const employeesQuery = useEmployees({
    ...DEFAULT_EMPLOYEE_LIST_PARAMS,
    page: 1,
    limit: 200,
  });
  const selectedBranchId = Number(branchId);
  const statementQuery = useIncomeStatement(
    type === "income" || type === "journal" ? selectedBranchId : 0,
    type === "income" || type === "journal" ? date : "",
  );
  const journalsQuery = useDailyIncomeJournals({
    incomeStatementId: type === "journal" ? (statementQuery.data?.id ?? 0) : 0,
    page: 1,
    limit: 200,
  });

  const branches = branchesQuery.data?.items ?? [];
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );

  useEffect(() => {
    if (branchId || branches.length === 0) return;
    setBranchId(String(branches[0].id));
  }, [branchId, branches]);

  useEffect(() => {
    setLastResult(null);
    setJournalId("");
  }, [type]);

  const appointmentOptions = useMemo(() => {
    const options = (appointmentSearch.data?.items ?? []).map((order) => ({
      value: getOrderRecordId(order),
      label: getOrderFeedbackName(order),
      description: formatOrderDate(order.date),
      keywords: [getOrderFeedbackName(order), getOrderRecordId(order), order.date],
    }));
    return withPinnedSelectOption(options, appointmentId, appointmentLabel);
  }, [appointmentId, appointmentLabel, appointmentSearch.data?.items]);

  const invoiceOptions = useMemo(() => {
    const options = (invoiceSearch.data?.items ?? []).map((invoice) => ({
      value: invoice.invoiceId,
      label: invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : invoice.invoiceId,
      description: [invoice.sender?.name, invoice.date].filter(Boolean).join(" · "),
      keywords: [invoice.invoiceNumber, invoice.invoiceId, invoice.sender?.name ?? ""],
    }));
    return withPinnedSelectOption(options, invoiceId, invoiceLabel);
  }, [invoiceId, invoiceLabel, invoiceSearch.data?.items]);

  const barcodeOptions = useMemo(() => {
    const options = (barcodeSearch.data?.items ?? []).map((barcode) => ({
      value: barcode.number,
      label: barcode.number,
      description: barcode.status?.name,
      keywords: [barcode.number, String(barcode.id)],
    }));
    return withPinnedSelectOption(options, barcodeNumber, barcodeLabel);
  }, [barcodeLabel, barcodeNumber, barcodeSearch.data?.items]);

  const pickupRouteOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(pickupRoutesQuery.data?.items ?? [], t),
    [pickupRoutesQuery.data?.items, t],
  );
  const deliveryRouteOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(deliveryRoutesQuery.data?.items ?? [], t),
    [deliveryRoutesQuery.data?.items, t],
  );

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: String(branch.id),
        label: [branch.code, branch.name].filter(Boolean).join(" · "),
        keywords: [branch.code, branch.name, String(branch.id)],
      })),
    [branches],
  );

  const employeeOptions = useMemo(
    () => [
      { value: ALL_VALUE, label: t("reports.fields.allEmployees"), keywords: ["all", "todos"] },
      ...employees.map((employee) => ({
        value: String(employee.id),
        label: employee.name,
        keywords: [employee.name, String(employee.id)],
      })),
    ],
    [employees, t],
  );

  const journalOptions = useMemo(
    () =>
      (journalsQuery.data?.items ?? []).map((journal) => {
        const ref = journal.refNumber.trim() || journal.id;
        return {
          value: journal.id,
          label: ref,
          description: [transactionTypeLabel(journal.transactionType, t), journal.description]
            .filter(Boolean)
            .join(" · "),
          keywords: [ref, journal.description, journal.transactionType],
        };
      }),
    [journalsQuery.data?.items, t],
  );

  const loanStatusOptions = [
    { value: ALL_VALUE, label: t("reports.fields.allStatuses") },
    { value: "ACTIVE", label: t("reports.loanStatuses.ACTIVE") },
    { value: "PAID", label: t("reports.loanStatuses.PAID") },
    { value: "VOID", label: t("reports.loanStatuses.VOID") },
  ];

  const isPending = generateReportMutation.isPending || downloading;

  async function buildRequest(): Promise<ReportRequest | string> {
    switch (type) {
      case "pickup": {
        if (pickupSource === "route") {
          if (!pickupRouteId) return t("reports.errors.selectRoute");
          const pickups = await fetchAllPickupsByRoutes([pickupRouteId]);
          const pickupIds = pickups.map((order) => getOrderRecordId(order)).filter(Boolean);
          if (pickupIds.length === 0) return t("reports.errors.noPickupsOnRoute");
          return {
            type: "pickup",
            collection: "pickups",
            values: pickupIds,
            lookupField: "id",
          };
        }
        if (!appointmentId) return t("reports.errors.selectAppointment");
        return {
          type: "pickup",
          collection: "pickups",
          values: [appointmentId],
          lookupField: "id",
        };
      }
      case "delivery": {
        if (!deliveryRouteId) return t("reports.errors.selectRoute");
        return {
          type: "delivery",
          collection: "deliveries",
          values: [deliveryRouteId],
          lookupField: "id",
        };
      }
      case "invoice": {
        if (!invoiceId) return t("reports.errors.selectInvoice");
        return {
          type: "invoice",
          collection: "invoices",
          values: [invoiceId],
          lookupField: "id",
        };
      }
      case "label": {
        if (labelSource === "barcode") {
          if (!barcodeNumber.trim()) return t("reports.errors.selectBarcode");
          return {
            type: "label",
            collection: "barcodes",
            values: [barcodeNumber.trim()],
            lookupField: "number",
          };
        }
        if (!invoiceId) return t("reports.errors.selectInvoice");
        return {
          type: "label",
          collection: "invoices",
          values: [invoiceId],
          lookupField: "id",
        };
      }
      case "income": {
        if (!branchId) return t("reports.errors.selectBranch");
        if (!date) return t("reports.errors.selectDate");
        const statement =
          statementQuery.data && statementQuery.data.date.slice(0, 10) === date.slice(0, 10)
            ? statementQuery.data
            : await fetchIncomeStatement(Number(branchId), date);
        if (!statement) return t("reports.errors.closeoutNotFound");
        const parsedEmployee = Number(employeeId);
        return buildIncomeReportRequest(statement.id, {
          employeeId:
            employeeId === ALL_VALUE || !Number.isInteger(parsedEmployee) || parsedEmployee <= 0
              ? null
              : parsedEmployee,
        });
      }
      case "journal": {
        if (!journalId) return t("reports.errors.selectJournal");
        const journal = (journalsQuery.data?.items ?? []).find((item) => item.id === journalId);
        const ref = journal?.refNumber.trim();
        if (ref) {
          return {
            type: "journal",
            collection: "journals",
            values: [ref],
            lookupField: "refNumber",
          };
        }
        return {
          type: "journal",
          collection: "journals",
          values: [journalId],
          lookupField: "id",
        };
      }
      case "loan":
        return {
          type: "loan",
          collection: "loans",
          filters: buildLoanReportFilters(
            buildLoanReportListParams({
              employeeId: loanEmployeeId === ALL_VALUE ? "" : loanEmployeeId,
              dateFrom: loanDateFrom,
              dateTo: loanDateTo,
              status: loanStatus,
            }),
          ),
          operator: "and",
        };
    }
  }

  async function handleGenerate(mode: GenerateMode) {
    try {
      const request = await buildRequest();
      if (typeof request === "string") {
        notifyError(request);
        return;
      }

      const result = await generateReportMutation.mutateAsync(request);
      setLastResult(result);

      if (mode === "download") {
        setDownloading(true);
        await downloadReportFile(result.url, result.fileName);
        notifySuccess(t("reports.toasts.downloaded"));
        return;
      }

      openReportUrl(result.url);
      notifySuccess(t("reports.toasts.ready"));
    } catch (error) {
      notifyError(normalizeApiError(error).message || t("reports.errors.generateFailed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader title={t("reports.page.title")} description={t("reports.page.description")} />
      </div>

      <section className="mb-5 md:hidden">
        <h1 className="text-4xl font-bold tracking-normal text-foreground">{t("reports.page.title")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("reports.page.description")}</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {REPORT_TYPE_ORDER.map((reportType) => {
          const Icon = REPORT_TYPE_ICONS[reportType];
          const selected = type === reportType;
          return (
            <button
              key={reportType}
              type="button"
              onClick={() => setType(reportType)}
              className={cn(
                "rounded-xl border px-4 py-3 text-left transition",
                selected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="mb-2 h-4 w-4" />
              <div className="text-sm font-medium text-foreground">{t(`reports.types.${reportType}.title`)}</div>
              <p className="mt-1 text-xs text-muted-foreground">{t(`reports.types.${reportType}.description`)}</p>
            </button>
          );
        })}
      </div>

      <Card className="mt-6 gap-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">{t(`reports.types.${type}.title`)}</CardTitle>
          <CardDescription>{t(`reports.types.${type}.description`)}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-5">
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleGenerate("open");
            }}
          >
            {type === "pickup" ? (
              <>
                <Field htmlFor="report-pickup-source" label={t("reports.fields.source")}>
                  <SearchableSelect
                    id="report-pickup-source"
                    value={pickupSource}
                    onValueChange={(value) => setPickupSource(value as PickupSource)}
                    options={[
                      { value: "appointment", label: t("reports.fields.appointment") },
                      { value: "route", label: t("reports.fields.dailyRoute") },
                    ]}
                    searchable={false}
                    mobileSheet
                  />
                </Field>
                {pickupSource === "appointment" ? (
                  <Field htmlFor="report-appointment" label={t("reports.fields.appointment")}>
                    <SearchableSelect
                      id="report-appointment"
                      value={appointmentId}
                      onValueChange={(value) => {
                        setAppointmentId(value);
                        const option = appointmentOptions.find((item) => item.value === value);
                        setAppointmentLabel(option?.label ?? value);
                      }}
                      options={appointmentOptions}
                      placeholder={t("reports.placeholders.selectAppointment")}
                      searchPlaceholder={t("reports.placeholders.searchAppointments")}
                      emptyMessage={t("reports.placeholders.emptyAppointments")}
                      onSearchChange={setAppointmentQuery}
                      manualFiltering
                      loading={appointmentSearch.isFetching}
                      mobileSheet
                    />
                  </Field>
                ) : (
                  <Field htmlFor="report-pickup-route" label={t("reports.fields.dailyRoute")}>
                    <SearchableSelect
                      id="report-pickup-route"
                      value={pickupRouteId}
                      onValueChange={setPickupRouteId}
                      options={pickupRouteOptions}
                      placeholder={t("reports.placeholders.selectRoute")}
                      searchPlaceholder={t("reports.placeholders.searchRoutes")}
                      emptyMessage={t("reports.placeholders.emptyRoutes")}
                      loading={pickupRoutesQuery.isFetching}
                      mobileSheet
                    />
                  </Field>
                )}
              </>
            ) : null}

            {type === "delivery" ? (
              <Field htmlFor="report-delivery-route" label={t("reports.fields.dailyRoute")}>
                <SearchableSelect
                  id="report-delivery-route"
                  value={deliveryRouteId}
                  onValueChange={setDeliveryRouteId}
                  options={deliveryRouteOptions}
                  placeholder={t("reports.placeholders.selectRoute")}
                  searchPlaceholder={t("reports.placeholders.searchRoutes")}
                  emptyMessage={t("reports.placeholders.emptyRoutes")}
                  loading={deliveryRoutesQuery.isFetching}
                  mobileSheet
                />
              </Field>
            ) : null}

            {type === "invoice" || (type === "label" && labelSource === "invoice") ? (
              <>
                {type === "label" ? (
                  <Field htmlFor="report-label-source" label={t("reports.fields.source")}>
                    <SearchableSelect
                      id="report-label-source"
                      value={labelSource}
                      onValueChange={(value) => setLabelSource(value as LabelSource)}
                      options={[
                        { value: "invoice", label: t("reports.fields.invoice") },
                        { value: "barcode", label: t("reports.fields.barcode") },
                      ]}
                      searchable={false}
                      mobileSheet
                    />
                  </Field>
                ) : null}
                <Field htmlFor="report-invoice" label={t("reports.fields.invoice")}>
                  <SearchableSelect
                    id="report-invoice"
                    value={invoiceId}
                    onValueChange={(value) => {
                      setInvoiceId(value);
                      const option = invoiceOptions.find((item) => item.value === value);
                      setInvoiceLabel(option?.label ?? value);
                    }}
                    options={invoiceOptions}
                    placeholder={t("reports.placeholders.selectInvoice")}
                    searchPlaceholder={t("reports.placeholders.searchInvoices")}
                    emptyMessage={t("reports.placeholders.emptyInvoices")}
                    onSearchChange={setInvoiceQuery}
                    manualFiltering
                    loading={invoiceSearch.isFetching}
                    mobileSheet
                  />
                </Field>
              </>
            ) : null}

            {type === "label" && labelSource === "barcode" ? (
              <>
                <Field htmlFor="report-label-source-barcode" label={t("reports.fields.source")}>
                  <SearchableSelect
                    id="report-label-source-barcode"
                    value={labelSource}
                    onValueChange={(value) => setLabelSource(value as LabelSource)}
                    options={[
                      { value: "invoice", label: t("reports.fields.invoice") },
                      { value: "barcode", label: t("reports.fields.barcode") },
                    ]}
                    searchable={false}
                    mobileSheet
                  />
                </Field>
                <Field htmlFor="report-barcode" label={t("reports.fields.barcode")}>
                  <SearchableSelect
                    id="report-barcode"
                    value={barcodeNumber}
                    onValueChange={(value) => {
                      setBarcodeNumber(value);
                      const option = barcodeOptions.find((item) => item.value === value);
                      setBarcodeLabel(option?.label ?? value);
                    }}
                    options={barcodeOptions}
                    placeholder={t("reports.placeholders.selectBarcode")}
                    searchPlaceholder={t("reports.placeholders.searchBarcodes")}
                    emptyMessage={t("reports.placeholders.emptyBarcodes")}
                    onSearchChange={setBarcodeQuery}
                    manualFiltering
                    loading={barcodeSearch.isFetching}
                    mobileSheet
                  />
                </Field>
              </>
            ) : null}

            {type === "income" || type === "journal" ? (
              <>
                <Field htmlFor="report-branch" label={t("reports.fields.branch")}>
                  <SearchableSelect
                    id="report-branch"
                    value={branchId}
                    onValueChange={setBranchId}
                    options={branchOptions}
                    placeholder={t("reports.placeholders.selectBranch")}
                    searchPlaceholder={t("reports.placeholders.searchBranches")}
                    loading={branchesQuery.isFetching}
                    mobileSheet
                  />
                </Field>
                <Field htmlFor="report-date" label={t("reports.fields.date")}>
                  <DateInput
                    id="report-date"
                    value={date}
                    onChange={(event) => setDate(event.target.value.slice(0, 10))}
                    onKeyDown={submitFormOnEnterKeyDown}
                  />
                </Field>
              </>
            ) : null}

            {type === "income" ? (
              <Field htmlFor="report-employee" label={t("reports.fields.employee")}>
                <SearchableSelect
                  id="report-employee"
                  value={employeeId}
                  onValueChange={setEmployeeId}
                  options={employeeOptions}
                  placeholder={t("reports.placeholders.selectEmployee")}
                  searchPlaceholder={t("reports.placeholders.searchEmployees")}
                  mobileSheet
                />
              </Field>
            ) : null}

            {type === "journal" ? (
              <Field htmlFor="report-journal" label={t("reports.fields.journal")}>
                <SearchableSelect
                  id="report-journal"
                  value={journalId}
                  onValueChange={setJournalId}
                  options={journalOptions}
                  placeholder={t("reports.placeholders.selectJournal")}
                  searchPlaceholder={t("reports.placeholders.searchJournals")}
                  emptyMessage={t("reports.placeholders.emptyJournals")}
                  loading={statementQuery.isFetching || journalsQuery.isFetching}
                  mobileSheet
                />
              </Field>
            ) : null}

            {type === "loan" ? (
              <>
                <Field htmlFor="report-loan-employee" label={t("reports.fields.employee")}>
                  <SearchableSelect
                    id="report-loan-employee"
                    value={loanEmployeeId}
                    onValueChange={setLoanEmployeeId}
                    options={employeeOptions}
                    placeholder={t("reports.placeholders.selectEmployee")}
                    searchPlaceholder={t("reports.placeholders.searchEmployees")}
                    mobileSheet
                  />
                </Field>
                <Field htmlFor="report-loan-status" label={t("reports.fields.status")}>
                  <SearchableSelect
                    id="report-loan-status"
                    value={loanStatus}
                    onValueChange={setLoanStatus}
                    options={loanStatusOptions}
                    searchable={false}
                    mobileSheet
                  />
                </Field>
                <Field htmlFor="report-loan-from" label={t("reports.fields.dateFrom")}>
                  <DateInput
                    id="report-loan-from"
                    value={loanDateFrom}
                    onChange={(event) => setLoanDateFrom(event.target.value.slice(0, 10))}
                    onKeyDown={submitFormOnEnterKeyDown}
                  />
                </Field>
                <Field htmlFor="report-loan-to" label={t("reports.fields.dateTo")}>
                  <DateInput
                    id="report-loan-to"
                    value={loanDateTo}
                    onChange={(event) => setLoanDateTo(event.target.value.slice(0, 10))}
                    onKeyDown={submitFormOnEnterKeyDown}
                  />
                </Field>
              </>
            ) : null}

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" disabled={isPending}>
                <FileDown className="h-4 w-4" />
                {generateReportMutation.isPending && !downloading
                  ? t("reports.actions.generating")
                  : t("reports.actions.generate")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => void handleGenerate("download")}
              >
                <Download className="h-4 w-4" />
                {downloading ? t("reports.actions.downloading") : t("reports.actions.download")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {lastResult ? (
        <Card className="mt-6 gap-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">{t("reports.result.title")}</CardTitle>
            {lastResult.fileName ? (
              <CardDescription>{t("reports.result.fileName", { name: lastResult.fileName })}</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
            <p className="text-sm text-muted-foreground">
              {lastResult.expiresAt
                ? t("reports.result.expires", { at: formatExpiresAt(lastResult.expiresAt, locale) })
                : t("reports.toasts.ready")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openReportUrl(lastResult.url)}>
                {t("reports.actions.open")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={downloading}
                onClick={() => {
                  setDownloading(true);
                  void downloadReportFile(lastResult.url, lastResult.fileName).finally(() => {
                    setDownloading(false);
                  });
                }}
              >
                <Download className="h-4 w-4" />
                {t("reports.actions.download")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
