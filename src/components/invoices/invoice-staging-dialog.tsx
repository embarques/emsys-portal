"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  X,
} from "lucide-react";

import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
import { TableSelectionActionDivider } from "@/components/app-shell/table-selection-action-group";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { AssignBarcodeRouteDialog } from "@/components/invoices/assign-barcode-route-dialog";
import {
  LabelChangeOutputTable,
  type LabelChangeOutputRow,
} from "@/components/invoices/label-change-output-table";
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
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { normalizeApiError } from "@/lib/api/axios";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { fetchInvoiceById } from "@/lib/invoices/api/invoices-api";
import { truncateBarcode, getBarcodeStatusLabel } from "@/lib/labels/display";
import {
  useGenerateLabels,
  useUpdateBarcodes,
} from "@/lib/labels/hooks/use-barcodes";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { useGenerateLabelReport } from "@/lib/reports/hooks/use-reports";
import { buildSelectedLabelReportRequest } from "@/lib/labels/print-label-report";
import type { BarcodeUpdate } from "@/lib/labels/api/barcodes-api";
import {
  FALLBACK_BARCODE_STATUS_OPTIONS,
  buildStagedLineItems,
  resolveBarcodeStatusRef,
  type GeneratedLabel,
  type StagedLineItem,
} from "@/lib/labels/types";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-keys";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
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

function areSameKeySet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right);
  return left.every((key) => rightKeys.has(key));
}

type RemoveConfirmTarget = {
  kind: "line-items" | "labels" | "label";
  keys: string[];
};

function isAbortError(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const code = "code" in error ? String(error.code) : "";
  return name === "AbortError" || name === "CanceledError" || code === "ERR_CANCELED";
}

