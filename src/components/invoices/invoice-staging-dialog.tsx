"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Barcode,
  Container as ContainerIcon,
  ListChecks,
  Printer,
  RefreshCw,
  Route as RouteIcon,
  Tag,
  Trash2,
} from "lucide-react";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { truncateBarcode, getBarcodeStatusLabel } from "@/lib/labels/display";
import {
  useAssignBarcodesToRoute,
  useGenerateLabels,
  useUpdateBarcodes,
} from "@/lib/labels/hooks/use-barcodes";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { useGenerateLabelReport } from "@/lib/reports/hooks/use-reports";
import type { BarcodeUpdate } from "@/lib/labels/api/barcodes-api";
import {
  BARCODE_STATUS_OPTIONS,
  buildStagedLineItems,
  resolveBarcodeStatusRef,
  type GeneratedLabel,
  type StagedLineItem,
} from "@/lib/labels/types";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { cn } from "@/lib/utils";

export type InvoiceStagingWorkflowProps = {
  /** Invoices selected in the table to stage for label processing. */
  invoices: Invoice[];
  presentation?: "dialog" | "page";
  /** Page tab title for step 1; dialog uses the translated staging title by default. */
  title?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
};

type InvoiceStagingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
};

type StagingStep = "line-items" | "labels";

function getStatusBadgeClass(statusName: string): string {
  const normalized = statusName.trim().toUpperCase();
  if (normalized.includes("CANCEL")) return "border-transparent bg-destructive/15 text-destructive";
  if (normalized.includes("DELIVER")) return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (normalized.includes("TRANSIT")) return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
  if (normalized.includes("PRINT")) return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (normalized.includes("CREAT")) return "border-transparent bg-primary/15 text-primary";
  return "border-transparent bg-muted text-muted-foreground";
}

type HeaderSelectCheckboxProps = {
  total: number;
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  label: string;
};

/** Header checkbox that toggles select-all / deselect-all with an indeterminate state. */
function HeaderSelectCheckbox({
  total,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  label,
}: HeaderSelectCheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  const allSelected = total > 0 && selectedCount === total;
  const someSelected = selectedCount > 0 && selectedCount < total;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={allSelected}
      disabled={total === 0}
      onChange={(event) => (event.target.checked ? onSelectAll() : onDeselectAll())}
      className="size-4 rounded border-input"
    />
  );
}

type SelectionToolbarProps = {
  selectedCount: number;
  total: number;
  allKeys: string[];
  selectedKeys: string[];
  onSelectAllOthers: () => void;
  onRemoveAll: () => void;
  children?: ReactNode;
};

