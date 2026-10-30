"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Anchor,
  ArrowLeft,
  BadgeDollarSign,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Container,
  FileSpreadsheet,
  FileText,
  FileType,
  LoaderCircle,
  MapPin,
  PackageCheck,
  ReceiptText,
  SearchX,
  User,
  UsersRound,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useCustomerPicker } from "@/lib/customers/hooks/use-customers";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { DEFAULT_INVOICE_LIST_PARAMS } from "@/lib/invoices/types";
import { CUSTOMER_TYPE_RECEIVER, CUSTOMER_TYPE_SENDER } from "@/lib/customers/types";
import { useReportDefinitions, useReportDeliveryOptions, useRequestReportGeneration } from "@/lib/reports/hooks/use-reports";
import { openReportUrl, downloadReportFile } from "@/lib/reports/open-report";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import type {
  NormalizedReportRequest,
  ReportDefinition,
  ReportFilterKey,
  ReportFilterValues,
  ReportOutputFormat,
} from "@/lib/reports/types";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";
import { cn } from "@/lib/utils";

const ALL_CATEGORY = "All";
const LOANS_REPORT_CATEGORY = "Loans";

function isLoanReportKey(key: string): boolean {
  return ["loan", "loans", "loan-report", "loan-statement", "employee-loans"].includes(key);
}

function reportDisplayType(report: Pick<ReportDefinition, "key" | "type">): string {
  if (isLoanReportKey(report.key)) {
    return LOANS_REPORT_CATEGORY;
  }
  return report.type;
}

const FILTER_VALUE_KEYS: Record<string, string[]> = {
  "date-range": ["dateFrom", "dateTo", "dateSearchDisabled"],
  "single-date": ["date"],
  customer: ["customerId"],
  container: ["containerId"],
  invoice: ["invoiceId"],
  "invoice-status": ["invoiceStatus"],
  "payment-status": ["paymentStatus"],
  "payment-method": ["paymentMethod"],
  employee: ["employeeId"],
  "loan-status": ["loanStatus"],
  driver: ["driverId"],
  vehicle: ["vehicleId"],
  location: ["locationId"],
  "port-destination": ["portDestination"],
  status: ["status"],
  "customer-type": ["customerType"],
  "receipt-number": ["receiptNumber"],
  "delivery-number": ["deliveryNumber"],
  rate: ["rate"],
};

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type ReportOptionDefinition = { value: string; labelKey: string };

const OPTION_KEY_PREFIX = "reports.workspace.options";

const INVOICE_STATUS_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allStatus` },
  { value: "open", labelKey: `${OPTION_KEY_PREFIX}.open` },
  { value: "paid", labelKey: `${OPTION_KEY_PREFIX}.paid` },
  { value: "partial", labelKey: `${OPTION_KEY_PREFIX}.partial` },
  { value: "cancelled", labelKey: `${OPTION_KEY_PREFIX}.cancelled` },
];

const PAYMENT_STATUS_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allStatus` },
  { value: "paid", labelKey: `${OPTION_KEY_PREFIX}.paid` },
  { value: "pending", labelKey: `${OPTION_KEY_PREFIX}.pending` },
  { value: "partial", labelKey: `${OPTION_KEY_PREFIX}.partial` },
];

const INVOICE_PAYMENT_STATUS_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allStatus` },
  { value: "OPEN", labelKey: `${OPTION_KEY_PREFIX}.open` },
  { value: "CLOSED", labelKey: `${OPTION_KEY_PREFIX}.closed` },
];

const SHIPMENT_PAYMENT_STATUS_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allStatus` },
  { value: "OPEN", labelKey: `${OPTION_KEY_PREFIX}.open` },
  { value: "CLOSED", labelKey: `${OPTION_KEY_PREFIX}.closed` },
];

const CUSTOMER_TYPE_SEGMENT_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.all` },
  { value: "sender", labelKey: `${OPTION_KEY_PREFIX}.sender` },
  { value: "receiver", labelKey: `${OPTION_KEY_PREFIX}.receiver` },
];

const PAYMENT_METHOD_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allMethods` },
  { value: "cash", labelKey: `${OPTION_KEY_PREFIX}.cash` },
  { value: "check", labelKey: `${OPTION_KEY_PREFIX}.check` },
  { value: "card", labelKey: `${OPTION_KEY_PREFIX}.card` },
  { value: "transfer", labelKey: `${OPTION_KEY_PREFIX}.transfer` },
];

const LOAN_STATUS_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allStatus` },
  { value: "open", labelKey: `${OPTION_KEY_PREFIX}.open` },
  { value: "paid", labelKey: `${OPTION_KEY_PREFIX}.paid` },
];

const STATUS_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allStatus` },
  { value: "active", labelKey: `${OPTION_KEY_PREFIX}.active` },
  { value: "pending", labelKey: `${OPTION_KEY_PREFIX}.pending` },
  { value: "completed", labelKey: `${OPTION_KEY_PREFIX}.completed` },
  { value: "cancelled", labelKey: `${OPTION_KEY_PREFIX}.cancelled` },
];

