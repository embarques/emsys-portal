"use client";

import { useMemo, useState } from "react";
import {
  Barcode,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Printer,
  RefreshCw,
  Search,
  Tags,
  XCircle,
} from "lucide-react";

import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
import { TableSearchInput } from "@/components/app-shell/table-search-input";
import {
  TableDirectoryToolbar,
  TableFilterPanel,
  TableFilterSection,
} from "@/components/app-shell/table-directory-toolbar";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { formatAuditDate } from "@/lib/audit/display";
import { cloneContainers } from "@/lib/containers/mock-data";
import { formatInvoiceDate } from "@/lib/invoices/display";
import { cloneInvoices } from "@/lib/invoices/mock-data";
import { getRouteAssignmentLabel } from "@/lib/orders/display";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import {
  computeLabelKpis,
  formatActivityAction,
  formatLabelTimestamp,
  getLabelContainerLabel,
  getLabelStatusBadgeClass,
  getLabelStatusLabel,
  labelMatchesQuery,
  truncateBarcode,
} from "@/lib/labels/display";
import { mutateLabelsStore, prependLabelActivity } from "@/lib/labels/store";
import { useLabelsStore } from "@/lib/labels/use-labels-store";
import {
  LABEL_STATUSES,
  buildStagedLineItems,
  createActivityEntry,
  generateLabelsForLineItem,
  type LabelActivityEntry,
  type LabelFilterState,
  type LabelStatus,
  type ShipmentLabel,
  type StagedLineItem,
} from "@/lib/labels/types";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const defaultFilters: LabelFilterState = {
  query: "",
  status: "all",
};

type ContainerChangeScope = "selected" | "invoice";

