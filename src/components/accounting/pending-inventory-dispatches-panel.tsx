"use client";

import { useMemo, useState } from "react";
import { PackageCheck } from "lucide-react";

import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { GuidedEntryFooter, GuidedEntryStepper, GuidedStepHeading, type GuidedTypeStep } from "@/components/accounting/guided-entry-chrome";
import { inventoryPaymentSteps, ReconcileDispatchDialog } from "@/components/accounting/reconcile-dispatch-dialog";
import { FormBody } from "@/components/forms/form-shell";
import { FieldLabelRow } from "@/components/forms/field-label-row";
import { Button } from "@/components/ui/button";
import {
  CompactTableScroll,
  compactTableCellClassName,
  compactTableCellWrapClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
  compactTableRowClassName,
  compactTableShellClassName,
} from "@/components/ui/compact-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInlineSelectOptions, QUICK_SELECT_OPTIONS_LIMIT, SearchableSelect } from "@/components/ui/searchable-select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useTranslation } from "@/lib/i18n";
import { getHolderTypeLabel } from "@/lib/inventory/display";
import { useInventoryHolders } from "@/lib/inventory/hooks/use-inventory";
import { isInventoryHolderType, INVENTORY_CUSTODIAN_HOLDER_TYPES } from "@/lib/inventory/types/holders";
import { PENDING_DISPATCHES_PAGE_SIZE } from "@/lib/inventory/pending-dispatches/api";
import { usePendingDispatches } from "@/lib/inventory/pending-dispatches/hooks";
import type { PendingDispatchFilters, PendingInventoryDispatch } from "@/lib/inventory/pending-dispatches/types";
import { cn } from "@/lib/utils";

const initialFilters: PendingDispatchFilters = { holder: "", from: "", through: "", age: "" };
const ALL_VALUE = "all";
const DATE_FILTERS = ["from", "through"] as const;
const COLUMNS = ["dispatchedAt", "holder", "responsible", "dailyRoute", "items", "dispatched", "awaiting", "outstanding", "age", "actions"] as const;
const VISIBLE_ITEMS = 2;