function SelectionToolbar({
  selectedCount,
  total,
  allKeys,
  selectedKeys,
  onSelectAllOthers,
  onRemoveAll,
  children,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  const othersAvailable = canSelectAllOthers(allKeys, selectedKeys);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted/20 px-3 py-2">
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
        {t("common.table.selected", { count: selectedCount, total })}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          disabled={!othersAvailable}
          onClick={onSelectAllOthers}
        >
          <ListChecks className="h-4 w-4" />
          {t("common.table.selectAllOthers")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={selectedCount === 0}
          onClick={onRemoveAll}
        >
          <Trash2 className="h-4 w-4" />
          {t("labels.staging.remove")}
        </Button>
        {children ? (
          <>
            <span className="mx-0.5 hidden h-5 w-px bg-border sm:block" aria-hidden />
            {children}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function InvoiceStagingWorkflow({
  invoices,
  presentation = "dialog",
  title,
  open = true,
  onOpenChange,
  onClose,
}: InvoiceStagingWorkflowProps) {
  const { t } = useTranslation();
  const { notifyError, notifySuccess, notifyUpdated } = useFeedback();
  const barcodeStatusOptions = useBarcodeStatusOptions();
  const isDialog = presentation === "dialog";
  const isActive = isDialog ? open : true;

  function handleClose() {
    if (isDialog) {
      onOpenChange?.(false);
      return;
    }
    onClose?.();
  }
  const { data: containersData } = useContainerPicker(200, { enabled: isActive });
  const containers = containersData?.items ?? [];
  const generateLabelsMutation = useGenerateLabels();
  const updateBarcodesMutation = useUpdateBarcodes();
  const assignRouteMutation = useAssignBarcodesToRoute();
  const generateLabelReportMutation = useGenerateLabelReport();

  const [step, setStep] = useState<StagingStep>("line-items");

  const [lineItems, setLineItems] = useState<StagedLineItem[]>([]);
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);

  const [generatedLabels, setGeneratedLabels] = useState<GeneratedLabel[]>([]);
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [labelQuery, setLabelQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>(BARCODE_STATUS_OPTIONS[1].name);
  const [newContainerId, setNewContainerId] = useState("");
  const [newRouteId, setNewRouteId] = useState("");

  const { data: routesData, isLoading: routesLoading } = useActiveRoutePicker("delivery", 200, {
    enabled: routeDialogOpen,
  });
  const routes = routesData?.items ?? [];
  const routeOptions = useMemo(
    () => buildActiveRouteAssignmentOptions(routes, t),
    [routes, t],
  );

  const isGenerating = generateLabelsMutation.isPending;
  const isUpdating = updateBarcodesMutation.isPending;
  const isAssigningRoute = assignRouteMutation.isPending;
  const isPrinting = generateLabelReportMutation.isPending;

  // Keep the latest invoices without making them a reset trigger: generating
  // labels invalidates the invoices query, which would otherwise change the
  // `invoices` prop reference and bounce the user back to step 1.
  const invoicesRef = useRef(invoices);
  invoicesRef.current = invoices;

  const invoiceKey = useMemo(
    () => invoices.map((invoice) => invoice.invoiceId).sort().join(","),
    [invoices],
  );

  // Reset the whole flow when the dialog opens or the staged invoice set changes.
  useEffect(() => {
    if (!isActive) return;
    const current = invoicesRef.current;
    setStep("line-items");
    setLineItems(
      buildStagedLineItems(
        current.map((invoice) => invoice.invoiceId),
        current,
      ),
    );
    setSelectedItemKeys([]);
    setGeneratedLabels([]);
    setSelectedLabelKeys([]);
    setLabelQuery("");
    setStatusFilter("all");
  }, [invoiceKey, isActive]);

  const itemKeys = useMemo(() => lineItems.map((item) => item.key), [lineItems]);

  const statusOptions = useMemo(() => {
    const names = new Set(generatedLabels.map((label) => label.statusName).filter(Boolean));
    return ["all", ...Array.from(names)];
  }, [generatedLabels]);

  const filteredLabels = useMemo(() => {
    const normalized = labelQuery.trim().toLowerCase();
    return generatedLabels.filter((label) => {
      if (statusFilter !== "all" && label.statusName !== statusFilter) return false;
      if (!normalized) return true;
      return [
        label.invoiceNumber,
        label.number,
        label.statusName,
        label.containerName,
        label.description,
        `${label.labelSequence}/${label.totalLabels}`,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [generatedLabels, labelQuery, statusFilter]);

  const filteredLabelKeys = useMemo(() => filteredLabels.map((label) => label.key), [filteredLabels]);

  function toggleItem(key: string, checked: boolean) {
    setSelectedItemKeys((current) =>
      checked ? [...current, key] : current.filter((entry) => entry !== key),
    );
  }

  function removeSelectedLineItems() {
    setLineItems((current) => current.filter((item) => !selectedItemKeys.includes(item.key)));
    setSelectedItemKeys([]);
  }

  async function generateLabels() {
    const targets = lineItems
      .filter((item) => selectedItemKeys.includes(item.key))
      .map((item) => ({ invoiceId: item.invoiceId, lineItemId: item.lineItemId }));
    if (targets.length === 0) return;

    try {
      const labels = await generateLabelsMutation.mutateAsync(targets);

      if (labels.length === 0) {
        notifyError(t("labels.staging.errors.noneGenerated"));
        return;
      }

      const createdCount = labels.filter((label) => label.source === "created").length;
      const existingCount = labels.length - createdCount;

      setGeneratedLabels(labels);
      setSelectedLabelKeys([]);
      setStatusFilter("all");
      setLabelQuery("");
      setStep("labels");

      const parts = [
        createdCount > 0 ? t("labels.staging.success.createdCount", { count: createdCount }) : null,
        existingCount > 0 ? t("labels.staging.success.retrievedCount", { count: existingCount }) : null,
      ].filter(Boolean);
      notifySuccess(t("labels.staging.success.ready", { details: parts.join(", ") }));
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  function toggleLabel(key: string, checked: boolean) {
    setSelectedLabelKeys((current) =>
      checked ? [...current, key] : current.filter((entry) => entry !== key),
    );
  }

  function removeLabelFromView(key: string) {
    setGeneratedLabels((current) => current.filter((label) => label.key !== key));
    setSelectedLabelKeys((current) => current.filter((entry) => entry !== key));
  }

  function removeSelectedLabelsFromView() {
    setGeneratedLabels((current) => current.filter((label) => !selectedLabelKeys.includes(label.key)));
    setSelectedLabelKeys([]);
  }

  function openStatusDialog() {
    if (selectedLabelKeys.length === 0) return;
    setStatusDialogOpen(true);
  }

  async function applyStatusChange() {
    const option = BARCODE_STATUS_OPTIONS.find((entry) => entry.name === newStatus);
    if (!option) return;

    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    const updates: BarcodeUpdate[] = selected
      .filter((label) => label.number.trim().length > 0)
      .map((label) => ({
        id: label.barcodeId,
        invoiceId: label.invoiceId,
        writeTarget: label.writeTarget,
        payload: {
          number: label.number,
          status: { id: option.id, name: option.name },
          ...(label.containerId != null
            ? { container: { id: label.containerId, name: label.containerName } }
            : {}),
        },
      }));

    if (updates.length === 0) {
      notifyError(t("labels.staging.errors.missingBarcodeNumbers"));
      return;
    }

    try {
      if (updates.length > 0) {
        await updateBarcodesMutation.mutateAsync(updates);
      }
      setGeneratedLabels((current) =>
        current.map((label) =>
          selectedLabelKeys.includes(label.key)
            ? { ...label, statusId: option.id, statusName: option.name }
            : label,
        ),
      );
      notifyUpdated(
        t("labels.staging.entities.labelStatus"),
        t("labels.staging.entities.labelCount", { count: selected.length }),
      );
      setStatusDialogOpen(false);
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  function openContainerDialog() {
    if (selectedLabelKeys.length === 0) return;
    setNewContainerId(containers[0] ? String(containers[0].id) : "");
    setContainerDialogOpen(true);
  }

  function openRouteDialog() {
    if (selectedLabelKeys.length === 0) return;
    setNewRouteId("");
    setRouteDialogOpen(true);
  }

  async function applyRouteAssignment() {
    const route = routes.find((entry) => entry.id === newRouteId);
    if (!route) return;

    const barcodeIds = Array.from(
      new Set(
        generatedLabels
          .filter((label) => selectedLabelKeys.includes(label.key))
          .map((label) => label.barcodeId)
          .filter((id) => id > 0),
      ),
    );

    if (barcodeIds.length === 0) {
      notifyError(t("labels.staging.errors.missingBarcodesForRoute"));
      return;
    }

    try {
      const result = await assignRouteMutation.mutateAsync({
        routeId: newRouteId,
        barcodeIds,
      });
      const routeName = result.routeName || route.name || t("labels.staging.routeDialog.route").toLowerCase();
      notifySuccess(
        t("labels.staging.success.assignedToRoute", {
          count: result.assignedCount,
          route: routeName,
          trip: result.tripNumber,
        }),
      );
      setRouteDialogOpen(false);
      setNewRouteId("");
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  async function applyContainerChange() {
    const container = containers.find((entry) => String(entry.id) === newContainerId);
    if (!container) return;

    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    const updates: BarcodeUpdate[] = selected
      .filter((label) => label.number.trim().length > 0)
      .map((label) => ({
        id: label.barcodeId,
        invoiceId: label.invoiceId,
        writeTarget: label.writeTarget,
        payload: {
          number: label.number,
          status: resolveBarcodeStatusRef(label.statusId, label.statusName),
          container: { id: container.id, name: container.name },
        },
      }));

    const containerLabel = formatContainerLabel(container);

    if (updates.length === 0) {
      notifyError(t("labels.staging.errors.missingBarcodeNumbers"));
      return;
    }

    try {
      if (updates.length > 0) {
        await updateBarcodesMutation.mutateAsync(updates);
      }
      setGeneratedLabels((current) =>
        current.map((label) =>
          selectedLabelKeys.includes(label.key)
            ? { ...label, containerId: container.id, containerName: containerLabel }
            : label,
        ),
      );
      notifyUpdated(
        t("labels.staging.entities.labelContainer"),
        t("labels.staging.entities.labelCount", { count: selected.length }),
      );
      setContainerDialogOpen(false);
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  async function printSelectedLabels() {
    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    if (selected.length === 0) return;

    const barcodeNumbers = Array.from(
      new Set(
        selected
          .map((label) => label.number.trim())
          .filter((number) => number.length > 0),
      ),
    );

    if (barcodeNumbers.length === 0) {
      notifyError(t("labels.staging.errors.missingBarcodeNumbersPrint"));
      return;
    }

    try {
      const { url } = await generateLabelReportMutation.mutateAsync({
        type: "label",
        collection: "barcodes",
        values: barcodeNumbers,
        lookupField: "number",
        expiresInHours: 24,
      });
      window.open(url, "_blank", "noopener,noreferrer");
      notifySuccess(t("labels.staging.success.readyToPrint", { count: barcodeNumbers.length }));
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  const stagingTitle = title ?? t("invoices.staging.title");
  const stagingDescription =
    step === "line-items"
      ? t("labels.staging.lineItemsDescription")
      : t("labels.staging.labelsDescription");

  const stagingHeaderTitle =
    step === "line-items" ? (
      <>
        <Tag className="h-4 w-4" />
        {stagingTitle}
      </>
    ) : (
      <>
        <Barcode className="h-4 w-4" />
        {t("labels.staging.title")}
      </>
    );

  const footerActions =
    step === "line-items" ? (
      <>
        <Button variant="outline" onClick={handleClose}>
          {t("common.actions.cancel")}
        </Button>
        <Button onClick={generateLabels} disabled={selectedItemKeys.length === 0 || isGenerating}>
          <Barcode className="h-4 w-4" />
          {isGenerating
            ? t("labels.staging.working")
            : t("labels.staging.manageLabels", { count: selectedItemKeys.length })}
        </Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={() => setStep("line-items")}>
          {t("labels.staging.backToLineItems")}
        </Button>
        <Button onClick={handleClose}>{t("labels.staging.done")}</Button>
      </>
    );

  const workflowPanels =
    step === "line-items" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
            <SelectionToolbar
              selectedCount={selectedItemKeys.length}
              total={lineItems.length}
              allKeys={itemKeys}
              selectedKeys={selectedItemKeys}
              onSelectAllOthers={() =>
                setSelectedItemKeys(selectAllOthers(itemKeys, selectedItemKeys))
              }
              onRemoveAll={removeSelectedLineItems}
            />

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-10 px-3 py-2">
                      <HeaderSelectCheckbox
                        total={lineItems.length}
                        selectedCount={selectedItemKeys.length}
                        onSelectAll={() => setSelectedItemKeys(itemKeys)}
                        onDeselectAll={() => setSelectedItemKeys([])}
                        label={t("labels.staging.selectAllLineItems")}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.invoice")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.description")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.labels")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.quantity")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                        {t("labels.staging.noLineItems")}
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item) => {
                      const checked = selectedItemKeys.includes(item.key);
                      return (
                        <tr
                          key={item.key}
                          onClick={() => toggleItem(item.key, !checked)}
                          className={cn(
                            "cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/25",
                            checked && "bg-primary/[0.06]",
                          )}
                        >
                          <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label={t("labels.staging.selectLineItem", {
                                invoice: item.invoiceNumber,
                                description: item.description,
                              })}
                              checked={checked}
                              onChange={(event) => toggleItem(item.key, event.target.checked)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{item.invoiceNumber}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.labelCount}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/10 px-3 py-2">
              <Input
                value={labelQuery}
                onChange={(event) => setLabelQuery(event.target.value)}
                placeholder={t("labels.staging.filterPlaceholder")}
                className="h-8 max-w-xs"
              />
              <SearchableSelect
                aria-label={t("labels.staging.filterByStatus")}
                className="h-8 w-40"
                value={statusFilter}
                onValueChange={setStatusFilter}
                searchPlaceholder={t("labels.updater.search.statuses")}
                options={statusOptions.map((option) => ({
                  value: option,
                  label:
                    option === "all"
                      ? t("labels.staging.allStatuses")
                      : getBarcodeStatusLabel(option, t),
                }))}
              />
            </div>

            <SelectionToolbar
              selectedCount={selectedLabelKeys.length}
              total={filteredLabels.length}
              allKeys={filteredLabelKeys}
              selectedKeys={selectedLabelKeys}
              onSelectAllOthers={() =>
                setSelectedLabelKeys(selectAllOthers(filteredLabelKeys, selectedLabelKeys))
              }
              onRemoveAll={removeSelectedLabelsFromView}
            >
              <Button
                size="sm"
                variant="outline"
                disabled={selectedLabelKeys.length === 0}
                onClick={openStatusDialog}
              >
                <RefreshCw className="h-4 w-4" />
                {t("labels.staging.changeStatus")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedLabelKeys.length === 0}
                onClick={openContainerDialog}
              >
                <ContainerIcon className="h-4 w-4" />
                {t("labels.staging.transferContainer")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedLabelKeys.length === 0 || isAssigningRoute}
                onClick={openRouteDialog}
              >
                <RouteIcon className="h-4 w-4" />
                {t("labels.staging.assignRoute")}
              </Button>
              <Button
                size="sm"
                disabled={selectedLabelKeys.length === 0 || isPrinting}
                onClick={printSelectedLabels}
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? t("labels.staging.preparing") : t("labels.staging.print")}
              </Button>
            </SelectionToolbar>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-10 px-3 py-2">
                      <HeaderSelectCheckbox
                        total={filteredLabels.length}
                        selectedCount={
                          filteredLabelKeys.filter((key) => selectedLabelKeys.includes(key)).length
                        }
                        onSelectAll={() =>
                          setSelectedLabelKeys((current) =>
                            Array.from(new Set([...current, ...filteredLabelKeys])),
                          )
                        }
                        onDeselectAll={() =>
                          setSelectedLabelKeys((current) =>
                            current.filter((key) => !filteredLabelKeys.includes(key)),
                          )
                        }
                        label={t("labels.staging.selectAllLabels")}
                      />
                    </th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.invoice")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.barcode")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.status")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.labels")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.container")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.staging.columns.description")}</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredLabels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                        {t("labels.staging.noLabelsMatch")}
                      </td>
                    </tr>
                  ) : (
                    filteredLabels.map((label) => {
                      const checked = selectedLabelKeys.includes(label.key);
                      return (
                        <tr
                          key={label.key}
                          className={cn(
                            "border-b transition-colors last:border-0 hover:bg-muted/25",
                            checked && "bg-primary/[0.06]",
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              aria-label={t("labels.staging.selectLabel", { number: label.number })}
                              checked={checked}
                              onChange={(event) => toggleLabel(label.key, event.target.checked)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{label.invoiceNumber}</td>
                          <td className="px-3 py-2 font-mono text-xs">{truncateBarcode(label.number)}</td>
                          <td className="px-3 py-2">
                            <TableTagText className={getStatusBadgeClass(label.statusName)}>
                              {getBarcodeStatusLabel(label.statusName, t)}
                            </TableTagText>
                          </td>
                          <td className="px-3 py-2">
                            {label.labelSequence} / {label.totalLabels}
                          </td>
                          <td className="px-3 py-2">{label.containerName}</td>
                          <td className="px-3 py-2">{label.description}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              aria-label={t("labels.staging.removeFromView")}
                              onClick={() => removeLabelFromView(label.key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

  const auxiliaryDialogs = (
    <>
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>{t("labels.staging.statusDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("labels.staging.statusDialog.description", { count: selectedLabelKeys.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staging-new-status">{t("labels.staging.statusDialog.newStatus")}</Label>
            <SearchableSelect
              id="staging-new-status"
              value={newStatus}
              onValueChange={setNewStatus}
              searchPlaceholder={t("labels.updater.search.statuses")}
              contentClassName="z-[80]"
              options={barcodeStatusOptions.map((option) => ({
                value: option.name,
                label: option.label,
              }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isUpdating}>
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={applyStatusChange} disabled={isUpdating}>
              {isUpdating ? t("labels.staging.statusDialog.applying") : t("labels.staging.statusDialog.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>{t("labels.staging.containerDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("labels.staging.containerDialog.description", { count: selectedLabelKeys.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staging-new-container">{t("labels.staging.containerDialog.container")}</Label>
            <SearchableSelect
              id="staging-new-container"
              value={newContainerId}
              onValueChange={setNewContainerId}
              searchPlaceholder={t("labels.updater.search.containers")}
              contentClassName="z-[80]"
              options={containers.map((container) => ({
                value: String(container.id),
                label: formatContainerLabel(container),
              }))}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setContainerDialogOpen(false)}
              disabled={isUpdating}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={applyContainerChange} disabled={!newContainerId || isUpdating}>
              {isUpdating
                ? t("labels.staging.containerDialog.applying")
                : t("labels.staging.containerDialog.apply")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
        <DialogContent
          className="z-[70]"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{t("labels.staging.routeDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("labels.staging.routeDialog.description", { count: selectedLabelKeys.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staging-new-route">{t("labels.staging.routeDialog.route")}</Label>
            <SearchableSelect
              id="staging-new-route"
              value={newRouteId}
              onValueChange={setNewRouteId}
              placeholder={t("labels.staging.routeDialog.selectRoute")}
              searchPlaceholder={t("labels.updater.search.routes")}
              contentClassName="z-[80]"
              loading={routesLoading}
              emptyMessage={
                routesLoading
                  ? t("labels.staging.routeDialog.loadingRoutes")
                  : t("labels.staging.routeDialog.noRoutes")
              }
              options={routeOptions}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRouteDialogOpen(false)}
              disabled={isAssigningRoute}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button onClick={applyRouteAssignment} disabled={!newRouteId || isAssigningRoute}>
              <RouteIcon className="h-4 w-4" />
              {isAssigningRoute
                ? t("labels.staging.routeDialog.assigning")
                : t("labels.staging.routeDialog.assign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (!isDialog) {
    return (
      <>
        <div className="flex min-h-[calc(100dvh-10rem)] flex-col gap-4">
          <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("invoices.staging.tableAction")}
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                {stagingHeaderTitle}
              </h1>
              <p className="text-sm text-muted-foreground">{stagingDescription}</p>
            </div>
            <Button variant="outline" onClick={handleClose}>
              <ArrowLeft className="h-4 w-4" />
              {t("labels.staging.backToInvoices")}
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4">{workflowPanels}</div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            {footerActions}
          </div>
        </div>
        {auxiliaryDialogs}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] w-full max-w-5xl flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{stagingHeaderTitle}</DialogTitle>
            <DialogDescription>{stagingDescription}</DialogDescription>
          </DialogHeader>

          {workflowPanels}

          <DialogFooter className="sm:justify-between">{footerActions}</DialogFooter>
        </DialogContent>
      </Dialog>
      {auxiliaryDialogs}
    </>
  );
}

export function InvoiceStagingDialog({ open, onOpenChange, invoices }: InvoiceStagingDialogProps) {
  return (
    <InvoiceStagingWorkflow
      presentation="dialog"
      open={open}
      onOpenChange={onOpenChange}
      invoices={invoices}
    />
  );
}
