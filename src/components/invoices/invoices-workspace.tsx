"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InvoiceViewSheet } from "@/components/invoices/invoice-view-sheet";
import { ColumnVisibilityMenu } from "@/components/app-shell/column-visibility-menu";
import { DataTable } from "@/components/app-shell/data-table";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
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
import { formatAuditDate } from "@/lib/audit/display";
import {
  computeInvoiceKpis,
  formatInvoiceDate,
  formatInvoiceLineItemsSummary,
  formatInvoiceMoney,
  formatInvoicePartySummary,
  getContainerLabel,
  getInvoiceBalance,
  getInvoiceSubtotal,
  getPaymentLocationLabel,
  invoiceMatchesQuery,
  truncateInvoiceId,
} from "@/lib/invoices/display";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { cloneInvoices } from "@/lib/invoices/mock-data";
import {
  buildInvoiceCommentActivity,
  buildInvoiceCreatedActivities,
  buildInvoiceUpdateActivities,
  buildPaymentRecordedActivity,
} from "@/lib/invoices/activity";
import {
  INVOICE_PAYMENT_LOCATIONS,
  createEmptyInvoiceForm,
  createInvoiceComment,
  createInvoicePayment,
  computeTotalPayments,
  formValuesToInvoice,
  invoiceToFormValues,
  suggestNextInvoiceNumber,
  type Invoice,
  type InvoiceFilterState,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
  type InvoicePaymentInput,
} from "@/lib/invoices/types";
import type { DataTableColumn } from "@/lib/table/types";
import { getBranchBadgeClass } from "@/lib/trucks/display";

const PAGE_SIZE = 8;

const defaultFilters: InvoiceFilterState = {
  query: "",
  paymentLocation: "all",
};

