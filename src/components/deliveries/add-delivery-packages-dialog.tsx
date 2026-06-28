"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  PackagePlus,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DeliveryInvoicePreviewSheet } from "@/components/deliveries/delivery-invoice-preview-sheet";
import { Badge } from "@/components/ui/badge";
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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useAddPackagesToDelivery,
  useInvoiceDetailLabels,
} from "@/lib/deliveries/hooks/use-deliveries";
import {
  deliveryPackageBarcodeKey,
  isBarcodeOnDelivery,
  type Delivery,
  type DeliveryPackageBarcode,
  type DeliveryPackageLineItem,
  type DeliveryPackageUpdateResult,
} from "@/lib/deliveries/types";
import { formatDeliveryDate } from "@/lib/deliveries/display";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { buildInvoiceListParams, type Invoice } from "@/lib/invoices/types";
import { cn } from "@/lib/utils";

type Step = "invoices" | "packages" | "results";

type AddDeliveryPackagesDialogProps = {
  delivery: Delivery;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (results: DeliveryPackageUpdateResult[]) => void;
};

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: "invoices" as const, label: "Select invoices" },
    { id: "packages" as const, label: "Choose packages" },
    { id: "results" as const, label: "Results" },
  ];

  const currentIndex = steps.findIndex((entry) => entry.id === step);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((entry, index) => (
        <div key={entry.id} className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-full border font-medium",
              index <= currentIndex
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground",
            )}
          >
            {index + 1}
          </span>
          <span className={cn(index <= currentIndex ? "text-foreground" : "text-muted-foreground")}>
            {entry.label}
          </span>
          {index < steps.length - 1 ? <span className="text-muted-foreground">→</span> : null}
        </div>
      ))}
    </div>
  );
}

