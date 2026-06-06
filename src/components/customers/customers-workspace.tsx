"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerViewSheet } from "@/components/customers/customer-view-sheet";
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
  computeCustomerKpis,
  customerMatchesQuery,
  formatPhoneSummary,
  getClientTypeBadgeClass,
  getClientTypeLabel,
  truncateClientId,
} from "@/lib/customers/display";
import { cloneCustomers } from "@/lib/customers/mock-data";
import {
  CLIENT_TYPES,
  createEmptyCustomerForm,
  customerToFormValues,
  formValuesToCustomer,
  getPrimaryAddress,
  type Customer,
  type CustomerFilterState,
  type CustomerFormValues,
} from "@/lib/customers/types";
import type { DataTableColumn } from "@/lib/table/types";

const PAGE_SIZE = 8;

const defaultFilters: CustomerFilterState = {
  query: "",
  clientType: "all",
};

export function CustomersWorkspace() {
  const { notifyAdded, notifyUpdated, notifyDeleted } = useFeedback();
  const [customers, setCustomers] = useState<Customer[]>(() => cloneCustomers());
  const [filters, setFilters] = useState<CustomerFilterState>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null);
  const [formMode, setFormMode] = useState<"add" | "edit" | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | Customer[] | null>(null);

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (!customerMatchesQuery(customer, filters.query)) return false;
      if (filters.clientType !== "all" && customer.clientType !== filters.clientType) return false;
      return true;
    });
  }, [customers, filters]);

  const kpis = useMemo(() => computeCustomerKpis(customers), [customers]);
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCustomers = filteredCustomers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const allPageSelected =
    pageCustomers.length > 0 && pageCustomers.every((customer) => selectedIds.includes(customer.clientId));

  function toggleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds((current) =>
        Array.from(new Set([...current, ...pageCustomers.map((customer) => customer.clientId)]))
      );
      return;
    }
    setSelectedIds((current) =>
      current.filter((id) => !pageCustomers.some((customer) => customer.clientId === id))
    );
  }

  function toggleSelect(clientId: string, checked: boolean) {
    setSelectedIds((current) => (checked ? [...current, clientId] : current.filter((entry) => entry !== clientId)));
  }

  function openAddForm() {
    setEditingCustomer(null);
    setFormMode("add");
  }

  function openEditForm(customer: Customer) {
    setEditingCustomer(customer);
    setFormMode("edit");
    setViewCustomer(null);
  }

  function saveCustomer(values: CustomerFormValues) {
    if (formMode === "edit" && editingCustomer) {
      const nextCustomer = formValuesToCustomer(
        values,
        editingCustomer.createdAt,
        editingCustomer.createdBy,
        new Date().toISOString()
      );
      setCustomers((current) =>
        current.map((customer) => (customer.clientId === editingCustomer.clientId ? nextCustomer : customer))
      );
      notifyUpdated("Client", nextCustomer.name);
    } else {
      const nextCustomer = formValuesToCustomer(values);
      setCustomers((current) => [nextCustomer, ...current]);
      notifyAdded("Client", nextCustomer.name);
    }

    setFormMode(null);
    setEditingCustomer(null);
    setPage(1);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget)
      ? deleteTarget.map((customer) => customer.clientId)
      : [deleteTarget.clientId];
    setCustomers((current) => current.filter((customer) => !ids.includes(customer.clientId)));
    setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
    setDeleteTarget(null);
    setViewCustomer(null);
    notifyDeleted("Client", ids.length);
  }

  const stats = [
    { label: "Total clients", value: kpis.total.toString(), description: "Senders and receivers", icon: Users },
    { label: "Senders", value: kpis.senders.toString(), description: "Outbound party records", icon: UserPlus },
    { label: "Receivers", value: kpis.receivers.toString(), description: "Delivery party records", icon: UserCheck },
    {
      label: "Missing document ID",
      value: kpis.missingDocument.toString(),
      description: "Clients without document on file",
      icon: Search,
    },
  ];

  const clientTypeFilters: { value: CustomerFilterState["clientType"]; label: string }[] = [
    { value: "all", label: "All" },
    ...CLIENT_TYPES,
  ];

  const tableColumns: DataTableColumn<Customer>[] = [
    {
      id: "clientId",
      label: "Client ID",
      cellClassName: "font-mono text-xs",
      renderCell: (customer) => truncateClientId(customer.clientId),
    },
    {
      id: "name",
      label: "Name",
      renderCell: (customer) => (
        <>
          <div className="font-medium">{customer.name}</div>
          {customer.documentId ? (
            <div className="text-xs text-muted-foreground">{customer.documentId}</div>
          ) : null}
        </>
      ),
    },
    {
      id: "type",
      label: "Type",
      renderCell: (customer) => (
        <Badge className={getClientTypeBadgeClass(customer.clientType)}>
          {getClientTypeLabel(customer.clientType)}
        </Badge>
      ),
    },
    {
      id: "city",
      label: "City",
      renderCell: (customer) => (
        <>
          {getPrimaryAddress(customer)?.city ?? "—"}
          {customer.addresses.length > 1 ? (
            <div className="text-xs text-muted-foreground">+{customer.addresses.length - 1} more</div>
          ) : null}
        </>
      ),
    },
    {
      id: "phones",
      label: "Phone(s)",
      renderCell: (customer) => formatPhoneSummary(customer),
    },
    {
      id: "email",
      label: "Email",
      renderCell: (customer) => customer.email ?? "—",
    },
    {
      id: "createdAt",
      label: "Date created",
      cellClassName: "text-muted-foreground",
      renderCell: (customer) => formatAuditDate(customer.createdAt),
    },
    {
      id: "createdBy",
      label: "User created",
      renderCell: (customer) => customer.createdBy,
    },
    {
      id: "updatedAt",
      label: "Date modified",
      cellClassName: "text-muted-foreground",
      renderCell: (customer) => formatAuditDate(customer.updatedAt),
    },
    {
      id: "actions",
      label: "Actions",
      hideable: false,
      stopRowClick: true,
      renderCell: (customer) => (
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Edit ${customer.name}`}
            onClick={() => openEditForm(customer)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            aria-label={`Delete ${customer.name}`}
            onClick={() => {
              setViewCustomer(null);
              setDeleteTarget(customer);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const columnVisibility = useColumnVisibility("customers", tableColumns);

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Manage sender and receiver clients with contact details and primary addresses."
        actions={
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4" />
            Add client
          </Button>
        }
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

      <Card className="mt-6">
        <CardHeader className="gap-4 border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Client directory</CardTitle>
              <CardDescription>Search by name, client ID, phone, email, or address.</CardDescription>
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
                  placeholder="Search by name, ID, phone, email..."
                />
              </div>
              <ColumnVisibilityMenu columnLayout={columnVisibility} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Client type</span>
            {clientTypeFilters.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={filters.clientType === option.value ? "default" : "outline"}
                onClick={() => {
                  setFilters((current) => ({ ...current, clientType: option.value }));
                  setPage(1);
                }}
              >
                {option.label}
              </Button>
            ))}
            {filters.query || filters.clientType !== "all" ? (
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
                  setDeleteTarget(customers.filter((customer) => selectedIds.includes(customer.clientId)))
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
          rows={pageCustomers}
          rowKey={(customer) => customer.clientId}
          rowLabel={(customer) => customer.name}
          columnLayout={columnVisibility}
          minWidth={1100}
          selectable
          selectedIds={selectedIds}
          allPageSelected={allPageSelected}
          onToggleSelectAll={toggleSelectAll}
          onToggleSelect={toggleSelect}
          onRowClick={setViewCustomer}
          emptyState={
            <>
              <p className="text-muted-foreground">No customers match your search or filters.</p>
              <Button className="mt-4" onClick={openAddForm}>
                <Plus className="h-4 w-4" />
                Add client
              </Button>
            </>
          }
        />

        <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {pageCustomers.length} of {filteredCustomers.length} clients
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

      <CustomerViewSheet
        customer={viewCustomer}
        open={Boolean(viewCustomer)}
        onOpenChange={(open) => {
          if (!open) setViewCustomer(null);
        }}
        onEdit={openEditForm}
        onDelete={(customer) => {
          setViewCustomer(null);
          setDeleteTarget(customer);
        }}
      />

      <Dialog open={formMode !== null} onOpenChange={(open) => !open && setFormMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{formMode === "edit" ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>
              {formMode === "edit"
                ? "Update client details, contact info, and primary address."
                : "Create a new sender or receiver with a generated client ID."}
            </DialogDescription>
          </DialogHeader>
          <CustomerForm
            key={editingCustomer?.clientId ?? "new"}
            initialValues={
              formMode === "edit" && editingCustomer
                ? customerToFormValues(editingCustomer)
                : createEmptyCustomerForm()
            }
            isEditing={formMode === "edit"}
            updatedAt={editingCustomer?.updatedAt}
            submitLabel={formMode === "edit" ? "Save changes" : "Add client"}
            onSubmit={saveCustomer}
            onCancel={() => setFormMode(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>Delete client{Array.isArray(deleteTarget) && deleteTarget.length > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              {Array.isArray(deleteTarget)
                ? `This will permanently remove ${deleteTarget.length} selected clients. This action cannot be undone.`
                : `This will permanently remove ${deleteTarget?.name ?? "this client"}. This action cannot be undone.`}
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