export function LabelsWorkspace() {
  const { notifyAdded, notifyUpdated } = useFeedback();
  const { labels, activityLog } = useLabelsStore();
  const invoices = useMemo(() => cloneInvoices(), []);
  const containers = useMemo(() => cloneContainers(), []);
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);

  const [stagedInvoiceIds, setStagedInvoiceIds] = useState<string[]>([]);
  const [stagedRouteAssignments, setStagedRouteAssignments] = useState<Record<string, string>>({});
  const [bulkRouteAssignmentId, setBulkRouteAssignmentId] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [selectedStagedKeys, setSelectedStagedKeys] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<LabelFilterState>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<LabelStatus>("printed");
  const [newContainerId, setNewContainerId] = useState("");
  const [containerScope, setContainerScope] = useState<ContainerChangeScope>("selected");
  const [targetInvoiceIdForContainer, setTargetInvoiceIdForContainer] = useState("");

  const stagedLineItems = useMemo(
    () => buildStagedLineItems(stagedInvoiceIds, invoices),
    [invoices, stagedInvoiceIds]
  );

  const filteredInvoices = useMemo(() => {
    const normalized = invoiceSearch.trim().toLowerCase();
    if (!normalized) return invoices;
    return invoices.filter((invoice) =>
      [invoice.invoiceNumber, invoice.invoiceId, invoice.date, invoice.createdBy]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [invoiceSearch, invoices]);

  const filteredLabels = useMemo(() => {
    return labels.filter((label) => {
      if (!labelMatchesQuery(label, filters.query)) return false;
      if (filters.status !== "all" && label.status !== filters.status) return false;
      return true;
    });
  }, [filters, labels]);

  const kpis = useMemo(() => computeLabelKpis(labels), [labels]);
  const totalPages = Math.max(1, Math.ceil(filteredLabels.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageLabels = filteredLabels.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageLabels.length > 0 && pageLabels.every((label) => selectedLabelIds.includes(label.labelId));

  function appendActivity(entries: LabelActivityEntry[]) {
    prependLabelActivity(entries);
  }

  function stageSelectedInvoices() {
    if (selectedInvoiceIds.length === 0) return;
    setStagedInvoiceIds((current) => Array.from(new Set([...current, ...selectedInvoiceIds])));
    setSelectedInvoiceIds([]);
    setSelectedStagedKeys([]);
  }

  function clearStaging() {
    setStagedInvoiceIds([]);
    setSelectedStagedKeys([]);
    setStagedRouteAssignments({});
    setBulkRouteAssignmentId("");
  }

  function setStagedItemRouteAssignment(key: string, routeAssignmentId: string) {
    setStagedRouteAssignments((current) => {
      if (!routeAssignmentId) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: routeAssignmentId };
    });
  }

  function applyRouteAssignmentToSelected() {
    if (selectedStagedKeys.length === 0 || !bulkRouteAssignmentId) return;
    setStagedRouteAssignments((current) => {
      const next = { ...current };
      selectedStagedKeys.forEach((key) => {
        next[key] = bulkRouteAssignmentId;
      });
      return next;
    });
  }

  function toggleStagedKey(key: string, checked: boolean) {
    setSelectedStagedKeys((current) =>
      checked ? [...current, key] : current.filter((entry) => entry !== key)
    );
  }

  function generateLabelsForSelected() {
    const items = stagedLineItems
      .filter((item) => selectedStagedKeys.includes(item.key))
      .map((item) => ({
        ...item,
        routeAssignmentId: stagedRouteAssignments[item.key] || undefined,
      }));
    if (items.length === 0) return;

    const newLabels: ShipmentLabel[] = [];
    const activities: LabelActivityEntry[] = [];

    items.forEach((item) => {
      const result = generateLabelsForLineItem(item, labels, DEFAULT_CREATED_BY);
      newLabels.push(...result.labels);
      activities.push(...result.activities);
    });

    if (newLabels.length > 0) {
      mutateLabelsStore((current) => [...newLabels, ...current]);
      notifyAdded("Label", `${newLabels.length} generated`);
    }

    appendActivity(activities);
    setSelectedStagedKeys([]);
  }

  function openStatusDialog() {
    if (selectedLabelIds.length === 0) return;
    setStatusDialogOpen(true);
  }

  function applyStatusChange() {
    const targets = labels.filter((label) => selectedLabelIds.includes(label.labelId));
    const now = new Date().toISOString();
    const activities: LabelActivityEntry[] = [];

    mutateLabelsStore((current) =>
      current.map((label) => {
        if (!selectedLabelIds.includes(label.labelId)) return label;

        const previous = label.status;
        activities.push(
          createActivityEntry({
            labelId: label.labelId,
            barcode: label.barcode,
            invoiceNumber: label.invoiceNumber,
            action: "status_change",
            success: true,
            message: `Status changed from ${getLabelStatusLabel(previous)} to ${getLabelStatusLabel(newStatus)}.`,
            performedBy: DEFAULT_CREATED_BY,
          })
        );

        return { ...label, status: newStatus, updatedAt: now };
      })
    );

    appendActivity(activities);
    notifyUpdated("Label status");
    setStatusDialogOpen(false);
  }

  function openContainerDialog() {
    if (selectedLabelIds.length === 0 && !targetInvoiceIdForContainer) return;
    setNewContainerId(containers[0]?.containerId ?? "");
    setContainerDialogOpen(true);
  }

  function applyContainerChange() {
    if (!newContainerId) return;

    const now = new Date().toISOString();
    const activities: LabelActivityEntry[] = [];

    mutateLabelsStore((current) =>
      current.map((label) => {
        const shouldUpdate =
          containerScope === "invoice" && targetInvoiceIdForContainer
            ? label.invoiceId === targetInvoiceIdForContainer
            : selectedLabelIds.includes(label.labelId);

        if (!shouldUpdate) return label;

        const previous = getLabelContainerLabel(label.containerId);
        const next = getLabelContainerLabel(newContainerId);

        activities.push(
          createActivityEntry({
            labelId: label.labelId,
            barcode: label.barcode,
            invoiceNumber: label.invoiceNumber,
            action: "container_change",
            success: true,
            message:
              containerScope === "invoice"
                ? `Container changed for all labels on ${label.invoiceNumber}: ${previous} → ${next}.`
                : `Container changed: ${previous} → ${next}.`,
            performedBy: DEFAULT_CREATED_BY,
          })
        );

        return { ...label, containerId: newContainerId, updatedAt: now };
      })
    );

    appendActivity(activities);
    notifyUpdated("Label container");
    setContainerDialogOpen(false);
    setTargetInvoiceIdForContainer("");
  }

  function printSelectedLabels() {
    const targets = labels.filter((label) => selectedLabelIds.includes(label.labelId));
    if (targets.length === 0) return;

    const now = new Date().toISOString();
    const activities = targets.map((label) =>
      createActivityEntry({
        labelId: label.labelId,
        barcode: label.barcode,
        invoiceNumber: label.invoiceNumber,
        action: "print",
        success: true,
        message: `Sent label ${label.barcode} to printer.`,
        performedBy: DEFAULT_CREATED_BY,
      })
    );

    mutateLabelsStore((current) =>
      current.map((label) =>
        selectedLabelIds.includes(label.labelId) && label.status === "generated"
          ? { ...label, status: "printed" as LabelStatus, updatedAt: now }
          : label
      )
    );

    appendActivity(activities);
    notifyUpdated("Print job", `${targets.length} label(s)`);
  }

  function toggleSelectAllLabels(checked: boolean) {
    if (checked) {
      setSelectedLabelIds((current) =>
        Array.from(new Set([...current, ...pageLabels.map((label) => label.labelId)]))
      );
      return;
    }
    setSelectedLabelIds((current) =>
      current.filter((id) => !pageLabels.some((label) => label.labelId === id))
    );
  }

  function toggleSelectLabel(labelId: string, checked: boolean) {
    setSelectedLabelIds((current) =>
      checked ? [...current, labelId] : current.filter((entry) => entry !== labelId)
    );
  }

  const labelColumns: DataTableColumn<ShipmentLabel>[] = [
    {
      id: "invoiceNumber",
      label: "Invoice",
      cellClassName: "font-medium",
      renderCell: (label) => label.invoiceNumber,
    },
    {
      id: "barcode",
      label: "Barcode",
      cellClassName: "font-mono text-xs",
      renderCell: (label) => truncateBarcode(label.barcode),
    },
    {
      id: "status",
      label: "Status",
      renderCell: (label) => (
        <Badge className={getLabelStatusBadgeClass(label.status)}>{getLabelStatusLabel(label.status)}</Badge>
      ),
    },
    {
      id: "totalLabels",
      label: "Labels",
      renderCell: (label) => `${label.labelSequence} / ${label.totalLabels}`,
    },
    {
      id: "container",
      label: "Container",
      renderCell: (label) => getLabelContainerLabel(label.containerId),
    },
    {
      id: "routeAssignment",
      label: "Route assignment",
      renderCell: (label) =>
        label.routeAssignmentId ? getRouteAssignmentLabel(label.routeAssignmentId) : "—",
    },
    {
      id: "description",
      label: "Description",
      renderCell: (label) => label.description,
    },
    {
      id: "quantity",
      label: "Qty",
      renderCell: (label) => label.quantity,
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (label) => formatAuditDate(label.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (label) => label.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (label) => formatAuditDate(label.updatedAt),
    },
  ];

  const columnVisibility = useColumnVisibility("labels", labelColumns);

  const statusFilters: { value: LabelFilterState["status"]; label: string }[] = [
    { value: "all", label: "All" },
    ...LABEL_STATUSES,
  ];
  const activeFilterCount = filters.status !== "all" ? 1 : 0;
  const hasActiveFilters = Boolean(filters.query.trim()) || filters.status !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labels"
        description="Stage invoices, generate shipping labels, update status, and track activity."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total labels</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.generated}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Printed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.printed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In transit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{kpis.inTransit}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageSearch className="h-4 w-4" />
              Select invoices
            </CardTitle>
            <CardDescription>Search and select one or more invoices to stage for processing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={invoiceSearch}
                onChange={(event) => setInvoiceSearch(event.target.value)}
                className="pl-9"
                placeholder="Search invoices..."
              />
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border p-2">
              {filteredInvoices.map((invoice) => {
                const checked = selectedInvoiceIds.includes(invoice.invoiceId);
                const staged = stagedInvoiceIds.includes(invoice.invoiceId);
                return (
                  <label
                    key={invoice.invoiceId}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors",
                      checked ? "border-primary bg-primary/5" : "hover:bg-muted/30",
                      staged && "opacity-70"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={staged}
                      onChange={(event) => {
                        setSelectedInvoiceIds((current) =>
                          event.target.checked
                            ? [...current, invoice.invoiceId]
                            : current.filter((id) => id !== invoice.invoiceId)
                        );
                      }}
                      className="size-4 rounded border-input"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatInvoiceDate(invoice.date)} · {invoice.lineItems.length} line items
                        {staged ? " · Staged" : ""}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Button onClick={stageSelectedInvoices} disabled={selectedInvoiceIds.length === 0}>
                <Tags className="h-4 w-4" />
                Stage for processing ({selectedInvoiceIds.length})
              </Button>
              {stagedInvoiceIds.length > 0 ? (
                <Button variant="outline" onClick={clearStaging}>
                  Clear staging
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="h-4 w-4" />
              Processing stage
            </CardTitle>
            <CardDescription>
              Line items from staged invoices. Select items, assign a route, and generate labels.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stagedLineItems.length === 0 ? (
              <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                No invoices staged. Select invoices and click Stage for processing.
              </p>
            ) : (
              <>
                <div className="max-h-56 overflow-x-auto overflow-y-auto rounded-xl border">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                        <th className="px-3 py-2" />
                        <th className="px-3 py-2 font-medium">Invoice</th>
                        <th className="px-3 py-2 font-medium">Description</th>
                        <th className="px-3 py-2 font-medium">Labels</th>
                        <th className="px-3 py-2 font-medium">Qty</th>
                        <th className="min-w-[220px] px-3 py-2 font-medium">Route assignment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagedLineItems.map((item: StagedLineItem) => (
                        <tr key={item.key} className="border-b last:border-0">
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedStagedKeys.includes(item.key)}
                              onChange={(event) => toggleStagedKey(item.key, event.target.checked)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{item.invoiceNumber}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.labelCount}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2">
                            <select
                              className={cn(selectClassName, "min-w-[200px]")}
                              value={stagedRouteAssignments[item.key] ?? ""}
                              onChange={(event) =>
                                setStagedItemRouteAssignment(item.key, event.target.value)
                              }
                            >
                              <option value="">None</option>
                              {routeAssignments.map((assignment) => (
                                <option
                                  key={assignment.routeAssignmentId}
                                  value={assignment.routeAssignmentId}
                                >
                                  {formatRouteAssignmentCopyLabel(assignment)}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="bulkRouteAssignment">Apply route to selected line items</Label>
                    <select
                      id="bulkRouteAssignment"
                      className={selectClassName}
                      value={bulkRouteAssignmentId}
                      onChange={(event) => setBulkRouteAssignmentId(event.target.value)}
                    >
                      <option value="">Select route assignment...</option>
                      {routeAssignments.map((assignment) => (
                        <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                          {formatRouteAssignmentCopyLabel(assignment)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={selectedStagedKeys.length === 0 || !bulkRouteAssignmentId}
                    onClick={applyRouteAssignmentToSelected}
                  >
                    Apply to selected ({selectedStagedKeys.length})
                  </Button>
                </div>

                <Button onClick={generateLabelsForSelected} disabled={selectedStagedKeys.length === 0}>
                  <Barcode className="h-4 w-4" />
                  Generate labels ({selectedStagedKeys.length})
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-4 border-b pb-4">
          <CardTitle>Label directory</CardTitle>

          <TableDirectoryToolbar
            filtersOpen={filtersOpen}
            onFiltersOpenChange={setFiltersOpen}
            activeFilterCount={activeFilterCount}
            columnLayout={columnVisibility}
            search={
              <TableSearchInput
                value={filters.query}
                onChange={(query) => {
                  setFilters((current) => ({ ...current, query }));
                  setPage(1);
                }}
                placeholder="Search labels..."
              />
            }
            filterPanel={
              <TableFilterPanel
                resultSummary={`Showing ${filteredLabels.length} of ${labels.length} labels`}
                onClearAll={
                  hasActiveFilters
                    ? () => {
                        setFilters(defaultFilters);
                        setPage(1);
                      }
                    : undefined
                }
              >
            <TableFilterSection label="Status">
              {statusFilters.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={filters.status === option.value ? "default" : "outline"}
                  onClick={() => {
                    setFilters((current) => ({ ...current, status: option.value }));
                    setPage(1);
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </TableFilterSection>
              </TableFilterPanel>
            }
          />
        </CardHeader>

        {selectedLabelIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b border-primary/15 bg-primary/5 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex min-w-[5.5rem] items-center justify-center rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold tracking-wide text-primary">
                {selectedLabelIds.length} selected
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedLabelIds([])}>
                Clear selection
              </Button>
              <Button size="sm" variant="outline" onClick={openStatusDialog}>
                Change status
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setContainerScope("selected");
                  openContainerDialog();
                }}
              >
                Change container
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const invoiceId = labels.find((label) => label.labelId === selectedLabelIds[0])?.invoiceId;
                  if (invoiceId) {
                    setTargetInvoiceIdForContainer(invoiceId);
                    setContainerScope("invoice");
                    openContainerDialog();
                  }
                }}
              >
                Change container (entire invoice)
              </Button>
              <Button size="sm" onClick={printSelectedLabels}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columnVisibility.columns}
          rows={pageLabels}
          page={currentPage}
          rowKey={(label) => label.labelId}
          rowLabel={(label) => label.barcode}
          columnLayout={columnVisibility}
          minWidth={1200}
          selectable
          selectedIds={selectedLabelIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAllLabels}
          onToggleSelect={toggleSelectLabel}
          emptyState={
            <p className="text-muted-foreground">
              No labels yet. Stage invoices and generate labels from the processing stage.
            </p>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageLabels.length} of {filteredLabels.length} labels
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity log</CardTitle>
          <CardDescription>Label-by-label results for generate, status, container, and print actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {activityLog.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2 text-sm",
                    entry.success ? "bg-emerald-500/5" : "bg-destructive/5"
                  )}
                >
                  {entry.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{formatActivityAction(entry.action)}</span>
                      <span className="text-xs text-muted-foreground">{formatLabelTimestamp(entry.timestamp)}</span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {truncateBarcode(entry.barcode)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      {entry.invoiceNumber} · {entry.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change label status</DialogTitle>
            <DialogDescription>Update status for {selectedLabelIds.length} selected label(s).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newStatus">New status</Label>
            <select
              id="newStatus"
              className={selectClassName}
              value={newStatus}
              onChange={(event) => setNewStatus(event.target.value as LabelStatus)}
            >
              {LABEL_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyStatusChange}>Apply status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change container</DialogTitle>
            <DialogDescription>
              {containerScope === "invoice"
                ? "Update container for all labels on the selected invoice."
                : "Update container for selected labels only."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newContainer">Container</Label>
            <select
              id="newContainer"
              className={selectClassName}
              value={newContainerId}
              onChange={(event) => setNewContainerId(event.target.value)}
            >
              {containers.map((container) => (
                <option key={container.containerId} value={container.containerId}>
                  {container.containerCode} · {container.containerNumber}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContainerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyContainerChange}>Apply container</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