function getStatusBadgeClass(statusName: string): string {
  const normalized = statusName.trim().toUpperCase();
  if (normalized.includes("SUBAST") || normalized.includes("CANCEL")) {
    return "border-transparent bg-destructive/15 text-destructive";
  }
  if (normalized.includes("ENTREG") || normalized.includes("DELIVER")) {
    return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  if (normalized.includes("TRANSITO") || normalized.includes("TRANSIT")) {
    return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
  }
  if (normalized.startsWith("DEV-") || normalized.includes("PRINT")) {
    return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
  if (normalized.startsWith("ALM-") || normalized.includes("CREAT")) {
    return "border-transparent bg-primary/15 text-primary";
  }
  if (normalized.includes("CONDUCE")) {
    return "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }
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
  selectedKeys: string[];
  allKeys: string[];
  total?: number;
  onSelectedKeysChange: (keys: string[]) => void;
  onRemoveAll: () => void;
  children?: ReactNode;
};

/**
 * Nested-table selection bar aligned with `TableSelectionToolbar`:
 * left island manages the selection, right side operates on selected rows
 * with the destructive action last.
 */
function SelectionToolbar({
  selectedKeys,
  allKeys,
  total,
  onSelectedKeysChange,
  onRemoveAll,
  children,
}: SelectionToolbarProps) {
  const { t } = useTranslation();
  const selectedCount = selectedKeys.length;

  if (selectedCount === 0) return null;

  const totalCount = total ?? allKeys.length;
  const othersAvailable = canSelectAllOthers(allKeys, selectedKeys);

  return (
    <div
      role="toolbar"
      aria-label={`${selectedCount} selected`}
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-primary/[0.06] px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-primary/[0.05]"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.table.clearSelection")}
          title={t("common.table.clearSelection")}
          onClick={() => onSelectedKeysChange([])}
        >
          <X className="h-4 w-4" />
        </Button>
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
          {t("common.table.selected", { count: selectedCount, total: totalCount })}
        </span>
        <span className="mx-1 h-5 w-px bg-primary/20" aria-hidden />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          disabled={!othersAvailable}
          onClick={() => onSelectedKeysChange(selectAllOthers(allKeys, selectedKeys))}
        >
          <ListChecks className="h-4 w-4" />
          <span className="whitespace-nowrap">{t("common.table.selectAllOthers")}</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {children}
        {children ? <TableSelectionActionDivider /> : null}
        <Button
          variant="outline"
          size="sm"
          className={cn("whitespace-nowrap", tableSelectionActionStyles.delete)}
          onClick={onRemoveAll}
        >
          <Trash2 className="h-4 w-4" />
          {t("labels.staging.remove")}
        </Button>
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
  const queryClient = useQueryClient();
  const { email, displayName } = useAuth();
  const performedBy = displayName?.trim() || email?.trim() || undefined;
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
  const generateLabelReportMutation = useGenerateLabelReport();
  const generateAbortRef = useRef<AbortController | null>(null);
  const [generateCancelled, setGenerateCancelled] = useState(false);

  const [step, setStep] = useState<StagingStep>("line-items");

  const [lineItems, setLineItems] = useState<StagedLineItem[]>([]);
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);

  const [generatedLabels, setGeneratedLabels] = useState<GeneratedLabel[]>([]);
  const [generatedForItemKeys, setGeneratedForItemKeys] = useState<string[]>([]);
  const [selectedLabelKeys, setSelectedLabelKeys] = useState<string[]>([]);
  const [labelQuery, setLabelQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [containerDialogOpen, setContainerDialogOpen] = useState(false);
  const [routeDialogOpen, setRouteDialogOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<RemoveConfirmTarget | null>(null);
  const [newStatus, setNewStatus] = useState<string>(
    FALLBACK_BARCODE_STATUS_OPTIONS[0]?.name ?? "ALM-NY",
  );
  const [newContainerId, setNewContainerId] = useState("");
  const [changeResults, setChangeResults] = useState<LabelChangeOutputRow[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isGenerating = generateLabelsMutation.isPending && !generateCancelled;
  const isUpdating = updateBarcodesMutation.isPending;
  const isPrinting = generateLabelReportMutation.isPending;

  useEffect(() => {
    if (barcodeStatusOptions.some((entry) => entry.name === newStatus)) return;
    setNewStatus(
      barcodeStatusOptions[0]?.name ??
        FALLBACK_BARCODE_STATUS_OPTIONS[0]?.name ??
        "ALM-NY",
    );
  }, [barcodeStatusOptions, newStatus]);

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
    if (!isActive) {
      generateAbortRef.current?.abort();
      generateAbortRef.current = null;
      return;
    }
    const current = invoicesRef.current;
    setStep("line-items");
    setLineItems(
      buildStagedLineItems(
        current.map((invoice) => invoice.invoiceId),
        current,
      ),
    );
    setSelectedItemKeys([]);
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setGenerateCancelled(false);
    setGeneratedLabels([]);
    setGeneratedForItemKeys([]);
    setSelectedLabelKeys([]);
    setLabelQuery("");
    setStatusFilter("all");
    setRouteDialogOpen(false);
    setRemoveConfirm(null);
    setChangeResults([]);
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

  const selectedLabels = useMemo(
    () => generatedLabels.filter((label) => selectedLabelKeys.includes(label.key)),
    [generatedLabels, selectedLabelKeys],
  );
  const assignBarcodes = useMemo(
    () =>
      selectedLabels
        .filter((label) => label.number.trim().length > 0)
        .map((label) => ({
          number: label.number,
          barcodeId: label.barcodeId,
          catalogId: label.catalogId,
          packageSequence: label.packageSequence,
          invoiceId: label.invoiceId,
          currentRouteName: label.routeName,
        })),
    [selectedLabels],
  );

  function recordChangeOutputs(
    rows: Omit<LabelChangeOutputRow, "id" | "occurredAt" | "createdBy">[],
  ) {
    if (rows.length === 0) return;
    const occurredAt = new Date().toISOString();
    setChangeResults((current) => [
      ...rows.map((row) => ({
        ...row,
        id: crypto.randomUUID(),
        occurredAt,
        createdBy: performedBy,
      })),
      ...current,
    ]);
  }

  function cancelGenerateLabels() {
    generateAbortRef.current?.abort();
    generateAbortRef.current = null;
    setGenerateCancelled(true);
  }

  /**
   * Reload invoice + barcode data from the API so edits made outside Label
   * manager (invoice form, scanner, Barcode Manager, etc.) show up here.
   */
  async function refreshStagingData() {
    if (isRefreshing || isGenerating || isUpdating) return;

    const invoiceIds = invoicesRef.current.map((invoice) => invoice.invoiceId).filter(Boolean);
    if (invoiceIds.length === 0) return;

    const refreshLabels =
      step === "labels" && generatedForItemKeys.length > 0 ? [...generatedForItemKeys] : [];
    const previousSelectedItemKeys = selectedItemKeys;
    const previousSelectedLabelKeys = selectedLabelKeys;

    setIsRefreshing(true);
    cancelGenerateLabels();

    try {
      const freshInvoices = await Promise.all(invoiceIds.map((id) => fetchInvoiceById(id)));
      invoicesRef.current = freshInvoices;

      for (const invoice of freshInvoices) {
        queryClient.setQueryData(queryKeys.invoices.detail(invoice.invoiceId), invoice);
      }

      const nextLineItems = buildStagedLineItems(invoiceIds, freshInvoices);
      const nextLineItemKeys = new Set(nextLineItems.map((item) => item.key));
      setLineItems(nextLineItems);
      setSelectedItemKeys(previousSelectedItemKeys.filter((key) => nextLineItemKeys.has(key)));

      if (refreshLabels.length === 0) {
        // Invalidate any cached label snapshot so the next "Manage labels" re-fetches.
        setGeneratedLabels([]);
        setGeneratedForItemKeys([]);
        setSelectedLabelKeys([]);
        notifySuccess(t("labels.staging.success.refreshed"));
        return;
      }

      const targets = nextLineItems
        .filter((item) => refreshLabels.includes(item.key))
        .map((item) => ({ invoiceId: item.invoiceId, lineItemId: item.lineItemId }));

      if (targets.length === 0) {
        setGeneratedLabels([]);
        setGeneratedForItemKeys([]);
        setSelectedLabelKeys([]);
        setStep("line-items");
        notifySuccess(t("labels.staging.success.refreshed"));
        return;
      }

      const controller = new AbortController();
      generateAbortRef.current = controller;
      setGenerateCancelled(false);

      const labels = await generateLabelsMutation.mutateAsync({
        targets,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const nextLabelKeys = new Set(labels.map((label) => label.key));
      setGeneratedLabels(labels);
      setGeneratedForItemKeys(
        nextLineItems
          .filter((item) => refreshLabels.includes(item.key))
          .map((item) => item.key),
      );
      setSelectedLabelKeys(previousSelectedLabelKeys.filter((key) => nextLabelKeys.has(key)));
      notifySuccess(t("labels.staging.success.refreshed"));
    } catch (error) {
      if (isAbortError(error)) return;
      notifyError(normalizeApiError(error).message);
    } finally {
      generateAbortRef.current = null;
      setIsRefreshing(false);
    }
  }

  function handleLineItemSelectionChange(keys: string[]) {
    if (keys.length === 0) {
      cancelGenerateLabels();
    }
    setSelectedItemKeys(keys);
  }

  function toggleItem(key: string, checked: boolean) {
    setSelectedItemKeys((current) =>
      checked ? [...current, key] : current.filter((entry) => entry !== key),
    );
  }

  function requestRemoveLineItems() {
    if (selectedItemKeys.length === 0) return;
    setRemoveConfirm({ kind: "line-items", keys: selectedItemKeys });
  }

  async function generateLabels() {
    const targets = lineItems
      .filter((item) => selectedItemKeys.includes(item.key))
      .map((item) => ({ invoiceId: item.invoiceId, lineItemId: item.lineItemId }));
    if (targets.length === 0) return;

    if (
      generatedForItemKeys.length > 0 &&
      areSameKeySet(selectedItemKeys, generatedForItemKeys)
    ) {
      setStep("labels");
      return;
    }

    cancelGenerateLabels();
    const controller = new AbortController();
    generateAbortRef.current = controller;
    setGenerateCancelled(false);

    try {
      const labels = await generateLabelsMutation.mutateAsync({
        targets,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (labels.length === 0) {
        notifyError(t("labels.staging.errors.noneGenerated"));
        return;
      }

      const createdCount = labels.filter((label) => label.source === "created").length;
      const existingCount = labels.length - createdCount;

      setGeneratedLabels(labels);
      setGeneratedForItemKeys([...selectedItemKeys]);
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
      if (controller.signal.aborted || isAbortError(error)) return;
      notifyError(normalizeApiError(error).message);
    }
  }

  function toggleLabel(key: string, checked: boolean) {
    setSelectedLabelKeys((current) =>
      checked ? [...current, key] : current.filter((entry) => entry !== key),
    );
  }

  function requestRemoveLabel(key: string) {
    setRemoveConfirm({ kind: "label", keys: [key] });
  }

  function requestRemoveLabels() {
    if (selectedLabelKeys.length === 0) return;
    setRemoveConfirm({ kind: "labels", keys: selectedLabelKeys });
  }

  function confirmRemove() {
    if (!removeConfirm) return;
    const keys = new Set(removeConfirm.keys);
    if (removeConfirm.kind === "line-items") {
      setLineItems((current) => current.filter((item) => !keys.has(item.key)));
      setSelectedItemKeys((current) => current.filter((key) => !keys.has(key)));
    } else {
      setGeneratedLabels((current) => current.filter((label) => !keys.has(label.key)));
      setSelectedLabelKeys((current) => current.filter((key) => !keys.has(key)));
    }
    setRemoveConfirm(null);
  }

  function removeDialogCopy(target: RemoveConfirmTarget) {
    const count = target.keys.length;
    if (target.kind === "line-items") {
      return {
        title: t(
          count === 1
            ? "labels.staging.removeDialog.lineItemsTitle"
            : "labels.staging.removeDialog.lineItemsTitle_plural",
        ),
        description: t(
          count === 1
            ? "labels.staging.removeDialog.lineItemsDescription"
            : "labels.staging.removeDialog.lineItemsDescription_plural",
          { count },
        ),
      };
    }
    if (target.kind === "label") {
      return {
        title: t("labels.staging.removeDialog.oneLabelTitle"),
        description: t("labels.staging.removeDialog.oneLabelDescription"),
      };
    }
    return {
      title: t(
        count === 1
          ? "labels.staging.removeDialog.labelsTitle"
          : "labels.staging.removeDialog.labelsTitle_plural",
      ),
      description: t(
        count === 1
          ? "labels.staging.removeDialog.labelsDescription"
          : "labels.staging.removeDialog.labelsDescription_plural",
        { count },
      ),
    };
  }

  function openStatusDialog() {
    if (selectedLabelKeys.length === 0) return;
    setStatusDialogOpen(true);
  }

  async function applyStatusChange() {
    const option = barcodeStatusOptions.find((entry) => entry.name === newStatus);
    if (!option) return;

    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    const newStatusLabel = getBarcodeStatusLabel(option.name, t);
    const withNumbers = selected.filter((label) => label.number.trim().length > 0);
    const withoutNumbers = selected.filter((label) => label.number.trim().length === 0);

    recordChangeOutputs(
      withoutNumbers.map((label) => ({
        barcode: label.number.trim() || t("common.empty.dash"),
        invoiceNumber: label.invoiceNumber,
        container: label.containerName,
        previousStatus: getBarcodeStatusLabel(label.statusName, t),
        newStatus: newStatusLabel,
        message: t("labels.staging.output.missingNumber"),
        success: false,
      })),
    );

    const alreadyCurrent = withNumbers.filter(
      (label) => label.statusId === option.id || label.statusName.trim() === option.name,
    );
    const needsUpdate = withNumbers.filter(
      (label) => label.statusId !== option.id && label.statusName.trim() !== option.name,
    );

    if (alreadyCurrent.length > 0) {
      recordChangeOutputs(
        alreadyCurrent.map((label) => ({
          barcode: label.number,
          invoiceNumber: label.invoiceNumber,
          container: label.containerName,
          previousStatus: getBarcodeStatusLabel(label.statusName, t),
          newStatus: newStatusLabel,
          message: t("labels.staging.output.successStatus"),
          success: true,
        })),
      );
    }

    if (needsUpdate.length === 0) {
      if (withNumbers.length > 0) {
        notifyUpdated(
          t("labels.staging.entities.labelStatus"),
          t("labels.staging.entities.labelCount", { count: withNumbers.length }),
        );
        setStatusDialogOpen(false);
      } else {
        notifyError(t("labels.staging.errors.missingBarcodeNumbers"));
      }
      return;
    }

    const updates: BarcodeUpdate[] = needsUpdate.map((label) => ({
      id: label.catalogId ?? 0,
      barcodeId: label.barcodeId,
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

    try {
      await updateBarcodesMutation.mutateAsync(updates);
      const succeededKeys = new Set(needsUpdate.map((label) => label.key));
      setGeneratedLabels((current) =>
        current.map((label) =>
          succeededKeys.has(label.key)
            ? { ...label, statusId: option.id, statusName: option.name }
            : label,
        ),
      );
      // Keep updated rows visible if a status filter would hide them.
      if (statusFilter !== "all" && statusFilter !== option.name) {
        setStatusFilter("all");
      }
      recordChangeOutputs(
        needsUpdate.map((label) => ({
          barcode: label.number,
          invoiceNumber: label.invoiceNumber,
          container: label.containerName,
          previousStatus: getBarcodeStatusLabel(label.statusName, t),
          newStatus: newStatusLabel,
          message: t("labels.staging.output.successStatus"),
          success: true,
        })),
      );
      notifyUpdated(
        t("labels.staging.entities.labelStatus"),
        t("labels.staging.entities.labelCount", { count: withNumbers.length }),
      );
      setStatusDialogOpen(false);
    } catch (error) {
      const message = normalizeApiError(error).message;
      recordChangeOutputs(
        needsUpdate.map((label) => ({
          barcode: label.number,
          invoiceNumber: label.invoiceNumber,
          container: label.containerName,
          previousStatus: getBarcodeStatusLabel(label.statusName, t),
          newStatus: newStatusLabel,
          message,
          success: false,
        })),
      );
      notifyError(message);
    }
  }

  function openContainerDialog() {
    if (selectedLabelKeys.length === 0) return;
    setNewContainerId(containers[0] ? String(containers[0].id) : "");
    setContainerDialogOpen(true);
  }

  function openRouteDialog() {
    if (selectedLabelKeys.length === 0) return;
    if (assignBarcodes.length === 0) {
      notifyError(t("labels.staging.errors.missingBarcodesForRoute"));
      return;
    }
    setRouteDialogOpen(true);
  }

  async function applyContainerChange() {
    const container = containers.find((entry) => String(entry.id) === newContainerId);
    if (!container) return;

    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    const containerLabel = formatContainerLabel(container);
    const nextContainerName = container.name.trim() || containerLabel;
    const withNumbers = selected.filter((label) => label.number.trim().length > 0);
    const withoutNumbers = selected.filter((label) => label.number.trim().length === 0);

    recordChangeOutputs(
      withoutNumbers.map((label) => ({
        barcode: label.number.trim() || t("common.empty.dash"),
        invoiceNumber: label.invoiceNumber,
        container: label.containerName,
        previousContainer: label.containerName,
        newContainer: nextContainerName,
        message: t("labels.staging.output.missingNumber"),
        success: false,
      })),
    );

    const alreadyCurrent = withNumbers.filter(
      (label) =>
        label.containerId === container.id ||
        label.containerName.trim() === nextContainerName ||
        label.containerName.trim() === container.name.trim(),
    );
    const needsUpdate = withNumbers.filter(
      (label) =>
        label.containerId !== container.id &&
        label.containerName.trim() !== nextContainerName &&
        label.containerName.trim() !== container.name.trim(),
    );

    if (alreadyCurrent.length > 0) {
      recordChangeOutputs(
        alreadyCurrent.map((label) => ({
          barcode: label.number,
          invoiceNumber: label.invoiceNumber,
          container: nextContainerName,
          previousContainer: label.containerName,
          newContainer: nextContainerName,
          message: t("labels.staging.output.successContainer"),
          success: true,
        })),
      );
    }

    if (needsUpdate.length === 0) {
      if (withNumbers.length > 0) {
        notifyUpdated(
          t("labels.staging.entities.labelContainer"),
          t("labels.staging.entities.labelCount", { count: withNumbers.length }),
        );
        setContainerDialogOpen(false);
      } else {
        notifyError(t("labels.staging.errors.missingBarcodeNumbers"));
      }
      return;
    }

    const updates: BarcodeUpdate[] = needsUpdate.map((label) => ({
      id: label.catalogId ?? 0,
      barcodeId: label.barcodeId,
      invoiceId: label.invoiceId,
      writeTarget: label.writeTarget,
      payload: {
        number: label.number,
        status: resolveBarcodeStatusRef(label.statusId, label.statusName, barcodeStatusOptions),
        container: { id: container.id, name: container.name },
      },
    }));

    try {
      await updateBarcodesMutation.mutateAsync(updates);
      const succeededKeys = new Set(needsUpdate.map((label) => label.key));
      setGeneratedLabels((current) =>
        current.map((label) =>
          succeededKeys.has(label.key)
            ? {
                ...label,
                containerId: container.id,
                containerName: nextContainerName,
              }
            : label,
        ),
      );
      recordChangeOutputs(
        needsUpdate.map((label) => ({
          barcode: label.number,
          invoiceNumber: label.invoiceNumber,
          container: nextContainerName,
          previousContainer: label.containerName,
          newContainer: nextContainerName,
          message: t("labels.staging.output.successContainer"),
          success: true,
        })),
      );
      notifyUpdated(
        t("labels.staging.entities.labelContainer"),
        t("labels.staging.entities.labelCount", { count: withNumbers.length }),
      );
      setContainerDialogOpen(false);
    } catch (error) {
      const message = normalizeApiError(error).message;
      recordChangeOutputs(
        needsUpdate.map((label) => ({
          barcode: label.number,
          invoiceNumber: label.invoiceNumber,
          container: label.containerName,
          previousContainer: label.containerName,
          newContainer: nextContainerName,
          message,
          success: false,
        })),
      );
      notifyError(message);
    }
  }

  function handleRouteAssignResult(result: { success: boolean; routeName: string; message: string }) {
    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    const assignable = selected.filter((label) => label.number.trim().length > 0);
    const skipped = selected.filter((label) => label.number.trim().length === 0);
    const dash = t("common.empty.dash");
    const successMessage = t("labels.staging.output.successRoute");

    // Same route as before still counts as success for the barcode changes log.
    const alreadyCurrent = assignable.filter(
      (label) => (label.routeName ?? "").trim() === result.routeName.trim(),
    );
    const changed = assignable.filter(
      (label) => (label.routeName ?? "").trim() !== result.routeName.trim(),
    );

    recordChangeOutputs([
      ...skipped.map((label) => ({
        barcode: label.number.trim() || dash,
        invoiceNumber: label.invoiceNumber,
        container: label.containerName,
        previousRoute: label.routeName ?? "",
        newRoute: result.routeName,
        message: t("labels.staging.output.missingNumber"),
        success: false,
      })),
      ...alreadyCurrent.map((label) => ({
        barcode: label.number.trim() || dash,
        invoiceNumber: label.invoiceNumber,
        container: label.containerName,
        previousRoute: label.routeName ?? "",
        newRoute: result.routeName,
        message: successMessage,
        success: true,
      })),
      ...changed.map((label) => ({
        barcode: label.number.trim() || dash,
        invoiceNumber: label.invoiceNumber,
        container: label.containerName,
        previousRoute: label.routeName ?? "",
        newRoute: result.routeName,
        message: result.success ? successMessage : result.message,
        success: result.success,
      })),
    ]);

    if (!result.success) return;

    const assignedIds = new Set(assignable.map((label) => label.key));
    setGeneratedLabels((current) =>
      current.map((label) =>
        assignedIds.has(label.key) ? { ...label, routeName: result.routeName } : label,
      ),
    );
  }

  async function printSelectedLabels() {
    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    if (selected.length === 0) return;

    const barcodeIds = Array.from(
      new Set(selected.map((label) => label.barcodeId.trim()).filter(Boolean)),
    );

    if (barcodeIds.length === 0) {
      notifyError(t("labels.staging.errors.missingBarcodeNumbersPrint"));
      return;
    }

    try {
      const { url } = await generateLabelReportMutation.mutateAsync(
        buildSelectedLabelReportRequest(barcodeIds),
      );
      window.open(url, "_blank", "noopener,noreferrer");
      notifySuccess(t("labels.staging.success.readyToPrint", { count: barcodeIds.length }));
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

  const manageLabelsButton = (
    <Button
      size="sm"
      onClick={generateLabels}
      disabled={selectedItemKeys.length === 0 || isGenerating || isRefreshing}
    >
      <Barcode className="h-4 w-4" />
      {isGenerating
        ? t("labels.staging.working")
        : t("labels.staging.manageLabels", { count: selectedItemKeys.length })}
    </Button>
  );

  const refreshButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void refreshStagingData()}
      disabled={isRefreshing || isGenerating || isUpdating}
      aria-label={t("labels.staging.refresh")}
      title={t("labels.staging.refresh")}
    >
      <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
      {isRefreshing ? t("labels.staging.refreshing") : t("labels.staging.refresh")}
    </Button>
  );

  const backToLineItemsButton =
    step === "labels" ? (
      <Button variant="outline" onClick={() => setStep("line-items")} disabled={isRefreshing}>
        <ArrowLeft className="h-4 w-4" />
        {t("labels.staging.backToLineItems")}
      </Button>
    ) : null;

  const workflowPanels =
    step === "line-items" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
            <SelectionToolbar
              allKeys={itemKeys}
              selectedKeys={selectedItemKeys}
              total={lineItems.length}
              onSelectedKeysChange={handleLineItemSelectionChange}
              onRemoveAll={requestRemoveLineItems}
            >
              {manageLabelsButton}
            </SelectionToolbar>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-10 px-3 py-2">
                      <HeaderSelectCheckbox
                        total={lineItems.length}
                        selectedCount={selectedItemKeys.length}
                        onSelectAll={() => setSelectedItemKeys(itemKeys)}
                        onDeselectAll={() => handleLineItemSelectionChange([])}
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
            <div className="flex w-full items-center gap-2 border-b bg-muted/10 px-3 py-2">
              <Input
                value={labelQuery}
                onChange={(event) => setLabelQuery(event.target.value)}
                placeholder={t("labels.staging.filterPlaceholder")}
                className="h-8 min-w-0 flex-1"
              />
              <SearchableSelect
                aria-label={t("labels.staging.filterByStatus")}
                className="h-8 max-w-full shrink-0"
                value={statusFilter}
                onValueChange={setStatusFilter}
                searchPlaceholder={t("labels.updater.search.statuses")}
                truncateSelection={false}
                fitToOptions
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
              allKeys={filteredLabelKeys}
              selectedKeys={selectedLabelKeys}
              total={filteredLabels.length}
              onSelectedKeysChange={setSelectedLabelKeys}
              onRemoveAll={requestRemoveLabels}
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
                disabled={selectedLabelKeys.length === 0}
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
                              onClick={() => requestRemoveLabel(label.key)}
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

  const removeCopy = removeConfirm ? removeDialogCopy(removeConfirm) : null;

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

      <AssignBarcodeRouteDialog
        open={routeDialogOpen}
        onOpenChange={setRouteDialogOpen}
        barcodes={assignBarcodes}
        onResult={handleRouteAssignResult}
      />

      <Dialog
        open={removeConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveConfirm(null);
        }}
      >
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>{removeCopy?.title}</DialogTitle>
            <DialogDescription>{removeCopy?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirm(null)}>
              {t("common.actions.cancel")}
            </Button>
            <ConfirmDeleteButton
              label={t("labels.staging.remove")}
              onClick={confirmRemove}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  if (!isDialog) {
    return (
      <>
        <div className="flex h-[calc(100dvh-10rem)] flex-col gap-4">
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
            <div className="flex flex-wrap items-center gap-2">
              {refreshButton}
              {backToLineItemsButton}
              <Button variant="outline" onClick={handleClose}>
                <ArrowLeft className="h-4 w-4" />
                {t("labels.staging.backToInvoices")}
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4">
            {workflowPanels}
            <LabelChangeOutputTable rows={changeResults} />
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
            <div className="flex items-start justify-between gap-4 pr-8">
              <div className="space-y-2">
                <DialogTitle className="flex items-center gap-2">{stagingHeaderTitle}</DialogTitle>
                <DialogDescription>{stagingDescription}</DialogDescription>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {refreshButton}
                {backToLineItemsButton}
              </div>
            </div>
          </DialogHeader>

          {workflowPanels}
          <LabelChangeOutputTable rows={changeResults} />
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
