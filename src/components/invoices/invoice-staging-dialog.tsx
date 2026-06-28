"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Barcode,
  Container as ContainerIcon,
  ListChecks,
  ListX,
  Printer,
  RefreshCw,
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
import { truncateBarcode } from "@/lib/labels/display";
import { useGenerateLabels, useUpdateBarcodes } from "@/lib/labels/hooks/use-barcodes";
import { useGenerateLabelReport } from "@/lib/reports/hooks/use-reports";
import type { BarcodeUpdate } from "@/lib/labels/api/barcodes-api";
import {
  BARCODE_STATUS_OPTIONS,
  buildStagedLineItems,
  type GeneratedLabel,
  type StagedLineItem,
} from "@/lib/labels/types";
import type { Invoice } from "@/lib/invoices/types";
import { canSelectAllOthers, selectAllOthers } from "@/lib/table/selection";
import { cn } from "@/lib/utils";

type InvoiceStagingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Invoices selected in the table to stage for label processing. */
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

type SelectionToolbarProps = {
  selectedCount: number;
  total: number;
  allKeys: string[];
  selectedKeys: string[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectAllOthers: () => void;
  onRemoveAll: () => void;
  children?: ReactNode;
};

function SelectionToolbar({
  selectedCount,
  total,
  allKeys,
  selectedKeys,
  onSelectAll,
  onDeselectAll,
  onSelectAllOthers,
  onRemoveAll,
  children,
}: SelectionToolbarProps) {
  const othersAvailable = canSelectAllOthers(allKeys, selectedKeys);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted/20 px-3 py-2">
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
        {selectedCount} of {total} selected
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={onSelectAll} disabled={total === 0}>
          <ListChecks className="h-4 w-4" />
          Select all
        </Button>
        <Button size="sm" variant="ghost" onClick={onDeselectAll} disabled={selectedCount === 0}>
          <ListX className="h-4 w-4" />
          Deselect all
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          disabled={!othersAvailable}
          onClick={onSelectAllOthers}
        >
          <ListChecks className="h-4 w-4" />
          Select all others
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={selectedCount === 0}
          onClick={onRemoveAll}
        >
          <Trash2 className="h-4 w-4" />
          Remove all
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

export function InvoiceStagingDialog({ open, onOpenChange, invoices }: InvoiceStagingDialogProps) {
  const { notifyError, notifySuccess, notifyUpdated } = useFeedback();
  const { data: containersData } = useContainerPicker(200, { enabled: open });
  const containers = containersData?.items ?? [];
  const generateLabelsMutation = useGenerateLabels();
  const updateBarcodesMutation = useUpdateBarcodes();
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
  const [newStatus, setNewStatus] = useState<string>(BARCODE_STATUS_OPTIONS[1].name);
  const [newContainerId, setNewContainerId] = useState("");

  const isGenerating = generateLabelsMutation.isPending;
  const isUpdating = updateBarcodesMutation.isPending;
  const isPrinting = generateLabelReportMutation.isPending;

  // Keep the latest invoices without making them a reset trigger: generating
  // labels invalidates the invoices query, which would otherwise change the
  // `invoices` prop reference and bounce the user back to step 1.
  const invoicesRef = useRef(invoices);
  invoicesRef.current = invoices;

  // Reset the whole flow only when the dialog is (re)opened for a new selection.
  useEffect(() => {
    if (!open) return;
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
  }, [open]);

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

  function removeLineItem(key: string) {
    setLineItems((current) => current.filter((item) => item.key !== key));
    setSelectedItemKeys((current) => current.filter((entry) => entry !== key));
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
        notifyError("No labels were generated for the selected line items.");
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
        createdCount > 0 ? `${createdCount} created` : null,
        existingCount > 0 ? `${existingCount} retrieved` : null,
      ].filter(Boolean);
      notifySuccess(`Labels ready (${parts.join(", ")}).`);
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
      .filter((label) => label.barcodeId > 0)
      .map((label) => ({
        id: label.barcodeId,
        payload: {
          number: label.number,
          status: { id: option.id, name: option.name },
          ...(label.containerId != null
            ? { container: { id: label.containerId, name: label.containerName } }
            : {}),
        },
      }));

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
      notifyUpdated("Label status", `${selected.length} label(s)`);
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

  async function applyContainerChange() {
    const container = containers.find((entry) => String(entry.id) === newContainerId);
    if (!container) return;

    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    const updates: BarcodeUpdate[] = selected
      .filter((label) => label.barcodeId > 0)
      .map((label) => ({
        id: label.barcodeId,
        payload: {
          number: label.number,
          status: { id: label.statusId ?? 0, name: label.statusName },
          container: { id: container.id, name: container.name },
        },
      }));

    const containerLabel = formatContainerLabel(container);

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
      notifyUpdated("Label container", `${selected.length} label(s)`);
      setContainerDialogOpen(false);
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  async function printSelectedLabels() {
    const selected = generatedLabels.filter((label) => selectedLabelKeys.includes(label.key));
    if (selected.length === 0) return;

    const invoiceIds = Array.from(new Set(selected.map((label) => label.invoiceId).filter(Boolean)));
    if (invoiceIds.length === 0) {
      notifyError("Selected labels are missing an invoice reference to print.");
      return;
    }

    try {
      const { url } = await generateLabelReportMutation.mutateAsync({
        type: "label",
        collection: "invoices",
        values: invoiceIds,
        lookupField: "id",
      });
      window.open(url, "_blank", "noopener,noreferrer");
      notifySuccess(`Labels ready for ${invoiceIds.length} invoice(s).`);
    } catch (error) {
      notifyError(normalizeApiError(error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-5xl flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "line-items" ? (
              <>
                <Tag className="h-4 w-4" />
                Manage Labels
              </>
            ) : (
              <>
                <Barcode className="h-4 w-4" />
                Generate labels
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {step === "line-items"
              ? "Review line items from the selected invoices, choose which to label, then generate labels."
              : "Barcodes were created where missing and retrieved where they already existed. Manage status, container, and printing below."}
          </DialogDescription>
        </DialogHeader>

        {step === "line-items" ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
            <SelectionToolbar
              selectedCount={selectedItemKeys.length}
              total={lineItems.length}
              allKeys={itemKeys}
              selectedKeys={selectedItemKeys}
              onSelectAll={() => setSelectedItemKeys(itemKeys)}
              onDeselectAll={() => setSelectedItemKeys([])}
              onSelectAllOthers={() =>
                setSelectedItemKeys(selectAllOthers(itemKeys, selectedItemKeys))
              }
              onRemoveAll={removeSelectedLineItems}
            />

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2 font-medium">Invoice</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium">Labels</th>
                    <th className="px-3 py-2 font-medium">Quantity</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                        No line items to stage. Close and select invoices with line items.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((item) => {
                      const checked = selectedItemKeys.includes(item.key);
                      return (
                        <tr
                          key={item.key}
                          className={cn(
                            "border-b transition-colors last:border-0 hover:bg-muted/25",
                            checked && "bg-primary/[0.06]",
                          )}
                        >
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.invoiceNumber} · ${item.description}`}
                              checked={checked}
                              onChange={(event) => toggleItem(item.key, event.target.checked)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{item.invoiceNumber}</td>
                          <td className="px-3 py-2">{item.description}</td>
                          <td className="px-3 py-2">{item.labelCount}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              aria-label="Remove line item"
                              onClick={() => removeLineItem(item.key)}
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
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
            <div className="flex flex-wrap items-center gap-2 border-b bg-muted/10 px-3 py-2">
              <Input
                value={labelQuery}
                onChange={(event) => setLabelQuery(event.target.value)}
                placeholder="Filter by invoice, barcode, status, container, description…"
                className="h-8 max-w-xs"
              />
              <SearchableSelect
                aria-label="Filter by status"
                className="h-8 w-40"
                value={statusFilter}
                onValueChange={setStatusFilter}
                searchPlaceholder="Search statuses…"
                options={statusOptions.map((option) => ({
                  value: option,
                  label: option === "all" ? "All statuses" : option,
                }))}
              />
            </div>

            <SelectionToolbar
              selectedCount={selectedLabelKeys.length}
              total={filteredLabels.length}
              allKeys={filteredLabelKeys}
              selectedKeys={selectedLabelKeys}
              onSelectAll={() =>
                setSelectedLabelKeys((current) =>
                  Array.from(new Set([...current, ...filteredLabelKeys])),
                )
              }
              onDeselectAll={() => setSelectedLabelKeys([])}
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
                Change status
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selectedLabelKeys.length === 0}
                onClick={openContainerDialog}
              >
                <ContainerIcon className="h-4 w-4" />
                Transfer container
              </Button>
              <Button
                size="sm"
                disabled={selectedLabelKeys.length === 0 || isPrinting}
                onClick={printSelectedLabels}
              >
                <Printer className="h-4 w-4" />
                {isPrinting ? "Preparing…" : "Print"}
              </Button>
            </SelectionToolbar>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 z-10 bg-muted/50 text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="w-10 px-3 py-2" />
                    <th className="px-3 py-2 font-medium">Invoice</th>
                    <th className="px-3 py-2 font-medium">Barcode</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Labels</th>
                    <th className="px-3 py-2 font-medium">Container</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredLabels.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                        No labels match the current filter.
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
                              aria-label={`Select label ${label.number}`}
                              checked={checked}
                              onChange={(event) => toggleLabel(label.key, event.target.checked)}
                              className="size-4 rounded border-input"
                            />
                          </td>
                          <td className="px-3 py-2 font-medium">{label.invoiceNumber}</td>
                          <td className="px-3 py-2 font-mono text-xs">{truncateBarcode(label.number)}</td>
                          <td className="px-3 py-2">
                            <TableTagText className={getStatusBadgeClass(label.statusName)}>
                              {label.statusName}
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
                              aria-label="Remove label from view"
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
        )}

        <DialogFooter className="sm:justify-between">
          {step === "line-items" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={generateLabels} disabled={selectedItemKeys.length === 0 || isGenerating}>
                <Barcode className="h-4 w-4" />
                {isGenerating ? "Working…" : `Manage labels (${selectedItemKeys.length})`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("line-items")}>
                Back to line items
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>Change label status</DialogTitle>
            <DialogDescription>
              Update status for {selectedLabelKeys.length} selected label(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staging-new-status">New status</Label>
            <SearchableSelect
              id="staging-new-status"
              value={newStatus}
              onValueChange={setNewStatus}
              searchPlaceholder="Search statuses…"
              contentClassName="z-[80]"
              options={BARCODE_STATUS_OPTIONS.map((option) => ({
                value: option.name,
                label: option.name,
              }))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={applyStatusChange} disabled={isUpdating}>
              {isUpdating ? "Applying…" : "Apply status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={containerDialogOpen} onOpenChange={setContainerDialogOpen}>
        <DialogContent className="z-[70]">
          <DialogHeader>
            <DialogTitle>Transfer container</DialogTitle>
            <DialogDescription>
              Move {selectedLabelKeys.length} selected label(s) to another container.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="staging-new-container">Container</Label>
            <SearchableSelect
              id="staging-new-container"
              value={newContainerId}
              onValueChange={setNewContainerId}
              searchPlaceholder="Search containers…"
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
              Cancel
            </Button>
            <Button onClick={applyContainerChange} disabled={!newContainerId || isUpdating}>
              {isUpdating ? "Applying…" : "Apply container"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
