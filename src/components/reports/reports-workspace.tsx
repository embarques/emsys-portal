"use client";

import { useMemo, useState } from "react";
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
  FileText,
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
import { Label } from "@/components/ui/label";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useCustomerPicker } from "@/lib/customers/hooks/use-customers";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { DEFAULT_EMPLOYEE_LIST_PARAMS } from "@/lib/employees/types";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { DEFAULT_INVOICE_LIST_PARAMS } from "@/lib/invoices/types";
import { useReportDefinitions, useRequestReportGeneration } from "@/lib/reports/hooks/use-reports";
import type {
  NormalizedReportRequest,
  ReportDefinition,
  ReportFilterKey,
  ReportFilterValues,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const ALL_CATEGORY = "All";

const FILTER_VALUE_KEYS: Record<string, string[]> = {
  "date-range": ["dateFrom", "dateTo"],
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
  location: ["locationId"],
  "port-destination": ["portDestination"],
  status: ["status"],
};

const INVOICE_STATUS_OPTIONS = [
  { value: "", label: "[All Status]" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "partial", label: "Partial" },
  { value: "cancelled", label: "Cancelled" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "[All Status]" },
  { value: "paid", label: "Paid" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "[All Methods]" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "Transfer" },
];

const LOAN_STATUS_OPTIONS = [
  { value: "", label: "[All Status]" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const STATUS_OPTIONS = [
  { value: "", label: "[All Status]" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PORT_OPTIONS = [
  { value: "", label: "[All Ports]" },
  { value: "dominican-republic", label: "Dominican Republic" },
  { value: "new-york", label: "New York" },
  { value: "new-jersey", label: "New Jersey" },
];

type FilterContext = {
  values: ReportFilterValues;
  errors: Record<string, string>;
  setValue: (key: string, value: string) => void;
};

export function ReportsWorkspace() {
  const feedback = useFeedback();
  const reportsQuery = useReportDefinitions();
  const generation = useRequestReportGeneration();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileConfigOpen, setMobileConfigOpen] = useState(false);
  const [filterValuesByReport, setFilterValuesByReport] = useState<Record<string, ReportFilterValues>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reports = reportsQuery.data ?? [];
  const categories = useMemo(() => {
    const unique = Array.from(new Set(reports.map((report) => report.type).filter(Boolean)));
    return [ALL_CATEGORY, ...unique];
  }, [reports]);

  const filteredReports = useMemo(() => {
    const query = normalizeSearch(search);
    return reports.filter((report) => {
      const matchesCategory = category === ALL_CATEGORY || report.type === category;
      const haystack = normalizeSearch(`${report.name} ${report.type} ${report.description}`);
      return matchesCategory && (!query || haystack.includes(query));
    });
  }, [category, reports, search]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.key === selectedKey) ?? null,
    [reports, selectedKey],
  );

  const selectedValues = selectedReport ? filterValuesByReport[selectedReport.key] ?? {} : {};

  function selectReport(report: ReportDefinition) {
    setSelectedKey(report.key);
    setErrors({});
    setMobileConfigOpen(true);
  }

  function setSelectedFilterValue(key: string, value: string) {
    if (!selectedReport) return;
    setFilterValuesByReport((current) => ({
      ...current,
      [selectedReport.key]: {
        ...(current[selectedReport.key] ?? {}),
        [key]: value,
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
    setFilterValuesByReport((current) => ({ ...current, [selectedReport.key]: {} }));
    setErrors({});
  }

  async function generateSelectedReport() {
    if (!selectedReport) return;
    const validation = validateReportFilters(selectedReport, selectedValues);
    setErrors(validation.errors);
    if (!validation.valid) {
      feedback.notifyError("Review the highlighted filters before generating the report.");
      return;
    }

    const request = normalizeReportRequest(selectedReport, selectedValues);
    await generation.mutateAsync(request);
    feedback.notifySuccess("Report request is ready for Phase 2 generation.");
  }

  const filtersPanel = (
    <ReportConfigurationPanel
      report={selectedReport}
      values={selectedValues}
      errors={errors}
      generating={generation.isPending}
      onValueChange={setSelectedFilterValue}
      onClear={clearFilters}
      onGenerate={generateSelectedReport}
    />
  );

  return (
    <div className="max-w-full overflow-x-hidden">
      <div className="hidden md:block">
        <PageHeader title="Reports" description="Generate and export reports from your data" />
      </div>

      <section className={cn("mb-5 md:hidden", mobileConfigOpen && selectedReport ? "hidden" : "block")}>
        <h1 className="text-3xl font-bold tracking-normal text-foreground">Reports</h1>
        <p className="mt-1 text-base text-muted-foreground">Generate and export reports from your data</p>
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
              Reports
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
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-4 pb-3">
        <CardTitle>Available Reports</CardTitle>
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
  return (
    <>
      <TableSearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Search reports by name, type or description..."
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
            {item}
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
  if (loading) return <ReportLoadingState />;
  if (error) return <ReportEmptyState title="Unable to load reports" description="Refresh the page and try again." />;
  if (total === 0) {
    return (
      <ReportEmptyState
        title="No reports available"
        description="No reports are currently configured or available for this account."
      />
    );
  }
  if (reports.length === 0) {
    return <ReportEmptyState title="No reports found" description="Try changing your search or report category." />;
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Report Name</th>
              <th className="px-3 py-2">Description</th>
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
                    <ReportIcon icon={report.icon} type={report.type} className="size-4" />
                    {report.type}
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
        Showing 1-{reports.length} of {reports.length} reports
      </p>
    </>
  );
}

function ReportMobileCatalog(props: ReportCatalogProps) {
  const { reports, total, loading, error, selectedKey, onSelect } = props;

  return (
    <div className="space-y-4">
      <ReportSearchAndCategories {...props} />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{reports.length} {reports.length === 1 ? "report" : "reports"}</span>
        <span className="font-medium">A-Z</span>
      </div>
      {loading ? <ReportLoadingState /> : null}
      {error ? <ReportEmptyState title="Unable to load reports" description="Refresh the page and try again." /> : null}
      {!loading && !error && total === 0 ? (
        <ReportEmptyState
          title="No reports available"
          description="No reports are currently configured or available for this account."
        />
      ) : null}
      {!loading && !error && total > 0 && reports.length === 0 ? (
        <ReportEmptyState title="No reports found" description="Try changing your search or report category." />
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
              <ReportIcon icon={report.icon} type={report.type} className="size-7" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-snug text-foreground">{report.name}</span>
              <Badge variant="secondary" className="mt-1 bg-primary/10 text-primary hover:bg-primary/10">
                {report.type}
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
}: {
  report: ReportDefinition | null;
  values: ReportFilterValues;
  errors: Record<string, string>;
  generating: boolean;
  onValueChange: (key: string, value: string) => void;
  onClear: () => void;
  onGenerate: () => void;
}) {
  if (!report) {
    return (
      <Card className="min-h-[24rem]">
        <CardContent className="flex min-h-[24rem] flex-col items-center justify-center text-center">
          <FileText className="mb-4 size-12 text-primary/70" />
          <h3 className="text-xl font-semibold">Select a report</h3>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            Choose a report from the list to configure its filters and generate it.
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
            <ReportIcon icon={report.icon} type={report.type} className="size-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold leading-tight text-foreground">{report.name}</h2>
              <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">
                {report.type}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{report.description}</p>
          </div>
        </div>

        <div className="my-5 border-t" />

        <div>
          <h3 className="text-lg font-semibold">Report Filters</h3>
          <p className="text-sm text-muted-foreground">Select the filters to generate the report.</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {report.filters.map((filter) => (
            <DynamicReportFilter key={filter} filter={filter} context={context} />
          ))}
        </div>

        <div className="mt-6 border-t pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClear} className="h-11">
              <X className="size-4" />
              Clear Filters
            </Button>
            <Button type="button" onClick={onGenerate} disabled={generating} className="h-11">
              {generating ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
              Generate Report
            </Button>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-primary/20 bg-primary/10 p-4 text-sm text-primary">
          This report request will be sent through the Phase 1 service boundary. Phase 2 will generate the final report.
        </div>
      </CardContent>
    </Card>
  );
}

function DynamicReportFilter({ filter, context }: { filter: ReportFilterKey; context: FilterContext }) {
  switch (filter) {
    case "date-range":
      return <DateRangeFilter context={context} />;
    case "single-date":
      return <SingleDateFilter context={context} />;
    case "customer":
      return <CustomerFilter context={context} />;
    case "container":
      return <ContainerFilter context={context} />;
    case "invoice":
      return <InvoiceFilter context={context} />;
    case "invoice-status":
      return <StaticSelectFilter context={context} icon={FileText} label="Invoice Status" valueKey="invoiceStatus" options={INVOICE_STATUS_OPTIONS} />;
    case "payment-status":
      return <StaticSelectFilter context={context} icon={ReceiptText} label="Payment Status" valueKey="paymentStatus" options={PAYMENT_STATUS_OPTIONS} />;
    case "payment-method":
      return <StaticSelectFilter context={context} icon={CircleDollarSign} label="Payment Method" valueKey="paymentMethod" options={PAYMENT_METHOD_OPTIONS} />;
    case "employee":
      return <EmployeeFilter context={context} label="Employee" valueKey="employeeId" />;
    case "driver":
      return <EmployeeFilter context={context} label="Driver / Chofer" valueKey="driverId" />;
    case "loan-status":
      return <StaticSelectFilter context={context} icon={BriefcaseBusiness} label="Loan Status" valueKey="loanStatus" options={LOAN_STATUS_OPTIONS} />;
    case "location":
      return <LocationFilter context={context} />;
    case "port-destination":
      return <StaticSelectFilter context={context} icon={Anchor} label="Port / Destination" valueKey="portDestination" options={PORT_OPTIONS} />;
    case "status":
      return <StaticSelectFilter context={context} icon={ClipboardList} label="Status" valueKey="status" options={STATUS_OPTIONS} />;
    default:
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[Reports Portal] Unsupported report filter: ${filter}`);
      }
      return null;
  }
}

function DateRangeFilter({ context }: { context: FilterContext }) {
  return (
    <div className="space-y-2 md:col-span-2">
      <FilterLabel icon={CalendarDays} label="Date Range" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <DateInput
            value={context.values.dateFrom ?? ""}
            onChange={(event) => context.setValue("dateFrom", event.target.value)}
            aria-label="Date from"
          />
          <FilterError message={context.errors.dateFrom} />
        </div>
        <div>
          <DateInput
            value={context.values.dateTo ?? ""}
            onChange={(event) => context.setValue("dateTo", event.target.value)}
            aria-label="Date to"
          />
          <FilterError message={context.errors.dateTo} />
        </div>
      </div>
    </div>
  );
}

function SingleDateFilter({ context }: { context: FilterContext }) {
  return (
    <FilterShell icon={CalendarDays} label="Date" error={context.errors.date}>
      <DateInput
        value={context.values.date ?? ""}
        onChange={(event) => context.setValue("date", event.target.value)}
        aria-label="Date"
      />
    </FilterShell>
  );
}

function CustomerFilter({ context }: { context: FilterContext }) {
  const customers = useCustomerPicker(200);
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: "[All Customers]" },
    ...((customers.data?.items ?? []).map((customer) => ({
      value: customer.id,
      label: customer.name,
    }))),
  ], [customers.data?.items]);

  return (
    <StaticSelectFilter
      context={context}
      icon={User}
      label="Customer"
      valueKey="customerId"
      options={options}
      loading={customers.isLoading}
    />
  );
}

function ContainerFilter({ context }: { context: FilterContext }) {
  const containers = useContainerPicker(200);
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: "[All Containers]" },
    ...((containers.data?.items ?? []).map((container) => ({
      value: String(container.id),
      label: container.name || container.containerNumber || `Container ${container.id}`,
    }))),
  ], [containers.data?.items]);

  return (
    <StaticSelectFilter
      context={context}
      icon={Box}
      label="Container"
      valueKey="containerId"
      options={options}
      loading={containers.isLoading}
    />
  );
}

function InvoiceFilter({ context }: { context: FilterContext }) {
  const invoices = useInvoices({ ...DEFAULT_INVOICE_LIST_PARAMS, limit: 200 });
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: "[All Invoices]" },
    ...((invoices.data?.items ?? []).map((invoice) => ({
      value: invoice.invoiceId,
      label: invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : invoice.invoiceId,
    }))),
  ], [invoices.data?.items]);

  return (
    <StaticSelectFilter
      context={context}
      icon={ReceiptText}
      label="Invoice"
      valueKey="invoiceId"
      options={options}
      loading={invoices.isLoading}
    />
  );
}

function EmployeeFilter({ context, label, valueKey }: { context: FilterContext; label: string; valueKey: string }) {
  const employees = useEmployees({ ...DEFAULT_EMPLOYEE_LIST_PARAMS, limit: 200 });
  const items = employees.data?.items ?? [];
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: label === "Employee" ? "[All Employees]" : "[All Drivers]" },
    ...items.map((employee) => ({
      value: String(employee.id),
      label: employee.name,
    })),
  ], [items, label]);

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

function LocationFilter({ context }: { context: FilterContext }) {
  const branches = useBranchPicker(200);
  const options = useMemo<SearchableSelectOption[]>(() => [
    { value: "", label: "[All Locations]" },
    ...((branches.data?.items ?? []).map((branch) => ({
      value: String(branch.id),
      label: branch.name || branch.code || `Branch ${branch.id}`,
    }))),
  ], [branches.data?.items]);

  return (
    <StaticSelectFilter
      context={context}
      icon={MapPin}
      label="Branch / Location"
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
  return (
    <FilterShell icon={icon} label={label} error={context.errors[valueKey]}>
      <SearchableSelect
        value={context.values[valueKey] ?? ""}
        onValueChange={(value) => context.setValue(valueKey, value)}
        options={options}
        placeholder={options[0]?.label ?? "All"}
        emptyMessage="No options available."
        loading={loading}
        mobileSheet
      />
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
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed text-center">
      <LoaderCircle className="mb-3 size-8 animate-spin text-primary" />
      <p className="text-sm font-medium">Loading reports...</p>
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
          : normalized.includes("empleado") || normalized.includes("employee")
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

function validateReportFilters(report: ReportDefinition, values: ReportFilterValues) {
  const errors: Record<string, string> = {};
  if (report.filters.includes("date-range")) {
    const dateFrom = values.dateFrom;
    const dateTo = values.dateTo;
    if (dateFrom && dateTo && dateFrom > dateTo) {
      errors.dateFrom = "Start date must be before end date.";
      errors.dateTo = "End date must be after start date.";
    }
  }
  if (report.key === "invoices-by-customer" && !values.customerId) {
    errors.customerId = "Customer is required for this report.";
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

function normalizeReportRequest(
  report: ReportDefinition,
  values: ReportFilterValues,
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
  };
}