const PORT_OPTIONS: ReportOptionDefinition[] = [
  { value: "", labelKey: `${OPTION_KEY_PREFIX}.allPorts` },
  { value: "dominican-republic", labelKey: `${OPTION_KEY_PREFIX}.dominicanRepublic` },
  { value: "new-york", labelKey: `${OPTION_KEY_PREFIX}.newYork` },
  { value: "new-jersey", labelKey: `${OPTION_KEY_PREFIX}.newJersey` },
];

function localizeOptions(options: ReportOptionDefinition[], t: TranslateFn): SearchableSelectOption[] {
  return options.map((option) => ({ value: option.value, label: t(option.labelKey) }));
}

function reportCategoryLabel(category: string, t: TranslateFn): string {
  if (category === ALL_CATEGORY) return t("reports.workspace.categories.all");
  if (category === LOANS_REPORT_CATEGORY) return t("reports.workspace.categories.loans");
  return category;
}

function isInvoiceReportKey(key: string): boolean {
  return (
    key !== "customs-invoices" &&
    !isInvoiceDetailsReportKey(key) &&
    ["invoice", "invoices", "invoice-report", "invoices-report", "invoices-by-customer"].includes(key)
  );
}

function isInvoiceDetailsReportKey(key: string): boolean {
  return ["invoice-details", "invoice-detail-report", "invoice-details-report"].includes(key);
}

function isDeliveryReportKey(key: string): boolean {
  return ["delivery", "deliveries", "delivery-report", "conduce", "conduce-report"].includes(key);
}

type FilterContext = {
  values: ReportFilterValues;
  errors: Record<string, string>;
  setValue: (key: string, value: string) => void;
};

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultReportFilterValues(
  report: ReportDefinition,
  userBranchId?: number,
): ReportFilterValues {
  const defaults: ReportFilterValues = {};
  const today = todayInputValue();

  if (report.filters.includes("date-range")) {
    defaults.dateFrom = today;
    defaults.dateTo = today;
  }
  if (report.filters.includes("single-date")) {
    defaults.date = today;
  }
  if (report.filters.includes("location") && userBranchId && userBranchId > 0) {
    defaults.locationId = String(userBranchId);
  }

  return defaults;
}

