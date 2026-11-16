"use client";

import { useMemo, useState } from "react";
import { BarChart3, Plus } from "lucide-react";

import { CatalogDataTable, CatalogTablePagination, CatalogTableToolbar } from "@/components/app-shell/catalog-table-toolbar";
import { PageHeader } from "@/components/app-shell/page-header";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { ComplaintInsightsDialog } from "@/components/complaints/complaint-insights-dialog";
import { ComplaintIntakeDialog } from "@/components/complaints/complaint-intake-dialog";
import {
  ComplaintSeverityBadge,
  ComplaintStatusBadge,
  ComplaintViewSheet,
} from "@/components/complaints/complaint-view-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatAuditDateTime } from "@/lib/audit/display";
import { complaintCategoryLabel, complaintTargetKindLabel } from "@/lib/complaints/display";
import { useComplaintIntake } from "@/lib/complaints/hooks/use-complaint-intake";
import {
  useComplaintAccess,
  useComplaintCategories,
  useComplaintPeople,
  useUnresolvedComplaintCount,
} from "@/lib/complaints/hooks/use-complaints";
import { useComplaintsTable, type ComplaintTableScope } from "@/lib/complaints/hooks/use-complaints-table";
import type { Complaint } from "@/lib/complaints/types";
import { useTranslation } from "@/lib/i18n";
import type { DataTableColumn } from "@/lib/table/types";
import { cn } from "@/lib/utils";
import { formatPhoneDisplayOrDash } from "@/lib/utils/phone";

const SCOPES: ComplaintTableScope[] = ["unresolved", "all"];

export function ComplaintsWorkspace() {
  const { t } = useTranslation();
  const dash = t("common.empty.dash");
  const access = useComplaintAccess();
  const categoriesQuery = useComplaintCategories();
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const people = useComplaintPeople(access.canView);
  const unresolvedCount = useUnresolvedComplaintCount();
  const { table, scope, setScope, rowId } = useComplaintsTable(categories);
  const [viewing, setViewing] = useState<Complaint | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const intake = useComplaintIntake(categories, { onCreated: setViewing });

  const columns = useMemo<DataTableColumn<Complaint>[]>(() => [
    { id: "number", label: t("complaints.fields.number"), cellClassName: "font-mono tabular-nums", renderCell: (item) => item.number || dash },
    { id: "createdAt", label: t("complaints.fields.createdAt"), renderCell: (item) => formatAuditDateTime(item.createdAt) },
    { id: "status", label: t("complaints.fields.status"), renderCell: (item) => <ComplaintStatusBadge status={item.status} /> },
    { id: "severity", label: t("complaints.fields.severity"), renderCell: (item) => <ComplaintSeverityBadge severity={item.severity} /> },
    {
      id: "category",
      label: t("complaints.fields.category"),
      renderCell: (item) => complaintCategoryLabel(t, item.category, categories),
    },
    { id: "subject", label: t("complaints.fields.subject"), cellClassName: "font-medium", truncateCell: true, renderCell: (item) => item.subject || dash },
    { id: "callerName", label: t("complaints.fields.callerName"), sortable: false, renderCell: (item) => item.callerName || dash },
    {
      id: "callerPhone",
      label: t("complaints.fields.callerPhone"),
      cellClassName: "tabular-nums",
      renderCell: (item) => (item.callerPhone ? formatPhoneDisplayOrDash(item.callerPhone) : dash),
    },
    {
      id: "assigneeId",
      label: t("complaints.fields.assignee"),
      sortable: false,
      renderCell: (item) =>
        item.assigneeId
          ? people.userName(item.assigneeId) ?? t("complaints.userFallback", { id: item.assigneeId })
          : t("complaints.unassigned"),
    },
    {
      id: "targets",
      label: t("complaints.fields.targets"),
      sortable: false,
      defaultVisible: false,
      truncateCell: true,
      renderCell: (item) =>
        item.targets
          .map((target) =>
            target.kind === "employee"
              ? people.employeeName(target.employeeId ?? 0) ?? t("complaints.employeeFallback", { id: target.employeeId ?? 0 })
              : `${complaintTargetKindLabel(t, target.kind)}: ${target.label ?? ""}`,
          )
          .join(", ") || dash,
    },
    { id: "description", label: t("complaints.fields.description"), sortable: false, defaultVisible: false, truncateCell: true, renderCell: (item) => item.description || dash },
  ], [categories, dash, people, t]);
  const columnLayout = useColumnVisibility("complaints-directory-v1", columns);

  if (!access.canView) {
    return <p className="text-sm text-muted-foreground">{t("complaints.forbidden")}</p>;
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={t("complaints.title")}
        description={t("complaints.description")}
        actions={
          <>
            <Button variant="outline" onClick={() => setInsightsOpen(true)}>
              <BarChart3 className="size-4" />
              {t("complaints.insights.open")}
            </Button>
            {access.canCreate ? (
              <Button onClick={intake.start}>
                <Plus className="size-4" />
                {t("complaints.add")}
              </Button>
            ) : null}
          </>
        }
      />

      <Card className="mt-6 gap-0">
        <CardHeader className="gap-3 border-b py-4 pb-3">
          <div role="group" aria-label={t("complaints.scopes.label")} className="flex flex-wrap gap-2">
            {SCOPES.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={scope === value ? "default" : "outline"}
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
              >
                {t(`complaints.scopes.${value}`)}
                {value === "unresolved" && unresolvedCount > 0 ? (
                  <span
                    className={cn(
                      "ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      scope === value ? "bg-primary-foreground text-primary" : "bg-red-500 text-white",
                    )}
                  >
                    {unresolvedCount > 99 ? "99+" : unresolvedCount}
                  </span>
                ) : null}
              </Button>
            ))}
          </div>
          <CatalogTableToolbar
            state={table}
            presetScope="complaints"
            searchPlaceholder={t("complaints.searchPlaceholder")}
            columnLayout={columnLayout}
          />
        </CardHeader>

        <CatalogDataTable
          state={table}
          columns={columnLayout.columns}
          columnLayout={columnLayout}
          rowKey={rowId}
          rowLabel={(item) => item.number || item.subject}
          emptyMessage={t(scope === "unresolved" ? "complaints.emptyUnresolved" : "complaints.empty")}
          retryLabel={t("complaints.retry")}
          onRowClick={setViewing}
          activeRowId={viewing?.id}
        />
        <CatalogTablePagination state={table} />
      </Card>

      <ComplaintViewSheet
        complaint={viewing}
        open={Boolean(viewing)}
        onOpenChange={(open) => {
          if (!open) setViewing(null);
        }}
        categories={categories}
        people={people}
      />
      <ComplaintInsightsDialog open={insightsOpen} onOpenChange={setInsightsOpen} categories={categories} people={people} />
      <ComplaintIntakeDialog
        state={intake}
        categories={categories}
        categoriesLoading={categoriesQuery.isLoading}
        canPickEmployees={access.canViewEmployees}
      />
    </div>
  );
}