export function PendingInventoryDispatchesPanel({ presentation = "page", onBusyChange, typeStep }: {
  presentation?: "page" | "inline";
  /** Reports while a reconciliation is saving so a host (e.g. the add-transaction wizard) can lock navigation. */
  onBusyChange?: (busy: boolean) => void;
  /** Inline only: the add-transaction wizard's type step, so the list and reconciliation read as its steps. */
  typeStep?: GuidedTypeStep;
} = {}) {
  const { t } = useTranslation();
  const { companyId, hasPermission } = useAuth();
  const canReconcile = hasPermission(PERMISSIONS.inventoryDispatchesReconcile.name, PERMISSIONS.inventoryDispatchesReconcile.resourceType);
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<{ companyId: string | null; row: PendingInventoryDispatch } | null>(null);
  const selected = selection?.companyId === companyId ? selection.row : null;
  const debounced = useDebouncedValue(filters, 300);
  const activeFilters = useMemo(() => ({ ...debounced, holder: filters.holder }), [debounced, filters.holder]);
  const query = usePendingDispatches(activeFilters, page);
  const holdersQuery = useInventoryHolders();
  const text = (key: string, values?: Record<string, string | number>) => t(`accounting.pendingInventory.${key}`, values);
  const empty = t("common.empty.dash");
  const holderOptions = useMemo(() => [
    { value: ALL_VALUE, label: t("accounting.pendingInventory.allHolders") },
    ...(holdersQuery.data ?? [])
      .filter((holder) => (INVENTORY_CUSTODIAN_HOLDER_TYPES as readonly string[]).includes(holder.type))
      .map((holder) => ({ value: holder.id, label: holder.displayName, description: getHolderTypeLabel(holder.type, t), keywords: [holder.type] })),
  ], [holdersQuery.data, t]);
  function filter(name: keyof PendingDispatchFilters, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  }
  function itemsSummary(row: PendingInventoryDispatch) {
    const pending = row.lines.filter((line) => line.outstandingQuantity > 0);
    const shown = pending.slice(0, VISIBLE_ITEMS).map((line) => `${line.item.name} (${line.outstandingQuantity})`).join(", ");
    return pending.length > VISIBLE_ITEMS ? `${shown} ${text("moreItems", { count: pending.length - VISIBLE_ITEMS })}` : shown;
  }
  const inline = presentation === "inline";
  const reconcileView = selected ? <ReconcileDispatchDialog guided={inline} typeStep={typeStep} key={`${companyId}:${selected.id}`} dispatch={selected} canReconcile={canReconcile} onClose={() => setSelection(null)} onBusyChange={onBusyChange} /> : null;
  if (inline && reconcileView) return reconcileView;
  const list = <div className={inline ? "space-y-4" : "space-y-6"}>
    {/* Flex, not grid: SearchableSelect's full-height wrapper overflows bottom-aligned grid cells. */}
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-0 flex-[2_1_14rem] space-y-2">{(() => {
        const holderInlineLimit = presentation === "inline" ? QUICK_SELECT_OPTIONS_LIMIT : undefined;
        const holderValue = filters.holder || ALL_VALUE;
        const holderInline = getInlineSelectOptions({ inlineOptionsLimit: holderInlineLimit, options: holderOptions, value: holderValue, placeholder: text("selectHolder"), loading: holdersQuery.isLoading }) !== null;
        return <>
          <FieldLabelRow
            showClear={Boolean(filters.holder) && holderInline}
            onClear={() => { filter("holder", ""); window.requestAnimationFrame(() => document.getElementById("pending-inventory-holder")?.focus()); }}
          >
            <Label htmlFor="pending-inventory-holder">{text("holder")}</Label>
          </FieldLabelRow>
          <SearchableSelect inlineOptionsLimit={holderInlineLimit} clearable={false} id="pending-inventory-holder" value={holderValue} onValueChange={(value) => filter("holder", value === ALL_VALUE ? "" : value)} options={holderOptions} loading={holdersQuery.isLoading} placeholder={text("selectHolder")} searchPlaceholder={text("searchHolders")} emptyMessage={text("noHoldersFound")} mobileSheet />
        </>;
      })()}</div>
      {DATE_FILTERS.map((name) => <div key={name} className="min-w-0 flex-[1_1_10rem] space-y-2"><Label htmlFor={`pending-inventory-${name}`}>{text(name)}</Label><Input id={`pending-inventory-${name}`} type="date" value={filters[name]} onChange={(event) => filter(name, event.target.value)} /></div>)}
      <div className="min-w-0 flex-[1_1_10rem] space-y-2"><Label htmlFor="pending-inventory-age">{text("age")}</Label><Input id="pending-inventory-age" type="number" min={0} value={filters.age} onChange={(event) => filter("age", event.target.value)} /></div>
      <Button variant="outline" onClick={() => { setFilters(initialFilters); setPage(1); }}>{text("reset")}</Button>
    </div>
    {query.isError ? <p role="alert" className="text-destructive">{normalizeApiError(query.error).message}</p> : null}
    {query.isPending ? <DirectoryTableLoader icon={PackageCheck} title={text("loading")} description={text("loadingDescription")} columns={COLUMNS.slice(0, -1).map((key) => text(`columns.${key}`))} /> : !query.isError ? <>
      <div className={compactTableShellClassName} aria-busy={query.isFetching}>
        <CompactTableScroll aria-label={text("title")}>
          <table className={compactTableClassName}>
            <thead>
              <tr className={compactTableHeadRowClassName}>
                {COLUMNS.map((key) => (
                  <th scope="col" className={compactTableHeadClassName} key={key}>
                    {text(`columns.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.data?.items.map((row) => (
                <tr key={row.id} className={compactTableRowClassName}>
                  <td className={compactTableCellClassName}>
                    {row.dispatchedAt ? new Date(row.dispatchedAt).toLocaleDateString() : empty}
                  </td>
                  <td className={compactTableCellWrapClassName}>
                    <span className="block">{row.holder.displayName}</span>
                    {isInventoryHolderType(row.holder.type) ? (
                      <span className="text-xs text-muted-foreground">
                        {getHolderTypeLabel(row.holder.type, t)}
                      </span>
                    ) : null}
                  </td>
                  <td className={compactTableCellClassName}>{row.assigneeEmployee?.name || empty}</td>
                  <td className={compactTableCellClassName}>{row.dailyRoute?.name || empty}</td>
                  <td className={cn(compactTableCellWrapClassName, "max-w-64")}>
                    {itemsSummary(row) || empty}
                  </td>
                  <td className={compactTableCellClassName}>{row.dispatchedQuantity}</td>
                  <td className={compactTableCellClassName}>{row.awaitingConfirmationQuantity}</td>
                  <td className={cn(compactTableCellClassName, "font-medium")}>{row.outstandingQuantity}</td>
                  <td className={compactTableCellClassName}>{row.ageDays}</td>
                  <td className={compactTableCellClassName}>
                    <Button variant="outline" onClick={() => setSelection({ companyId, row })}>
                      {text(canReconcile ? "reconcile" : "view")}
                    </Button>
                  </td>
                </tr>
              ))}
              {!query.isFetching && !query.data?.items.length ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-2 py-12 text-center text-muted-foreground">
                    {text("empty")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CompactTableScroll>
      </div>
      {query.isFetching ? <p role="status" className="text-sm text-muted-foreground">{text("loading")}</p> : null}
      <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage((value) => value - 1)}>{text("previous")}</Button><span>{page}</span><Button variant="outline" disabled={page * PENDING_DISPATCHES_PAGE_SIZE >= (query.data?.total ?? 0) || query.isFetching} onClick={() => setPage((value) => value + 1)}>{text("next")}</Button></div>
    </> : null}
    {reconcileView}
  </div>;
  if (!inline) return list;
  const steps = inventoryPaymentSteps(t);
  return <div className="flex min-h-0 flex-1 flex-col">
    <GuidedEntryStepper typeStep={typeStep} labels={steps.map((step) => step.label)} step={1} busy={false} onStepChange={() => undefined} />
    <FormBody workflow>
      <GuidedStepHeading title={steps[0].label} hint={steps[0].hint} focusKey="dispatch" appearance={typeStep?.appearance} />
      {list}
    </FormBody>
    {typeStep ? <GuidedEntryFooter busy={false} onPrevious={typeStep.onBack} onCancel={typeStep.onCancel} appearance={typeStep.appearance} /> : null}
  </div>;
}