export function ReportsWorkspace() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const reportsQuery = useReportDefinitions();
  const generation = useRequestReportGeneration();
  const currentUserQuery = useCurrentUser();
  const userBranchId = currentUserQuery.data?.branch?.id;
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [filterValuesByReport, setFilterValuesByReport] = useState<Record<string, ReportFilterValues>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reports = reportsQuery.data ?? [];
  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(reports.map((report) => reportDisplayType(report)).filter(Boolean)),
    );
    return [ALL_CATEGORY, ...unique];
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = normalizeSearch(search);
    return reports.filter((report) => {
      const type = reportDisplayType(report);
      const matchesCategory = category === ALL_CATEGORY || type === category;
      const haystack = normalizeSearch(`${report.name} ${type} ${report.description}`);
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [category, reports, search]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.key === selectedKey) ?? null,
    [reports, selectedKey],
  );

  const selectedValues = selectedReport ? filterValuesByReport[selectedReport.key] ?? {} : {};

  useEffect(() => {
    if (!selectedReport?.filters.includes("location") || !userBranchId || userBranchId <= 0) {
      return;
    }
    setFilterValuesByReport((current) => {
      const existing = current[selectedReport.key];
      if (existing?.locationId !== undefined) return current;
      return {
        ...current,
        [selectedReport.key]: {
          ...(existing ?? {}),
          locationId: String(userBranchId),
        },
      };
    });
  }, [selectedReport, userBranchId]);

  function selectReport(report: ReportDefinition) {
    setSelectedKey(report.key);
    setErrors({});
    setMobileConfigOpen(true);
    setFilterValuesByReport((current) => {
      if (current[report.key]) return current;
      return {
        ...current,
        [report.key]: defaultReportFilterValues(report, userBranchId),
      };
    });
  }

  function setSelectedFilterValue(key: string, value: string) {
    if (!selectedReport) return;
    setFilterValuesByReport((current) => ({
      ...current,
      [selectedReport.key]: {
        ...(current[selectedReport.key] ?? {}),
        [key]: value,
        ...(key === "customerType" ? { customerId: "" } : {}),
      },
    }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function clearFilters() {
    if (!selectedReport) return;
    setFilterValuesByReport((current) => ({
      ...current,
      [selectedReport.key]: defaultReportFilterValues(selectedReport, userBranchId),
    }));
    setErrors({});
  }

  function resolveGenerateFormat(report: ReportDefinition, format?: ReportOutputFormat): ReportOutputFormat {
    if (format) return format;
    if (report.outputs.includes("pdf")) return "pdf";
    if (report.outputs.includes("excel")) return "excel";
    return "pdf";
  }

  async function generateSelectedReport(format?: ReportOutputFormat) {
    if (!selectedReport) return;
    const validation = validateReportFilters(selectedReport, selectedValues, t);
    setErrors(validation.errors);
    if (!validation.valid) {
      feedback.notifyError(t("reports.workspace.toasts.reviewFilters"));
      return;
    }

    const resolvedFormat = resolveGenerateFormat(selectedReport, format);
    const request = normalizeReportRequest(selectedReport, selectedValues, resolvedFormat);
    try {
      const response = await generation.mutateAsync(request);
      if (response.status === "generated") {
        if (resolvedFormat === "excel") {
          await downloadReportFile(
            response.result.url,
            response.result.fileName || "report.xlsx",
          );
          feedback.notifySuccess(t("reports.workspace.toasts.excelDownloaded"));
          return;
        }
        openReportUrl(response.result.url);
        feedback.notifySuccess(t("reports.workspace.toasts.generated"));
        return;
      }
      feedback.notifyError(t("reports.workspace.toasts.notAvailable"));
    } catch (error) {
      feedback.notifyError(normalizeApiError(error).message);
    }
  }

  const supportsExcelDownload = !!selectedReport?.outputs.includes("excel");
  const supportsPdfGenerate = !!selectedReport?.outputs.includes("pdf");

  const filtersPanel = (
    <ReportConfigurationPanel
      report={selectedReport}
      values={selectedValues}
      errors={errors}
      generating={generation.isPending}
      onValueChange={setSelectedFilterValue}
      onClear={clearFilters}
      onGenerate={supportsPdfGenerate ? () => generateSelectedReport("pdf") : undefined}
      onDownloadExcel={supportsExcelDownload ? () => generateSelectedReport("excel") : undefined}
    />
  );

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader title={t("reports.page.title")} description={t("reports.workspace.description")} />
      </div>

      <section className={cn("mb-5 md:hidden", mobileConfigOpen && selectedReport ? "hidden" : "block")}>
        <h1 className="text-3xl font-bold tracking-normal text-foreground">{t("reports.page.title")}</h1>
        <p className="mt-1 text-base text-muted-foreground">{t("reports.workspace.description")}</p>
      </section>

      <div className="hidden gap-4 xl:grid xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,1fr)]">
        <ReportCatalogPanel
          reports={filteredReports}
          total={reports.length}
          search={search}
          categories={categories}
          category={category}
          selectedKey={selectedReport?.key ?? ""}
          loading={reportsQuery.isLoading}
          error={reportsQuery.isError}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onSelect={selectReport}
        />
        {filtersPanel}
      </div>

      <div className="hidden gap-4 md:grid xl:hidden">
        <ReportCatalogPanel
          reports={filteredReports}
          total={reports.length}
          search={search}
          categories={categories}
          category={category}
          selectedKey={selectedReport?.key ?? ""}
          loading={reportsQuery.isLoading}
          error={reportsQuery.isError}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
          onSelect={selectReport}
        />
        {filtersPanel}
      </div>

      <div className="md:hidden">
        {mobileConfigOpen && selectedReport ? (
          <div>
            <button
              type="button"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-primary"
              onClick={() => setMobileConfigOpen(false)}
            >
              <ArrowLeft className="size-4" />
              {t("reports.page.title")}
            </button>
            {filtersPanel}
          </div>
        ) : (
          <ReportMobileCatalog
            reports={filteredReports}
            total={reports.length}
            search={search}
            categories={categories}
            category={category}
            selectedKey={selectedReport?.key ?? ""}
            loading={reportsQuery.isLoading}
            error={reportsQuery.isError}
            onSearchChange={setSearch}
            onCategoryChange={setCategory}
            onSelect={selectReport}
          />
        )}
      </div>
    </div>
  );
}

function ReportCatalogPanel(props: ReportCatalogProps) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-4 pb-3">
        <CardTitle>{t("reports.workspace.availableReports")}</CardTitle>
        <ReportSearchAndCategories {...props} />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ReportCatalogContent {...props} />
      </CardContent>
    </Card>
  );
}

type ReportCatalogProps = {
  reports: ReportDefinition[];
  total: number;
  search: string;
  categories: string[];
  category: string;
  selectedKey: string;
  loading: boolean;
  error: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSelect: (report: ReportDefinition) => void;
};

function ReportSearchAndCategories({
  search,
  categories,
  category,
  onSearchChange,
  onCategoryChange,
}: ReportCatalogProps) {
  const { t } = useTranslation();
  return (
    <>
      <TableSearchInput
        value={search}
        onChange={onSearchChange}
        placeholder={t("reports.workspace.searchPlaceholder")}
      />
      <div className="flex flex-wrap gap-2">
        {categories.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={category === item ? "default" : "outline"}
            className="h-8 rounded-lg px-3"
            onClick={() => onCategoryChange(item)}
          >
            {reportCategoryLabel(item, t)}
          </Button>
        ))}
      </div>
    </>
  );
}