export function AddDeliveryPackagesDialog({
  delivery,
  open,
  onOpenChange,
  onCompleted,
}: AddDeliveryPackagesDialogProps) {
  const [step, setStep] = useState<Step>("invoices");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [selectedInvoices, setSelectedInvoices] = useState<Invoice[]>([]);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [expandedLineItems, setExpandedLineItems] = useState<Record<string, boolean>>({});
  const [selectedBarcodeNumbers, setSelectedBarcodeNumbers] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<DeliveryPackageUpdateResult[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const invoiceParams = useMemo(
    () =>
      buildInvoiceListParams({
        page: 1,
        limit: 50,
        query: debouncedQuery,
        rows: [],
        paymentLocation: "all",
      }),
    [debouncedQuery],
  );

  const invoicesQuery = useInvoices(invoiceParams, { enabled: open && step === "invoices" });
  const invoices = invoicesQuery.data?.items ?? [];
  const selectedInvoiceIds = useMemo(
    () => selectedInvoices.map((invoice) => invoice.invoiceId),
    [selectedInvoices],
  );

  const labelsQuery = useInvoiceDetailLabels(selectedInvoiceIds, open && step === "packages");
  const lineItems = labelsQuery.data ?? [];
  const addPackagesMutation = useAddPackagesToDelivery();

  useEffect(() => {
    if (step !== "packages" || lineItems.length === 0) return;

    const defaults = new Set<string>();
    lineItems.forEach((lineItem) => {
      lineItem.barcodes.forEach((barcode) => {
        if (!isBarcodeOnDelivery(barcode, delivery.id)) {
          defaults.add(deliveryPackageBarcodeKey(barcode));
        }
      });
    });
    setSelectedBarcodeNumbers(defaults);
    setExpandedLineItems(Object.fromEntries(lineItems.map((lineItem) => [lineItem.id, true])));
  }, [delivery.id, lineItems, step]);

  const selectableBarcodes = useMemo(() => {
    return lineItems.flatMap((lineItem) =>
      lineItem.barcodes.filter((barcode) => !isBarcodeOnDelivery(barcode, delivery.id)),
    );
  }, [delivery.id, lineItems]);

  const selectedBarcodes = useMemo(() => {
    return selectableBarcodes.filter((barcode) => selectedBarcodeNumbers.has(deliveryPackageBarcodeKey(barcode)));
  }, [selectableBarcodes, selectedBarcodeNumbers]);

  function resetState() {
    setStep("invoices");
    setQuery("");
    setSelectedInvoices([]);
    setPreviewInvoiceId(null);
    setExpandedLineItems({});
    setSelectedBarcodeNumbers(new Set());
    setResults([]);
    setLocalError(null);
  }

  function close(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) resetState();
  }

  function addInvoice(invoice: Invoice) {
    setSelectedInvoices((current) =>
      current.some((entry) => entry.invoiceId === invoice.invoiceId) ? current : [...current, invoice],
    );
    setLocalError(null);
  }

  function removeInvoice(invoiceId: string) {
    setSelectedInvoices((current) => current.filter((invoice) => invoice.invoiceId !== invoiceId));
  }

  function toggleBarcode(barcode: DeliveryPackageBarcode, checked: boolean) {
    const key = deliveryPackageBarcodeKey(barcode);
    setSelectedBarcodeNumbers((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleLineItem(lineItem: DeliveryPackageLineItem, checked: boolean) {
    const keys = lineItem.barcodes
      .filter((barcode) => !isBarcodeOnDelivery(barcode, delivery.id))
      .map(deliveryPackageBarcodeKey);

    setSelectedBarcodeNumbers((current) => {
      const next = new Set(current);
      keys.forEach((key) => {
        if (checked) next.add(key);
        else next.delete(key);
      });
      return next;
    });
  }

  function lineItemSelectionState(lineItem: DeliveryPackageLineItem): "none" | "partial" | "all" {
    const selectable = lineItem.barcodes.filter((barcode) => !isBarcodeOnDelivery(barcode, delivery.id));
    if (selectable.length === 0) return "all";
    const selectedCount = selectable.filter((barcode) =>
      selectedBarcodeNumbers.has(deliveryPackageBarcodeKey(barcode)),
    ).length;
    if (selectedCount === 0) return "none";
    if (selectedCount === selectable.length) return "all";
    return "partial";
  }

  async function submitPackages() {
    setLocalError(null);
    try {
      const nextResults = await addPackagesMutation.mutateAsync({
        delivery,
        barcodes: selectedBarcodes,
      });
      setResults(nextResults);
      setStep("results");
      onCompleted?.(nextResults);
    } catch (error) {
      setLocalError(normalizeApiError(error).message);
    }
  }

  return (
    <>
      <DeliveryInvoicePreviewSheet
        invoiceId={previewInvoiceId}
        open={Boolean(previewInvoiceId)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewInvoiceId(null);
        }}
      />

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="space-y-3 border-b px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle>Add packages to {delivery.name}</DialogTitle>
                <DialogDescription>
                  Select invoices, choose individual package barcodes, and assign them to this delivery.
                </DialogDescription>
              </div>
              <Badge variant="outline">{delivery.container?.name || "No container"}</Badge>
            </div>
            <StepIndicator step={step} />
          </DialogHeader>

          {localError ? (
            <div className="border-b bg-destructive/5 px-6 py-3 text-sm text-destructive">{localError}</div>
          ) : null}

          {step === "invoices" ? (
            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden md:grid-cols-[1fr_340px]">
              <div className="min-h-0 border-r">
                <div className="border-b p-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      className="pl-9"
                      placeholder="Search by invoice number, sender, or receiver..."
                    />
                  </div>
                </div>
                <div className="max-h-[52vh] overflow-y-auto">
                  {invoicesQuery.isLoading ? (
                    <p className="p-6 text-sm text-muted-foreground">Loading invoices...</p>
                  ) : invoices.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground">No invoices found.</p>
                  ) : (
                    <div className="divide-y">
                      {invoices.map((invoice) => (
                        <div key={invoice.invoiceId} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {invoice.sender.name} → {invoice.receiver.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.lineItems.length} items · {formatInvoiceMoney(invoice.cost ?? 0)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewInvoiceId(invoice.invoiceId)}
                            aria-label={`Preview invoice ${invoice.invoiceNumber}`}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => addInvoice(invoice)}>
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-h-0 bg-muted/20">
                <div className="border-b p-4">
                  <p className="text-sm font-medium">Selected invoices</p>
                  <p className="text-xs text-muted-foreground">{selectedInvoices.length} ready for package selection</p>
                </div>
                <div className="max-h-[52vh] overflow-y-auto">
                  {selectedInvoices.length === 0 ? (
                    <p className="p-6 text-sm text-muted-foreground">Select invoices from the list.</p>
                  ) : (
                    <div className="divide-y">
                      {selectedInvoices.map((invoice) => (
                        <div key={invoice.invoiceId} className="flex items-center gap-2 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground">{invoice.lineItems.length} line items</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setPreviewInvoiceId(invoice.invoiceId)}
                            aria-label={`Preview invoice ${invoice.invoiceNumber}`}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeInvoice(invoice.invoiceId)}
                            aria-label="Remove invoice"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {step === "packages" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                All eligible packages are selected by default. Deselect any barcode you do not want on this delivery.
                Packages must typically be in EN TRANSITO, ALM-RD, or DEV-RD before they can be added.
              </div>

              {labelsQuery.isLoading ? (
                <p className="py-10 text-sm text-muted-foreground">Loading invoice packages...</p>
              ) : labelsQuery.isError ? (
                <p className="py-10 text-sm text-destructive">{normalizeApiError(labelsQuery.error).message}</p>
              ) : lineItems.length === 0 ? (
                <p className="py-10 text-sm text-muted-foreground">No package barcodes were found for the selected invoices.</p>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((lineItem) => {
                    const expanded = expandedLineItems[lineItem.id] ?? true;
                    const selectionState = lineItemSelectionState(lineItem);

                    return (
                      <div key={lineItem.id} className="overflow-hidden rounded-lg border bg-card">
                        <div className="flex items-center gap-3 border-b px-4 py-3">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-input"
                            checked={selectionState === "all"}
                            ref={(element) => {
                              if (element) element.indeterminate = selectionState === "partial";
                            }}
                            onChange={(event) => toggleLineItem(lineItem, event.target.checked)}
                            aria-label={`Select all packages for ${lineItem.name}`}
                          />
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-start gap-2 text-left"
                            onClick={() =>
                              setExpandedLineItems((current) => ({
                                ...current,
                                [lineItem.id]: !expanded,
                              }))
                            }
                          >
                            {expanded ? (
                              <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{lineItem.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                Invoice {lineItem.invoiceNumber} · {lineItem.labels} labels ·{" "}
                                {formatInvoiceMoney(lineItem.total)}
                              </span>
                            </span>
                          </button>
                        </div>

                        {expanded ? (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                              <thead>
                                <tr className="border-b bg-muted/20 text-left text-xs uppercase text-muted-foreground">
                                  <th className="px-4 py-2 font-medium">Select</th>
                                  <th className="px-4 py-2 font-medium">Barcode</th>
                                  <th className="px-4 py-2 font-medium">Status</th>
                                  <th className="px-4 py-2 font-medium">Container</th>
                                  <th className="px-4 py-2 font-medium">Delivery</th>
                                  <th className="px-4 py-2 font-medium">Scanned</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lineItem.barcodes.map((barcode) => {
                                  const alreadyAdded = isBarcodeOnDelivery(barcode, delivery.id);
                                  const checked = selectedBarcodeNumbers.has(deliveryPackageBarcodeKey(barcode));

                                  return (
                                    <tr key={barcode.id} className="border-b last:border-0">
                                      <td className="px-4 py-2">
                                        <input
                                          type="checkbox"
                                          className="size-4 rounded border-input"
                                          checked={alreadyAdded || checked}
                                          disabled={alreadyAdded}
                                          onChange={(event) => toggleBarcode(barcode, event.target.checked)}
                                          aria-label={`Select barcode ${barcode.number}`}
                                        />
                                      </td>
                                      <td className="px-4 py-2 font-mono text-xs">{barcode.number}</td>
                                      <td className="px-4 py-2">
                                        <Badge variant="outline">{barcode.status.name || "—"}</Badge>
                                      </td>
                                      <td className="px-4 py-2">{barcode.container.name || "—"}</td>
                                      <td className="px-4 py-2">
                                        {alreadyAdded ? (
                                          <Badge variant="secondary">On this delivery</Badge>
                                        ) : barcode.delivery?.name ? (
                                          barcode.delivery.name
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td className="px-4 py-2 text-muted-foreground">
                                        {barcode.scanDate ? formatDeliveryDate(barcode.scanDate) : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {step === "results" ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Badge variant="secondary">
                  {results.filter((result) => !result.hasError).length} succeeded
                </Badge>
                {results.some((result) => result.hasError) ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    {results.filter((result) => result.hasError).length} failed
                  </Badge>
                ) : null}
              </div>
              <div className="space-y-2">
                {results.map((result) => (
                  <div
                    key={result.number}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border px-4 py-3",
                      result.hasError ? "border-destructive/30 bg-destructive/5" : "border-border bg-card",
                    )}
                  >
                    {result.hasError ? (
                      <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    )}
                    <div className="min-w-0">
                      <p className="font-mono text-sm">{result.number}</p>
                      <p className="text-sm text-muted-foreground">{result.message || "Updated successfully."}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={addPackagesMutation.isPending}>
              {step === "results" ? "Close" : "Cancel"}
            </Button>

            {step === "invoices" ? (
              <Button
                type="button"
                onClick={() => {
                  if (selectedInvoices.length === 0) {
                    setLocalError("Select at least one invoice.");
                    return;
                  }
                  setLocalError(null);
                  setStep("packages");
                }}
                disabled={selectedInvoices.length === 0}
              >
                Continue to packages
              </Button>
            ) : null}

            {step === "packages" ? (
              <>
                <Button type="button" variant="outline" onClick={() => setStep("invoices")}>
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={submitPackages}
                  disabled={selectedBarcodes.length === 0 || addPackagesMutation.isPending || labelsQuery.isLoading}
                >
                  <PackagePlus className="size-4" />
                  {addPackagesMutation.isPending
                    ? "Adding packages..."
                    : `Add ${selectedBarcodes.length} package${selectedBarcodes.length === 1 ? "" : "s"}`}
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
