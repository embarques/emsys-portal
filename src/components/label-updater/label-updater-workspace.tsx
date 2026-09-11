"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useUserError } from "@/lib/errors";
import { useApplyBarcodeScan, useApplyBarcodeScanBulk } from "@/lib/labels/hooks/use-label-updater";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { FALLBACK_BARCODE_STATUS_OPTIONS, type LabelUpdateResult } from "@/lib/labels/types";
import { useTranslation } from "@/lib/i18n";
import { formatActiveRouteAssignmentLabel } from "@/lib/pickup-delivery-routes/display";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { cn } from "@/lib/utils";

function ResultCell({ value }: { value?: string | number }) {
  if (value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  return <span>{value}</span>;
}

const FALLBACK_SCAN_STATUS_ID =
  FALLBACK_BARCODE_STATUS_OPTIONS.find((entry) => entry.name === "EN TRANSITO")?.id ?? 3;

export function LabelUpdaterWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const barcodeStatusOptions = useBarcodeStatusOptions();
  const { data: containersData } = useContainerPicker();
  const containers = containersData?.items ?? [];
  const { data: routesData } = useActiveRoutePicker("delivery", 200);
  const routes = routesData?.items ?? [];
  const applyScanMutation = useApplyBarcodeScan();
  const applyBulkMutation = useApplyBarcodeScanBulk();
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const [changeStatus, setChangeStatus] = useState(true);
  const [changeContainer, setChangeContainer] = useState(false);
  const [changeRoute, setChangeRoute] = useState(false);
  const [newStatusId, setNewStatusId] = useState(String(FALLBACK_SCAN_STATUS_ID));
  const [newContainerId, setNewContainerId] = useState("");
  const [newRouteRecordId, setNewRouteRecordId] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [bulkBarcodes, setBulkBarcodes] = useState("");
  const [results, setResults] = useState<LabelUpdateResult[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const isSubmitting = applyScanMutation.isPending || applyBulkMutation.isPending;

  const routeOptions = useMemo(
    () =>
      routes.map((route) => ({
        value: route.id,
        label: formatActiveRouteAssignmentLabel(route, t),
        keywords: [route.name, route.route?.name, route.container?.name, route.date].filter(
          (entry): entry is string => Boolean(entry?.trim()),
        ),
      })),
    [routes, t],
  );

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!newContainerId && containers[0]) {
      setNewContainerId(String(containers[0].id));
    }
  }, [containers, newContainerId]);

  useEffect(() => {
    if (!newRouteRecordId && routes[0]) {
      setNewRouteRecordId(routes[0].id);
    }
  }, [routes, newRouteRecordId]);

  useEffect(() => {
    if (barcodeStatusOptions.some((entry) => String(entry.id) === newStatusId)) return;
    const inTransit = barcodeStatusOptions.find((entry) => {
      const name = entry.name.toUpperCase();
      return name === "EN TRANSITO" || name === "IN TRANSIT";
    });
    setNewStatusId(String(inTransit?.id ?? barcodeStatusOptions[0]?.id ?? FALLBACK_SCAN_STATUS_ID));
  }, [barcodeStatusOptions, newStatusId]);

  function focusBarcodeInput() {
    requestAnimationFrame(() => barcodeInputRef.current?.focus());
  }

  function resolveRouteLabel(routeRecordId: string): string {
    const route = routes.find((entry) => entry.id === routeRecordId);
    return route ? formatActiveRouteAssignmentLabel(route, t) : routeRecordId;
  }

  function resolveContainerLabel(containerId: string): string {
    const container = containers.find((entry) => String(entry.id) === containerId);
    return container ? formatContainerLabel(container) : containerId;
  }

  function buildScannerOptions() {
    return {
      changeStatus,
      newStatusId: changeStatus ? Number(newStatusId) : undefined,
      changeContainer,
      newContainerId: changeContainer ? newContainerId : undefined,
      changeRoute,
      newRouteRecordId: changeRoute ? newRouteRecordId : undefined,
      statusOptions: barcodeStatusOptions,
      resolveRouteLabel,
      resolveContainerLabel,
    };
  }

  async function submitBarcode(rawBarcode: string) {
    const barcode = rawBarcode.trim();
    if (!barcode) return;

    setFormError(null);
    // Clear immediately so the next scan/Enter is not blocked by in-flight state.
    setBarcodeInput("");
    focusBarcodeInput();

    try {
      const result = await applyScanMutation.mutateAsync({
        barcode,
        options: buildScannerOptions(),
      });
      setResults((current) => [result, ...current]);
      focusBarcodeInput();
    } catch (error) {
      setFormError(toErrorMessage(error));
      focusBarcodeInput();
    }
  }

  function handleBarcodeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // Read from the DOM value — scanner wedges fire Enter before React state catches up.
    void submitBarcode(event.currentTarget.value);
  }

  async function applyBulkBarcodes() {
    const barcodes = bulkBarcodes
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (barcodes.length === 0 || isSubmitting) return;

    setFormError(null);

    try {
      const nextResults = await applyBulkMutation.mutateAsync({
        barcodes,
        options: buildScannerOptions(),
      });
      setResults((current) => [...nextResults.reverse(), ...current]);
      setBulkBarcodes("");
      focusBarcodeInput();
    } catch (error) {
      setFormError(toErrorMessage(error));
      focusBarcodeInput();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("labels.title")} description={t("labels.pages.description")} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("labels.updater.options.title")}</CardTitle>
          <CardDescription>{t("labels.updater.options.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid items-start gap-6 sm:grid-cols-3">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={changeStatus}
                  onChange={(event) => setChangeStatus(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                {t("labels.updater.options.changeStatus")}
              </label>
              {changeStatus ? (
                <div className="space-y-2">
                  <Label htmlFor="newStatus">{t("labels.updater.options.newStatus")}</Label>
                  <SearchableSelect
                    id="newStatus"
                    value={newStatusId}
                    onValueChange={setNewStatusId}
                    searchPlaceholder={t("labels.updater.search.statuses")}
                    options={barcodeStatusOptions.map((option) => ({
                      value: String(option.id),
                      label: option.label,
                      keywords: [option.name],
                    }))}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={changeContainer}
                  onChange={(event) => setChangeContainer(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                {t("labels.updater.options.changeContainer")}
              </label>
              {changeContainer ? (
                <div className="space-y-2">
                  <Label htmlFor="newContainer">{t("labels.updater.options.newContainer")}</Label>
                  <SearchableSelect
                    id="newContainer"
                    value={newContainerId}
                    onValueChange={setNewContainerId}
                    searchPlaceholder={t("labels.updater.search.containers")}
                    options={containers.map((container) => ({
                      value: String(container.id),
                      label: formatContainerLabel(container),
                    }))}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={changeRoute}
                  onChange={(event) => setChangeRoute(event.target.checked)}
                  className="size-4 rounded border-input"
                />
                {t("labels.updater.options.changeRoute")}
              </label>
              {changeRoute ? (
                <div className="space-y-2">
                  <Label htmlFor="newRoute">{t("labels.updater.options.newRoute")}</Label>
                  <SearchableSelect
                    id="newRoute"
                    value={newRouteRecordId}
                    onValueChange={setNewRouteRecordId}
                    searchPlaceholder={t("labels.updater.search.routes")}
                    options={routeOptions}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="barcodeInput">{t("labels.updater.options.barcodeLabel")}</Label>
            <div className="flex gap-2">
              <Input
                id="barcodeInput"
                ref={barcodeInputRef}
                value={barcodeInput}
                onChange={(event) => setBarcodeInput(event.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder={t("labels.updater.options.barcodePlaceholder")}
                className="font-mono text-sm"
                autoComplete="off"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                disabled={isSubmitting}
                onClick={() => void submitBarcode(barcodeInput)}
              >
                <ScanBarcode className="h-4 w-4" />
                {t("labels.updater.options.apply")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("labels.updater.options.barcodeHint")}</p>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulkBarcodes">{t("labels.updater.options.bulkLabel")}</Label>
            <textarea
              id="bulkBarcodes"
              value={bulkBarcodes}
              onChange={(event) => setBulkBarcodes(event.target.value)}
              rows={4}
              disabled={isSubmitting}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50"
              placeholder={t("labels.updater.options.bulkPlaceholder")}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => void applyBulkBarcodes()}
            >
              {t("labels.updater.options.applyAll")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("labels.updater.results.title")}</CardTitle>
          <CardDescription>{t("labels.updater.results.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("labels.updater.results.empty")}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.barcode")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.invoice")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.container")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.prevStatus")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.newStatus")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.prevContainer")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.newContainer")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.prevRoute")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.newRoute")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.dateCreated")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.userCreated")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.dateModified")}</th>
                    <th className="px-3 py-2 font-medium">{t("labels.updater.columns.message")}</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr
                      key={result.id}
                      className={cn(
                        "border-b last:border-0",
                        result.success ? "bg-emerald-500/10" : "bg-destructive/10",
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
                        <ResultCell value={result.previousRoute} />
                      </td>
                      <td className="px-3 py-2">
                        <ResultCell value={result.newRoute} />
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