function ReportCatalogContent({
  reports,
  total,
  selectedKey,
  loading,
  error,
  onSelect,
}: ReportCatalogProps) {
  const { t } = useTranslation();
  if (loading) return <ReportLoadingState />;
  if (error) {
    return (
      <ReportEmptyState
        title={t("reports.workspace.states.loadErrorTitle")}
        description={t("reports.workspace.states.loadErrorDescription")}
      />
    );
  }
  if (total === 0) {
    return (
      <ReportEmptyState
        title={t("reports.workspace.states.noneAvailableTitle")}
        description={t("reports.workspace.states.noneAvailableDescription")}
      />
    );
  }
  if (reports.length === 0) {
    return (
      <ReportEmptyState
        title={t("reports.workspace.states.noneFoundTitle")}
        description={t("reports.workspace.states.noneFoundDescription")}
      />
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("reports.workspace.table.type")}</th>
              <th className="px-3 py-2">{t("reports.workspace.table.name")}</th>
              <th className="px-3 py-2">{t("reports.workspace.table.description")}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.key}
                className={cn(
                  "cursor-pointer border-t transition-colors hover:bg-muted/40",
                  selectedKey === report.key && "bg-primary/10 hover:bg-primary/10",
                )}
                onClick={() => onSelect(report)}
              >
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium text-primary">
                    <ReportIcon icon={report.icon} type={reportDisplayType(report)} className="size-4" />
                    {reportCategoryLabel(reportDisplayType(report), t)}
                  </span>
                </td>
                <td className="px-3 py-2 font-medium text-foreground">{report.name}</td>
                <td className="px-3 py-2 text-muted-foreground">{report.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        {t("reports.workspace.showing", { count: reports.length, total: reports.length })}
      </p>
    </>
  );
}

