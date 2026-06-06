"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Receipt, Trash2, Wallet } from "lucide-react";

import { AccountingEntryForm } from "@/components/accounting/accounting-entry-form";
import { AccountingEntryViewSheet } from "@/components/accounting/accounting-entry-view-sheet";
import { AccountingRouteAssignmentSelector } from "@/components/accounting/accounting-route-assignment-selector";
import { ExistingInvoicePaymentsSection } from "@/components/accounting/existing-invoice-payments-section";
import { IncomeExpensesSection } from "@/components/accounting/income-expenses-section";
import { InvoiceDiscountsSection } from "@/components/accounting/invoice-discounts-section";
import { NewInvoicePaymentsSection } from "@/components/accounting/new-invoice-payments-section";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { PageHeader } from "@/components/app-shell/page-header";
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
import {
  computeAccountingKpis,
  formatAccountingMoney,
  getAccountingEntryTypeLabel,
} from "@/lib/accounting/display";
import { cloneAccountingEntries } from "@/lib/accounting/mock-data";
import {
  applyAccountingEntryToInvoice,
  accountingToFormValues,
  findInvoiceByNumber,
  formValuesToAccountingEntry,
  isInvoiceRelatedType,
  type AccountingEntry,
  type AccountingFormValues,
} from "@/lib/accounting/types";
import { cloneInvoices } from "@/lib/invoices/mock-data";
import type { Invoice } from "@/lib/invoices/types";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";

const ACTIVE_ROUTE_ASSIGNMENT_KEY = "emsys-accounting-route-assignment";