export function InvoicesWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [invoices, setInvoices] = useState<Invoice[]>(() => cloneInvoices());
  const [filters, setFilters] = useState<InvoiceFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | Invoice[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const suggestedInvoiceNumber = useMemo(() => suggestNextInvoiceNumber(invoices), [invoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      if (!invoiceMatchesQuery(invoice, filters.query)) return false;
      if (filters.paymentLocation !== "all" && invoice.paymentLocation !== filters.paymentLocation) return false;
      return true;
    });
  }, [filters, invoices]);

  const kpis = useMemo(() => computeInvoiceKpis(invoices), [invoices]);
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageInvoices = filteredInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageInvoices.length > 0 && pageInvoices.every((invoice) => selectedIds.includes(invoice.invoiceId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageInvoices.map((invoice) => invoice.invoiceId)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageInvoices.some((invoice) => invoice.invoiceId === id))
    );
  }

  function toggleSelect(invoiceId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, invoiceId] : current.filter((entry) => entry !== invoiceId)));
  }

  function openAddForm() {
    setEditingInvoice(null);
    setFormMode("add");
    setFormError(null);
  }

  function openEditForm(invoice: Invoice) {
    setEditingInvoice(invoice);
    setFormMode("edit");
    setViewInvoice(null);
    setFormError(null);
  }

  function saveInvoice(values: InvoiceFormValues): InvoiceFormSubmitResult {
    try {
      if (formMode === "edit" && editingInvoice) {
        const timestamp = new Date().toISOString();
        const nextInvoiceBase = formValuesToInvoice(
          { ...values, createdBy: editingInvoice.createdBy },
          editingInvoice.createdAt,
          editingInvoice.createdBy,
          timestamp,
          editingInvoice.comments,
          editingInvoice.activity,
          editingInvoice.payments
        );
        const nextInvoice = formValuesToInvoice(
          { ...values, createdBy: editingInvoice.createdBy },
          editingInvoice.createdAt,
          editingInvoice.createdBy,
          timestamp,
          editingInvoice.comments,
          [
            ...editingInvoice.activity,
            ...buildInvoiceUpdateActivities(editingInvoice, nextInvoiceBase, DEFAULT_CREATED_BY),
          ],
          editingInvoice.payments
        );
        setInvoices((current) =>
          current.map((invoice) => (invoice.invoiceId === editingInvoice.invoiceId ? nextInvoice : invoice))
        );
        if (viewInvoice?.invoiceId === nextInvoice.invoiceId) {
          setViewInvoice(nextInvoice);
        }
        notifyUpdated("Invoice", nextInvoice.invoiceNumber);
        setFormMode(null);
        setEditingInvoice(null);
        setFormError(null);
        setPage(1);
        return { error: null };
      }

      const baseInvoice = formValuesToInvoice(values, undefined, undefined, undefined, [], [], []);
      const nextInvoice = formValuesToInvoice(
        values,
        baseInvoice.createdAt,
        baseInvoice.createdBy,
        baseInvoice.updatedAt,
        [],
        buildInvoiceCreatedActivities(baseInvoice),
        []
      );
      const nextList = [nextInvoice, ...invoices];
      setInvoices(nextList);
      notifyAdded("Invoice", nextInvoice.invoiceNumber);
      setFormError(null);
      setPage(1);
      return { error: null, nextInvoiceNumber: suggestNextInvoiceNumber(nextList) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save invoice.";
      setFormError(message);
      return { error: message };
    }
  }

  function addInvoiceComment(invoiceId: string, description: string) {
    const comment = createInvoiceComment(description);
    const timestamp = comment.createdAt;
    const activityEntry = buildInvoiceCommentActivity(
      invoiceId,
      description,
      comment.createdBy,
      timestamp
    );

    setInvoices((current) =>
      current.map((invoice) =>
        invoice.invoiceId === invoiceId
          ? {
              ...invoice,
              comments: [...invoice.comments, comment],
              activity: [...invoice.activity, activityEntry],
              updatedAt: timestamp,
            }
          : invoice
      )
    );

    setViewInvoice((current) =>
      current?.invoiceId === invoiceId
        ? {
            ...current,
            comments: [...current.comments, comment],
            activity: [...current.activity, activityEntry],
            updatedAt: timestamp,
          }
        : current
    );

    notifyAdded("Comment");
  }

  function recordInvoicePayment(invoiceId: string, input: InvoicePaymentInput) {
    const payment = createInvoicePayment(invoiceId, input);

    function appendPayment(invoice: Invoice): Invoice {
      const payments = [...invoice.payments, payment];
      const amountPaid = computeTotalPayments(payments);
      return {
        ...invoice,
        payments,
        amountPaid,
        activity: [...invoice.activity, buildPaymentRecordedActivity(payment, amountPaid)],
        updatedAt: payment.createdAt,
      };
    }

    setInvoices((current) =>
      current.map((invoice) => (invoice.invoiceId === invoiceId ? appendPayment(invoice) : invoice))
    );

    setViewInvoice((current) =>
      current?.invoiceId === invoiceId ? appendPayment(current) : current
    );

    notifyAdded("Payment", formatInvoiceMoney(payment.amount));
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((invoice) => invoice.invoiceId)
      : [deleteTarget.invoiceId];
    setInvoices((current) => current.filter((invoice) => !ids.includes(invoice.invoiceId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewInvoice(null);
    notifyDeleted("Invoice", ids.length);
  }

  const stats = [
    { label: "Total invoices", value: kpis.total.toString(), description: "Invoices on record", icon: FileText },
    {
      label: "Outstanding",
      value: formatInvoiceMoney(kpis.outstanding),
      description: "Total balance left",
      icon: Receipt,
    },
    {
      label: "Collected",
      value: formatInvoiceMoney(kpis.collected),
      description: "Total amount paid",
      icon: DollarSign,
    },
  ];

  const paymentFilters: { value: InvoiceFilterState["paymentLocation"]; label: string }[] = [
    { value: "all", label: "All" },
    ...INVOICE_PAYMENT_LOCATIONS,
  ];

  const tableColumns: DataTableColumn<Invoice>[] = [
    {
      id: "invoiceNumber",
      label: "Invoice number",
      cellClassName: "font-medium",
      renderCell: (invoice) => invoice.invoiceNumber,
    },
    {
      id: "date",
      label: "Date",
      renderCell: (invoice) => formatInvoiceDate(invoice.date),
    },
    {
      id: "container",
      label: "Container",
      renderCell: (invoice) => getContainerLabel(invoice.containerId),
    },
    {
      id: "paymentLocation",
      label: "Paid at",
      renderCell: (invoice) => (
        <Badge className={getBranchBadgeClass(invoice.paymentLocation)}>
          {getPaymentLocationLabel(invoice.paymentLocation)}
        </Badge>
      ),
    },
    {
      id: "sender",
      label: "Sender",
      renderCell: (invoice) => formatInvoicePartySummary(invoice.sender),
    },
    {
      id: "receiver",
      label: "Receiver",
      renderCell: (invoice) => formatInvoicePartySummary(invoice.receiver),
    },
    {
      id: "description",
      label: "Description",
      renderCell: (invoice) => formatInvoiceLineItemsSummary(invoice),
    },
    {
      id: "total",
      label: "Invoice total",
      renderCell: (invoice) => formatInvoiceMoney(getInvoiceSubtotal(invoice)),
    },
    {
      id: "discount",
      label: "Discount",
      renderCell: (invoice) => formatInvoiceMoney(invoice.discount),
    },
    {
      id: "amountPaid",
      label: "Paid",
      renderCell: (invoice) => formatInvoiceMoney(invoice.amountPaid),
    },
    {
      id: "balance",
      label: "Balance",
      renderCell: (invoice) => formatInvoiceMoney(getInvoiceBalance(invoice)),
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (invoice) => formatAuditDate(invoice.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (invoice) => invoice.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (invoice) => formatAuditDate(invoice.updatedAt),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (invoice) => (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Edit invoice ${invoice.invoiceNumber}`}
            onClick={() => openEditForm(invoice)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete invoice ${invoice.invoiceNumber}`}
            onClick={() => {
              setViewInvoice(null);
              setDeleteTarget(invoice);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("invoices", tableColumns);

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create invoices with line items, sender/receiver details, and payment tracking."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add invoice
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <CardDescription className="mt-1">{stat.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Invoice directory</CardTitle>
              <CardDescription>Search by invoice number, container, parties, or line items.</CardDescription>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2 lg:max-w-md lg:justify-end">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filters.query}
                  onChange={(event) => {
                    setFilters((current) => ({ ...current, query: event.target.value }));
                    setPage(1);
                  }}
                  className="pl-9"
                  placeholder="Search invoices..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paid at</span>
            {paymentFilters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filters.paymentLocation === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, paymentLocation: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
            {filters.query || filters.paymentLocation !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFilters(defaultFilters);
                  setPage(1);
                }}
              >
                Clear search & filters
              </Button>
            ) : null}
          </div>
        </CardHeader>

        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-3 border-b bg-muted/30 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{selectedIds.length} selected</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  setDeleteTarget(invoices.filter((invoice) => selectedIds.includes(invoice.invoiceId)))
                }
              >
                <Trash2 className="h-4 w-4" />
                Delete selected
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columnVisibility.columns}
          rows={pageInvoices}
          rowKey={(invoice) => invoice.invoiceId}
          rowLabel={(invoice) => invoice.invoiceNumber}
          columnLayout={columnVisibility}
          minWidth={1500}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewInvoice}
          emptyState={
            <>
              <p className="text-muted-foreground">No invoices match your search or filters.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add invoice
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageInvoices.length} of {filteredInvoices.length} invoices
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

      <InvoiceViewSheet
        invoice={viewInvoice}
        open={Boolean(viewInvoice)}
        onOpenChange={(open) => {
          if (!open) setViewInvoice(null);
        }}
        onEdit={openEditForm}
        onDelete={(invoice) => {
          setViewInvoice(null);
          setDeleteTarget(invoice);
        }}
        onAddComment={addInvoiceComment}
        onRecordPayment={recordInvoicePayment}
      />

      <Dialog
        open={formMode !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit invoice" : "Add invoice"}</DialogTitle>
            <DialogDescription>
              Manage line items, sender/receiver parties, and invoice totals.
            </DialogDescription>
          </DialogHeader>
          <InvoiceForm
            key={editingInvoice?.invoiceId ?? "new"}
            initialValues={
              formMode === "edit" && editingInvoice
                ? invoiceToFormValues(editingInvoice)
                : createEmptyInvoiceForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingInvoice?.updatedAt}
            suggestedInvoiceNumber={formMode === "add" ? suggestedInvoiceNumber : undefined}
            submitLabel={formMode === "edit" ? "Save changes" : "Add invoice"}
            onSubmit={saveInvoice}
            onFormErrorChange={setFormError}
            onCancel={() => {
              setFormMode(null);
              setFormError(null);
            }}
          />
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>
              Delete invoice{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected invoices. This action cannot be undone.`
                : `This will permanently remove invoice ${deleteTarget?.invoiceNumber ?? ""}. This action cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
