"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cloneContainers } from "@/lib/containers/mock-data";
import { applyLabelBarcodeUpdate } from "@/lib/labels/updater";
import { LABEL_STATUSES, type LabelStatus, type LabelUpdateResult } from "@/lib/labels/types";
import { cloneRouteAssignments } from "@/lib/route-assignments/mock-data";
import { formatRouteAssignmentCopyLabel } from "@/lib/route-assignments/display";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

function ResultCell({ value }: { value?: string | number }) {
  if (value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  return <span>{value}</span>;
}

export function LabelUpdaterWorkspace() {
  const containers = useMemo(() => cloneContainers(), []);
  const routeAssignments = useMemo(() => cloneRouteAssignments(), []);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [changeStatus, setChangeStatus] = useState(true);
  const [changeContainer, setChangeContainer] = useState(false);
  const [changeRouteAssignment, setChangeRouteAssignment] = useState(false);
  const [newStatus, setNewStatus] = useState<LabelStatus>("in_transit");
  const [newContainerId, setNewContainerId] = useState(containers[0]?.containerId ?? "");
  const [newRouteAssignmentId, setNewRouteAssignmentId] = useState(routeAssignments[0]?.routeAssignmentId ?? "");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bulkBarcodes, setBulkBarcodes] = useState("");
  const [results, setResults] = useState<LabelUpdateResult[]>([]);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  function focusBarcodeInput() {
    requestAnimationFrame(() => barcodeInputRef.current?.focus());
  }

  function submitBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();
    if (!barcode) return;

    const result = applyLabelBarcodeUpdate(barcode, {
      changeStatus,
      newStatus: changeStatus ? newStatus : undefined,
      changeContainer,
      newContainerId: changeContainer ? newContainerId : undefined,
      changeRouteAssignment,
      newRouteAssignmentId: changeRouteAssignment ? newRouteAssignmentId : undefined,
    });

    setResults((current) => [result, ...current]);
    setBarcodeInput("");
    focusBarcodeInput();
  }

  function handleBarcodeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitBarcode(barcodeInput);
  }

  function applyBulkBarcodes() {
    const barcodes = bulkBarcodes
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (barcodes.length === 0) return;

    const nextResults = barcodes.map((barcode) =>
      applyLabelBarcodeUpdate(barcode, {
        changeStatus,
        newStatus: changeStatus ? newStatus : undefined,
        changeContainer,
        newContainerId: changeContainer ? newContainerId : undefined,
        changeRouteAssignment,
        newRouteAssignmentId: changeRouteAssignment ? newRouteAssignmentId : undefined,
      })
    );

    setResults((current) => [...nextResults.reverse(), ...current]);
    setBulkBarcodes("");
    focusBarcodeInput();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Label Updater"
        description="Scan or enter barcodes to update status, container, and route assignment. Press Enter after each barcode."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Update options</CardTitle>
          <CardDescription>Select one or more fields to apply on each barcode scan.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={changeStatus}
                onChange={(event) => setChangeStatus(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Change status
            </label>
            {changeStatus ? (
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
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={changeContainer}
                onChange={(event) => setChangeContainer(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Change container
            </label>
            {changeContainer ? (
              <div className="space-y-2">
                <Label htmlFor="newContainer">New container</Label>
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
            ) : null}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={changeRouteAssignment}
                onChange={(event) => setChangeRouteAssignment(event.target.checked)}
                className="size-4 rounded border-input"
              />
              Change route assignment
            </label>
            {changeRouteAssignment ? (
              <div className="space-y-2">
                <Label htmlFor="newRouteAssignment">New route assignment</Label>
                <select
                  id="newRouteAssignment"
                  className={selectClassName}
                  value={newRouteAssignmentId}
                  onChange={(event) => setNewRouteAssignmentId(event.target.value)}
                >
                  {routeAssignments.map((assignment) => (
                    <option key={assignment.routeAssignmentId} value={assignment.routeAssignmentId}>
                      {formatRouteAssignmentCopyLabel(assignment)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="barcodeInput">Barcode (press Enter)</Label>
              <div className="flex gap-2">
                <Input
                  id="barcodeInput"
                  ref={barcodeInputRef}
                  value={barcodeInput}
                  onChange={(event) => setBarcodeInput(event.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  placeholder="Scan or type barcode..."
                  className="font-mono text-sm"
                  autoComplete="off"
                />
                <Button type="button" onClick={() => submitBarcode(barcodeInput)}>
                  <ScanBarcode className="h-4 w-4" />
                  Apply
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Field clears automatically after each update so you can scan the next label.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulkBarcodes">Multiple barcodes (comma or newline separated)</Label>
              <textarea
                id="bulkBarcodes"
                value={bulkBarcodes}
                onChange={(event) => setBulkBarcodes(event.target.value)}
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                placeholder="LBL-..., LBL-..."
              />
              <Button type="button" variant="outline" size="sm" onClick={applyBulkBarcodes}>
                Apply all barcodes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update results</CardTitle>
          <CardDescription>
            Green rows succeeded; red rows failed. Only changed fields are shown per row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Scan a barcode to see results here.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Barcode</th>
                    <th className="px-3 py-2 font-medium">Invoice</th>
                    <th className="px-3 py-2 font-medium">Container</th>
                    <th className="px-3 py-2 font-medium">Prev status</th>
                    <th className="px-3 py-2 font-medium">New status</th>
                    <th className="px-3 py-2 font-medium">Prev container</th>
                    <th className="px-3 py-2 font-medium">New container</th>
                    <th className="px-3 py-2 font-medium">Prev route</th>
                    <th className="px-3 py-2 font-medium">New route</th>
                    <th className="px-3 py-2 font-medium">Labels</th>
                    <th className="px-3 py-2 font-medium">Date created</th>
                    <th className="px-3 py-2 font-medium">User created</th>
                    <th className="px-3 py-2 font-medium">Date modified</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr
                      key={result.id}
                      className={cn(
                        "border-b last:border-0",
                        result.success ? "bg-emerald-500/10" : "bg-destructive/10"
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{result.barcode}</td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.invoiceNumber} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.container} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.previousStatus} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.newStatus} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.previousContainer} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.newContainer} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.previousRouteAssignment} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.newRouteAssignment} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.totalLabels} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <ResultCell value={result.dateTime} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.createdBy} />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">—</td>
                      <td className="px-3 py-2">{result.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