function ReportMobileCatalog(props: ReportCatalogProps) {
  const { reports, total, loading, error, selectedKey, onSelect } = props;
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <ReportSearchAndCategories {...props} />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t(
            reports.length === 1 ? "reports.workspace.reportCountOne" : "reports.workspace.reportCountOther",
            { count: reports.length },
          )}
        </span>
        <span className="font-medium">A-Z</span>
      </div>
      {loading ? <ReportLoadingState /> : null}
      {error ? (
        <ReportEmptyState
          title={t("reports.workspace.states.loadErrorTitle")}
          description={t("reports.workspace.states.loadErrorDescription")}
        />
      ) : null}
      {!loading && !error && total === 0 ? (
        <ReportEmptyState
          title={t("reports.workspace.states.noneAvailableTitle")}
          description={t("reports.workspace.states.noneAvailableDescription")}
        />
      ) : null}
      {!loading && !error && total > 0 && reports.length === 0 ? (
        <ReportEmptyState
          title={t("reports.workspace.states.noneFoundTitle")}
          description={t("reports.workspace.states.noneFoundDescription")}
        />
      ) : null}
      <div className="space-y-3">
        {reports.map((report) => (
          <button
            key={report.key}
            type="button"
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
              selectedKey === report.key && "border-primary/30 bg-primary/10",
            )}
            onClick={() => onSelect(report)}
          >
            <span className="grid size-10 shrink-0 place-items-center text-primary">
              <ReportIcon icon={report.icon} type={reportDisplayType(report)} className="size-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug text-foreground">{report.name}</span>
              <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary hover:bg-primary/10">
                {reportCategoryLabel(reportDisplayType(report), t)}
              </Badge>
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">{report.description}</span>
            </span>
            <ChevronRight className="mt-5 size-4 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportConfigurationPanel({
  report,
  values,
  errors,
  generating,
  onValueChange,
  onClear,
  onGenerate,
  onDownloadExcel,
}: {
  report: ReportDefinition | null;
  values: ReportFilterValues;
  errors: Record<string, string>;
  generating: boolean;
  onValueChange: (key: string, value: string) => void;
  onClear: () => void;
  onGenerate?: () => void;
  onDownloadExcel?: () => void;
}) {
  const { t } = useTranslation();
  if (!report) {
    return (
      <Card className="min-h-[24rem]">
        <CardContent className="flex min-h-[24rem] flex-col items-center justify-center text-center">
          <FileText className="mb-4 size-12 text-primary/70" />
          <h3 className="text-xl font-semibold">{t("reports.workspace.config.selectTitle")}</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {t("reports.workspace.config.selectDescription")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const context: FilterContext = { values, errors, setValue: onValueChange };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 md:p-6">
        <div className="flex items-start gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-lg border bg-primary/10 text-primary">
            <ReportIcon icon={report.icon} type={reportDisplayType(report)} className="size-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold leading-tight text-foreground">{report.name}</h2>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                {reportCategoryLabel(reportDisplayType(report), t)}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
          </div>
        </div>

        <div className="my-5 border-t" />

        <div>
          <h3 className="text-lg font-semibold">{t("reports.workspace.config.filtersTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("reports.workspace.config.filtersDescription")}</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {report.filters.map((filter) => (
            <DynamicReportFilter key={filter} filter={filter} reportKey={report.key} context={context} />
          ))}
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClear} className="h-11">
              <X className="size-4" />
              {t("reports.workspace.config.clearFilters")}
            </Button>
            {onDownloadExcel ? (
              <Button
                type="button"
                variant="outline"
                onClick={onDownloadExcel}
                disabled={generating}
                className="h-11 border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                aria-label={t("reports.workspace.config.downloadExcelAria")}
                title={t("reports.workspace.config.downloadExcel")}
              >
                {generating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                )}
                {t("reports.workspace.config.downloadExcel")}
              </Button>
            ) : null}
            {onGenerate ? (
              <Button
                type="button"
                onClick={onGenerate}
                disabled={generating}
                className="h-11"
                aria-label={t("reports.workspace.config.generatePdfAria")}
                title={t("reports.workspace.config.generatePdf")}
              >
                {generating ? <LoaderCircle className="size-4 animate-spin" /> : <FileType className="size-4" />}
                {t("reports.workspace.config.generatePdf")}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DynamicReportFilter({
  filter,
  reportKey,
  context,
}: {
  filter: ReportFilterKey;
  reportKey: string;
  context: FilterContext;
}) {
  const { t } = useTranslation();
  const localizedOptions = useMemo(
    () => ({
      invoiceStatus: localizeOptions(INVOICE_STATUS_OPTIONS, t),
      paymentStatus: localizeOptions(PAYMENT_STATUS_OPTIONS, t),
      invoicePaymentStatus: localizeOptions(INVOICE_PAYMENT_STATUS_OPTIONS, t),
      shipmentPaymentStatus: localizeOptions(SHIPMENT_PAYMENT_STATUS_OPTIONS, t),
      customerTypeSegment: localizeOptions(CUSTOMER_TYPE_SEGMENT_OPTIONS, t),
      paymentMethod: localizeOptions(PAYMENT_METHOD_OPTIONS, t),
      loanStatus: localizeOptions(LOAN_STATUS_OPTIONS, t),
      status: localizeOptions(STATUS_OPTIONS, t),
      port: localizeOptions(PORT_OPTIONS, t),
    }),
    [t],
  );

  switch (filter) {
    case "date-range":
      return <DateRangeFilter context={context} allowDisable={isInvoiceReportKey(reportKey)} />;
    case "single-date":
      return <SingleDateFilter context={context} />;
    case "customer":
      return <CustomerFilter context={context} />;
    case "customer-type":
      return (
        <SegmentedFilter
          context={context}
          icon={UsersRound}
          label={t("reports.workspace.filters.customerType")}
          valueKey="customerType"
          options={localizedOptions.customerTypeSegment}
        />
      );
    case "receipt-number":
      return (
        <TextFilter
          context={context}
          icon={ReceiptText}
          label={t("reports.workspace.filters.receiptNumber")}
          valueKey="receiptNumber"
          placeholder={t("reports.workspace.filters.receiptNumberPlaceholder")}
        />
      );
    case "delivery-number":
      return <DeliveryNumberFilter context={context} />;
    case "rate":
      return (
        <TextFilter
          context={context}
          icon={CircleDollarSign}
          label={t("reports.workspace.filters.rate")}
          valueKey="rate"
          placeholder={t("reports.workspace.filters.ratePlaceholder")}
          inputMode="decimal"
        />
      );
    case "container":
      return <ContainerFilter context={context} furgon={isInvoiceReportKey(reportKey) || isInvoiceDetailsReportKey(reportKey)} />;
    case "invoice":
      return <InvoiceFilter context={context} />;
    case "invoice-status":
      return (
        <StaticSelectFilter
          context={context}
          icon={FileText}
          label={t("reports.workspace.filters.invoiceStatus")}
          valueKey="invoiceStatus"
          options={localizedOptions.invoiceStatus}
        />
      );
    case "payment-status":
      return (
        <StaticSelectFilter
          context={context}
          icon={ReceiptText}
          label={t("reports.workspace.filters.paymentStatus")}
          valueKey="paymentStatus"
          options={
            isInvoiceReportKey(reportKey)
              || isInvoiceDetailsReportKey(reportKey)
              ? localizedOptions.invoicePaymentStatus
              : reportKey === "shipment-relation"
                ? localizedOptions.shipmentPaymentStatus
                : localizedOptions.paymentStatus
          }
        />
      );
    case "payment-method":
      return (
        <StaticSelectFilter
          context={context}
          icon={CircleDollarSign}
          label={t("reports.workspace.filters.paymentMethod")}
          valueKey="paymentMethod"
          options={localizedOptions.paymentMethod}
        />
      );
    case "employee":
      return (
        <EmployeeFilter
          context={context}
          label={t("reports.workspace.filters.employee")}
          allLabel={t("reports.workspace.options.allEmployees")}
          valueKey="employeeId"
        />
      );
    case "driver":
      return (
        <EmployeeFilter
          context={context}
          label={t("reports.workspace.filters.driver")}
          allLabel={t("reports.workspace.options.allDrivers")}
          valueKey="driverId"
        />
      );
    case "vehicle":
      return <VehicleFilter context={context} />;
    case "loan-status":
      return (
        <StaticSelectFilter
          context={context}
          icon={BriefcaseBusiness}
          label={t("reports.workspace.filters.loanStatus")}
          valueKey="loanStatus"
          options={localizedOptions.loanStatus}
        />
      );
    case "location":
      return <LocationFilter context={context} />;
    case "port-destination":
      return (
        <StaticSelectFilter
          context={context}
          icon={Anchor}
          label={t("reports.workspace.filters.portDestination")}
          valueKey="portDestination"
          options={localizedOptions.port}
        />
      );
    case "status":
      return (
        <StaticSelectFilter
          context={context}
          icon={ClipboardList}
          label={t("reports.workspace.filters.status")}
          valueKey="status"
          options={localizedOptions.status}
        />
      );
    default:
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[Reports Portal] Unsupported report filter: ${filter}`);
      }
      return null;
  }
}

function DateRangeFilter({
  context,
  allowDisable = false,
}: {
  context: FilterContext;
  allowDisable?: boolean;
}) {
  const { t } = useTranslation();
  const dateSearchEnabled = context.values.dateSearchDisabled !== "true";

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterLabel icon={CalendarDays} label={t("reports.workspace.filters.dateRange")} />
        {allowDisable ? (
          <div className="flex items-center gap-2">
            <Switch
              id="invoice-date-search-enabled"
              checked={dateSearchEnabled}
              onCheckedChange={(checked) => context.setValue("dateSearchDisabled", checked ? "" : "true")}
            />
            <Label htmlFor="invoice-date-search-enabled" className="text-sm font-medium">
              {t("reports.workspace.filters.searchByDate")}
            </Label>
          </div>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <DateInput
            value={context.values.dateFrom ?? ""}
            onChange={(event) => context.setValue("dateFrom", event.target.value)}
            aria-label={t("reports.workspace.filters.dateFrom")}
            disabled={!dateSearchEnabled}
          />
          <FilterError message={context.errors.dateFrom} />
        </div>
        <div>
          <DateInput
            value={context.values.dateTo ?? ""}
            onChange={(event) => context.setValue("dateTo", event.target.value)}
            aria-label={t("reports.workspace.filters.dateTo")}
            disabled={!dateSearchEnabled}
          />
          <FilterError message={context.errors.dateTo} />
        </div>
      </div>
    </div>
  );
}

function SingleDateFilter({ context }: { context: FilterContext }) {
  const { t } = useTranslation();
  return (
    <FilterShell icon={CalendarDays} label={t("reports.workspace.filters.date")} error={context.errors.date}>
      <DateInput
        value={context.values.date ?? ""}
        onChange={(event) => context.setValue("date", event.target.value)}
        aria-label={t("reports.workspace.filters.date")}
      />
    </FilterShell>
  );
}

function TextFilter({
  context,
  icon,
  label,
  valueKey,
  placeholder,
  inputMode,
}: {
  context: FilterContext;
  icon: ComponentType<{ className?: string }>;
  label: string;
  valueKey: string;
  placeholder?: string;
  inputMode?: "decimal" | "numeric" | "text";
}) {
  return (
    <FilterShell icon={icon} label={label} error={context.errors[valueKey]}>
      <Input
        value={context.values[valueKey] ?? ""}
        onChange={(event) => context.setValue(valueKey, event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </FilterShell>
  );
}

function DeliveryNumberFilter({ context }: { context: FilterContext }) {
  const { t } = useTranslation();
  const deliveries = useReportDeliveryOptions(200);
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: t("reports.workspace.options.selectDelivery") },
    ...((deliveries.data ?? []).map((delivery) => ({
      value: delivery.id,
      label: delivery.label,
    }))),
  ], [deliveries.data, t]);

  return (
    <StaticSelectFilter
      context={context}
      icon={Container}
      label={t("reports.workspace.filters.deliveryNumber")}
      valueKey="deliveryNumber"
      options={options}
      loading={deliveries.isLoading}
    />
  );
}

function CustomerFilter({ context }: { context: FilterContext }) {
  const { t } = useTranslation();
  const selectedType = context.values.customerType;
  const customerType =
    selectedType === "sender"
      ? CUSTOMER_TYPE_SENDER
      : selectedType === "receiver"
        ? CUSTOMER_TYPE_RECEIVER
        : undefined;
  const customers = useCustomerPicker(200, { customerType });
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: t("reports.workspace.options.allCustomers") },
    ...((customers.data?.items ?? []).map((customer) => ({
      value: customer.id,
      label: customer.name,
    }))),
  ], [customers.data?.items, t]);

  return (
    <StaticSelectFilter
      context={context}
      icon={User}
      label={t("reports.workspace.filters.customer")}
      valueKey="customerId"
      options={options}
      loading={customers.isLoading}
    />
  );
}

function ContainerFilter({ context, furgon = false }: { context: FilterContext; furgon?: boolean }) {
  const { t } = useTranslation();
  const containers = useContainerPicker(200);
  const label = furgon ? t("reports.workspace.filters.furgon") : t("reports.workspace.filters.container");
  const options = useMemo<SearchableSelectOption[]>(() => [
    {
      value: "",
      label: furgon ? t("reports.workspace.options.allFurgons") : t("reports.workspace.options.allContainers"),
    },
    ...((containers.data?.items ?? []).map((container) => ({
      value: String(container.id),
      label:
        container.name
        || container.containerNumber
        || t("reports.workspace.options.containerFallback", { id: container.id }),
    }))),
  ], [containers.data?.items, furgon, t]);

  return (
    <StaticSelectFilter
      context={context}
      icon={Box}
      label={label}
      valueKey="containerId"
      options={options}
      loading={containers.isLoading}
    />
  );
}

function InvoiceFilter({ context }: { context: FilterContext }) {
  const { t } = useTranslation();
  const invoices = useInvoices({ ...DEFAULT_INVOICE_LIST_PARAMS, limit: 200 });
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: t("reports.workspace.options.allInvoices") },
    ...((invoices.data?.items ?? []).map((invoice) => ({
      value: invoice.invoiceId,
      label: invoice.invoiceNumber
        ? t("reports.workspace.options.invoiceNumber", { number: invoice.invoiceNumber })
        : invoice.invoiceId,
    }))),
  ], [invoices.data?.items, t]);

  return (
    <StaticSelectFilter
      context={context}
      icon={ReceiptText}
      label={t("reports.workspace.filters.invoice")}
      valueKey="invoiceId"
      options={options}
      loading={invoices.isLoading}
    />
  );
}

function EmployeeFilter({
  context,
  label,
  allLabel,
  valueKey,
}: {
  context: FilterContext;
  label: string;
  allLabel: string;
  valueKey: string;
}) {
  const employees = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const items = employees.data?.items ?? [];
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: allLabel },
    ...items.map((employee) => ({
      value: String(employee.id),
      label: employee.name,
    })),
  ], [items, allLabel]);

  return (
    <StaticSelectFilter
      context={context}
      icon={UsersRound}
      label={label}
      valueKey={valueKey}
      options={options}
      loading={employees.isLoading}
    />
  );
}

function VehicleFilter({ context }: { context: FilterContext }) {
  const { t } = useTranslation();
  const vehicles = useVehiclePicker(200, { enabled: true });
  const items = vehicles.data?.items ?? [];
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: t("reports.workspace.options.allVehicles") },
    ...items.map((vehicle) => ({
      value: vehicle.id,
      label: vehicle.name,
      description: vehicle.licensePlate || vehicle.vehicleId,
      keywords: [vehicle.name, vehicle.vehicleId, vehicle.licensePlate, vehicle.vin],
    })),
  ], [items, t]);

  return (
    <StaticSelectFilter
      context={context}
      icon={Container}
      label={t("reports.workspace.filters.vehicle")}
      valueKey="vehicleId"
      options={options}
      loading={vehicles.isLoading}
    />
  );
}

function LocationFilter({ context }: { context: FilterContext }) {
  const { t } = useTranslation();
  const branches = useBranchPicker(200);
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: t("reports.workspace.options.allLocations") },
    ...((branches.data?.items ?? []).map((branch) => ({
      value: String(branch.id),
      label: branch.name || branch.code || t("reports.workspace.options.branchFallback", { id: branch.id }),
    }))),
  ], [branches.data?.items, t]);

  return (
    <StaticSelectFilter
      context={context}
      icon={MapPin}
      label={t("reports.workspace.filters.location")}
      valueKey="locationId"
      options={options}
      loading={branches.isLoading}
    />
  );
}

function StaticSelectFilter({
  context,
  icon,
  label,
  valueKey,
  options,
  loading,
}: {
  context: FilterContext;
  icon: ComponentType<{ className?: string }>;
  label: string;
  valueKey: string;
  options: SearchableSelectOption[];
  loading?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <FilterShell icon={icon} label={label} error={context.errors[valueKey]}>
      <SearchableSelect
        value={context.values[valueKey] ?? ""}
        onValueChange={(value) => context.setValue(valueKey, value)}
        options={options}
        placeholder={options[0]?.label ?? t("reports.workspace.options.all")}
        emptyMessage={t("reports.workspace.options.noOptions")}
        loading={loading}
        mobileSheet
      />
    </FilterShell>
  );
}

function SegmentedFilter({
  context,
  icon,
  label,
  valueKey,
  options,
}: {
  context: FilterContext;
  icon: ComponentType<{ className?: string }>;
  label: string;
  valueKey: string;
  options: Array<{ value: string; label: string }>;
}) {
  const currentValue = context.values[valueKey] ?? "";

  return (
    <FilterShell icon={icon} label={label} error={context.errors[valueKey]}>
      <div className="grid h-11 grid-cols-[0.8fr_1fr_1.45fr] gap-1 rounded-lg border bg-muted/30 py-1.5 pl-1.5 pr-2.5">
        {options.map((option) => {
          const selected = currentValue === option.value;
          return (
            <button
              key={option.value || "all"}
              type="button"
              className={cn(
                "min-w-0 rounded-md px-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
              onClick={() => context.setValue(valueKey, option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </FilterShell>
  );
}

function FilterShell({
  icon,
  label,
  error,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <FilterLabel icon={icon} label={label} />
      {children}
      <FilterError message={error} />
    </div>
  );
}

function FilterLabel({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Label className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      {label}
    </Label>
  );
}

function FilterError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function ReportLoadingState() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center">
      <LoaderCircle className="mb-3 size-8 animate-spin text-primary" />
      <p className="text-sm font-medium">{t("reports.workspace.states.loading")}</p>
    </div>
  );
}

function ReportEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center">
      <SearchX className="mb-3 size-9 text-muted-foreground" />
      <p className="font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ReportIcon({ icon, type, className }: { icon?: string; type: string; className?: string }) {
  const normalized = normalizeSearch(`${icon ?? ""} ${type}`);
  const Icon =
    normalized.includes("aduana") || normalized.includes("customs")
      ? PackageCheck
      : normalized.includes("ingreso") || normalized.includes("income")
        ? BadgeDollarSign
        : normalized.includes("conduce") || normalized.includes("delivery")
          ? Container
          : normalized.includes("empleado") || normalized.includes("employee") || normalized.includes("loan") || normalized.includes("prestamo")
            ? UsersRound
            : normalized.includes("cliente") || normalized.includes("customer")
              ? UsersRound
              : normalized.includes("contabilidad") || normalized.includes("accounting")
                ? CircleDollarSign
                : FileText;

  return <Icon className={className} aria-hidden="true" />;
}

function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

function validateReportFilters(report: ReportDefinition, values: ReportFilterValues, t: TranslateFn) {
  const errors: Record<string, string> = {};
  if (report.key === "payment-receipt" && !values.receiptNumber?.trim()) {
    errors.receiptNumber = t("reports.workspace.validation.receiptNumberRequired");
  }
  const invoiceReport = isInvoiceReportKey(report.key);
  const invoiceDetailsReport = isInvoiceDetailsReportKey(report.key);
  const dateSearchDisabled = invoiceReport && values.dateSearchDisabled === "true";

  if (report.filters.includes("date-range") && !dateSearchDisabled) {
    const dateFrom = values.dateFrom;
    const dateTo = values.dateTo;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      errors.dateFrom = t("reports.workspace.validation.startBeforeEnd");
      errors.dateTo = t("reports.workspace.validation.endAfterStart");
    }
  }
  if (invoiceReport) {
    if (dateSearchDisabled && !values.containerId?.trim()) {
      errors.containerId = t("reports.workspace.validation.containerRequiredWhenDateDisabled");
    }
    if (!dateSearchDisabled && !values.dateFrom?.trim() && !values.dateTo?.trim()) {
      errors.dateFrom = t("reports.workspace.validation.dateRangeRequiredWhenEnabled");
      errors.dateTo = t("reports.workspace.validation.dateRangeRequiredWhenEnabled");
    }
  }
  if (invoiceDetailsReport && !values.containerId?.trim()) {
    errors.containerId = t("reports.workspace.validation.furgonRequired");
  }
  if (report.key === "invoices-by-customer" && !values.customerId) {
    errors.customerId = t("reports.workspace.validation.customerRequired");
  }
  if (report.key === "customs-form" && !values.containerId) {
    errors.containerId = t("reports.workspace.validation.containerRequired");
  }
  if (report.key === "customs-invoices" && !values.containerId) {
    errors.containerId = t("reports.workspace.validation.containerRequired");
  }
  if (report.key === "shipment-relation" && !values.containerId) {
    errors.containerId = t("reports.workspace.validation.containerRequired");
  }
  if (isDeliveryReportKey(report.key)) {
    if (!values.deliveryNumber?.trim()) {
      errors.deliveryNumber = t("reports.workspace.validation.deliveryNumberRequired");
    }
    const rate = values.rate?.trim();
    if (rate && (!Number.isFinite(Number(rate)) || Number(rate) <= 0)) {
      errors.rate = t("reports.workspace.validation.rateGreaterThanZero");
    }
  }
  if (isLoanReportKey(report.key)) {
    if (!values.employeeId?.trim()) {
      errors.employeeId = t("reports.workspace.validation.employeeRequired");
    }
    if (!values.dateFrom?.trim() && !values.dateTo?.trim()) {
      errors.dateFrom = t("reports.workspace.validation.dateRangeRequired");
      errors.dateTo = t("reports.workspace.validation.dateRangeRequired");
    }
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function normalizeReportRequest(
  report: ReportDefinition,
  values: ReportFilterValues,
  format?: ReportOutputFormat,
): NormalizedReportRequest {
  const allowedKeys = new Set(report.filters.flatMap((filter) => FILTER_VALUE_KEYS[filter] ?? []));
  const filters = Object.entries(values).reduce<ReportFilterValues>((current, [key, value]) => {
    if (allowedKeys.has(key) && value.trim()) {
      current[key] = value;
    }
    return current;
  }, {});

  return {
    reportKey: report.key,
    filters,
    format,
  };
}