export function AccountingWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted, notifySuccess } = useFeedback();
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);
  const [entries, setEntries] = useState<AccountingEntry[]>(() => cloneAccountingEntries());
  const [invoices, setInvoices] = useState<Invoice[]>(() => cloneInvoices());
  const [activeRouteAssignmentId, setActiveRouteAssignmentId] = useState("");
  const [viewEntry, setViewEntry] = useState<AccountingEntry | null>(null);
  const [formMode, setFormMode] = useState<"edit" | null>(null);
  const [editingEntry, setEditingEntry] = useState<AccountingEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountingEntry | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_ROUTE_ASSIGNMENT_KEY);
    if (stored && routeAssignments.some((assignment) => assignment.routeAssignmentId === stored)) {
      setActiveRouteAssignmentId(stored);
    }
  }, [routeAssignments]);

  const canRegister = Boolean(activeRouteAssignmentId);
  const kpis = useMemo(() => computeAccountingKpis(entries), [entries]);

  function handleRouteAssignmentChange(routeAssignmentId: string) {
    setActiveRouteAssignmentId(routeAssignmentId);
    if (routeAssignmentId) {
      localStorage.setItem(ACTIVE_ROUTE_ASSIGNMENT_KEY, routeAssignmentId);
      return;
    }
    localStorage.removeItem(ACTIVE_ROUTE_ASSIGNMENT_KEY);
  }

  function syncInvoiceForEntry(entry: AccountingEntry) {
    if (!isInvoiceRelatedType(entry.type)) return;

    const invoiceId =
      entry.invoiceId ??
      (entry.invoiceNumber
        ? findInvoiceByNumber(invoices, entry.invoiceNumber)?.invoiceId
        : undefined);

    if (!invoiceId) return;

    setInvoices((current) =>
      current.map((invoice) => {
        if (invoice.invoiceId !== invoiceId) return invoice;
        return applyAccountingEntryToInvoice(entry, invoice);
      })
    );
  }

  function addEntry(values: AccountingFormValues): string | null {
    if (!activeRouteAssignmentId) {
      return "Select a route assignment before registering entries.";
    }

    try {
      const nextEntry = formValuesToAccountingEntry(
        { ...values, routeAssignmentId: activeRouteAssignmentId },
        invoices
      );
      setEntries((current) => [nextEntry, ...current]);
      syncInvoiceForEntry(nextEntry);
      notifyAdded("Accounting entry", getAccountingEntryTypeLabel(nextEntry.type));
      if (isInvoiceRelatedType(nextEntry.type)) {
        notifySuccess("Linked invoice updated with this entry.");
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to save entry.";
    }
  }

  function saveEditedEntry(values: AccountingFormValues): string | null {
    if (!editingEntry) return null;

    try {
      const nextEntry = formValuesToAccountingEntry(
        values,
        invoices,
        editingEntry.createdAt,
        editingEntry.createdBy,
        new Date().toISOString()
      );
      setEntries((current) =>
        current.map((entry) => (entry.entryId === editingEntry.entryId ? nextEntry : entry))
      );
      notifyUpdated("Accounting entry", getAccountingEntryTypeLabel(nextEntry.type));
      setFormMode(null);
      setEditingEntry(null);
      setFormError(null);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Unable to save entry.";
    }
  }

  function openEditForm(entry: AccountingEntry) {
    setEditingEntry(entry);
    setFormMode("edit");
    setViewEntry(null);
    setFormError(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setEntries((current) => current.filter((entry) => entry.entryId !== deleteTarget.entryId));
    setDeleteTarget(null);
    setViewEntry(null);
    notifyDeleted("Accounting entry", 1);
  }

  const stats = [
    { label: "Total income", value: formatAccountingMoney(kpis.incomeTotal), description: "Income entries", icon: ArrowUpCircle },
    { label: "Total expenses", value: formatAccountingMoney(kpis.expenseTotal), description: "Expense entries", icon: ArrowDownCircle },
    { label: "Net (income − expenses)", value: formatAccountingMoney(kpis.netTotal), description: "Non-invoice ledger net", icon: Wallet },
    { label: "Invoice payments", value: formatAccountingMoney(kpis.invoicePaymentTotal), description: "Payments registered", icon: Receipt },
  ];

  const sectionProps = {
    entries,
    invoices,
    canRegister,
    onAddEntry: addEntry,
    onRowClick: setViewEntry,
    onEdit: openEditForm,
    onDelete: setDeleteTarget,
  };

  return (
    <div>
      <PageHeader
        title="Accounting"
        description="Select a route assignment, then register payments, discounts, expenses, and income. Each entry appears in its section list immediately."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <AccountingRouteAssignmentSelector
        routeAssignments={routeAssignments}
        value={activeRouteAssignmentId}
        onChange={handleRouteAssignmentChange}
      />

      <NewInvoicePaymentsSection {...sectionProps} />
      <ExistingInvoicePaymentsSection {...sectionProps} />
      <InvoiceDiscountsSection {...sectionProps} />
      <IncomeExpensesSection {...sectionProps} />

      <AccountingEntryViewSheet
        entry={viewEntry}
        open={Boolean(viewEntry)}
        onOpenChange={(open) => {
          if (!open) setViewEntry(null);
        }}
        onEdit={openEditForm}
        onDelete={(entry) => {
          setViewEntry(null);
          setDeleteTarget(entry);
        }}
      />

      <Dialog
        open={formMode === "edit"}
        onOpenChange={(open) => {
          if (!open) {
            setFormMode(null);
            setEditingEntry(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit entry</DialogTitle>
            <DialogDescription>Update this accounting entry.</DialogDescription>
          </DialogHeader>
          {editingEntry ? (
            <AccountingEntryForm
              key={editingEntry.entryId}
              invoices={invoices}
              routeAssignments={routeAssignments}
              initialValues={accountingToFormValues(editingEntry)}
              isEditing
              updatedAt={editingEntry.updatedAt}
              submitLabel="Save changes"
              onSubmit={saveEditedEntry}
              onFormErrorChange={setFormError}
              onCancel={() => {
                setFormMode(null);
                setEditingEntry(null);
                setFormError(null);
              }}
            />
          ) : null}
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Delete entry?</DialogTitle>
            <DialogDescription>
              This will remove this entry from the list. Linked invoice records are not automatically reversed.
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
