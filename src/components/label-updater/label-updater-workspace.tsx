"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Container as ContainerIcon, Loader2, Route as RouteIcon, ScanBarcode, Tag } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { BarcodeStatusesButton } from "@/components/barcodes/barcode-statuses-button";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import {
  CompactTableScroll,
  compactTableCaptionClassName,
  compactTableCellClassName,
  compactTableCellWrapClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
} from "@/components/ui/compact-table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatContainerLabel } from "@/lib/containers/display";
import { useContainerPicker } from "@/lib/containers/hooks/use-containers";
import { useUserError } from "@/lib/errors";
import { useApplyBarcodeScan, useApplyBarcodeScanBulk } from "@/lib/labels/hooks/use-label-updater";
import { useBarcodeStatusOptions } from "@/lib/labels/hooks/use-label-display";
import { isProtectedBarcodeStatusId, type LabelUpdateResult } from "@/lib/labels/types";
import { useTranslation } from "@/lib/i18n";
import { useApplyCreatedOnTabReturn } from "@/lib/layout/hooks/use-apply-created-on-tab-return";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import {
  getWorkspaceTabTopAccentStyle,
  WORKSPACE_TAB_SECTION_COLORS,
} from "@/lib/layout/workspace-tab-colors";
import {
  DAILY_ROUTES_DIRECTORY_VARIANT,
  DELIVERY_BRANCH_CODE,
} from "@/lib/pickup-delivery-routes/directory-variant";
import { formatActiveRouteAssignmentLabel } from "@/lib/pickup-delivery-routes/display";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import { isAssignableRouteDate } from "@/lib/pickup-delivery-routes/assignment-policy";
import { isDeliveryBranchCode } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

const UPDATER_TAB_ACCENT = WORKSPACE_TAB_SECTION_COLORS.barcodes;

function ResultCell({ value }: { value?: string | number }) {
  const { t } = useTranslation();
  if (value === undefined || value === "") {
    return <span className="text-muted-foreground">{t("common.empty.dash")}</span>;
  }
  return <span>{value}</span>;
}

const RESULTS_COLUMNS = [
  "barcode",
  "invoice",
  "container",
  "prevStatus",
  "newStatus",
  "prevContainer",
  "newContainer",
  "prevRoute",
  "newRoute",
  "updatedAt",
  "updatedBy",
  "message",
] as const;

type UpdaterPanel = "update" | "statuses";

function parseBarcodeEntries(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function LabelUpdaterWorkspace() {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const { openTab, openFormTab } = useWorkspaceTabs();
  const barcodeStatusOptions = useBarcodeStatusOptions();
  const { data: containersData } = useContainerPicker();
  const containers = useMemo(() => containersData?.items ?? [], [containersData?.items]);
  const { data: routesData } = useDailyRoutePicker(200, {
    branchCode: DELIVERY_BRANCH_CODE,
    routeType: "delivery",
    assignable: true,
  });
  const routes = useMemo(
    () =>
      (routesData?.items ?? []).filter(
        (route) =>
          isAssignableRouteDate(route.date) && isDeliveryBranchCode(route.branch?.code),
      ),
    [routesData?.items],
  );
  const applyScanMutation = useApplyBarcodeScan();
  const applyBulkMutation = useApplyBarcodeScanBulk();
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const submissionInFlight = useRef(false);

  const [newStatusId, setNewStatusId] = useState("");
  const [newContainerId, setNewContainerId] = useState("");
  const [newRouteRecordId, setNewRouteRecordId] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [results, setResults] = useState<LabelUpdateResult[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<UpdaterPanel>("update");

  const changeStatus = Boolean(newStatusId.trim());
  const changeContainer = Boolean(newContainerId.trim());
  const changeRoute = Boolean(newRouteRecordId.trim());

  const selectedStatus = useMemo(
    () => barcodeStatusOptions.find((entry) => String(entry.id) === newStatusId) ?? null,
    [barcodeStatusOptions, newStatusId],
  );
  const selectedContainer = useMemo(
    () => containers.find((entry) => String(entry.id) === newContainerId) ?? null,
    [containers, newContainerId],
  );
  const selectedRoute = useMemo(
    () => routes.find((entry) => entry.id === newRouteRecordId) ?? null,
    [routes, newRouteRecordId],
  );
  const canEditSelectedStatus = Boolean(
    selectedStatus && !isProtectedBarcodeStatusId(selectedStatus.id),
  );
  const { markPendingAdd } = useApplyCreatedOnTabReturn((feature, id) => {
    if (feature === "containers") {
      setNewContainerId(id);
      return;
    }
    if (feature === DAILY_ROUTES_DIRECTORY_VARIANT.formFeature) {
      setNewRouteRecordId(id);
    }
  });

  const isSubmitting = applyScanMutation.isPending || applyBulkMutation.isPending;
  const resultsTabEnabled = results.length > 0;
  const showUpdatePanel = activePanel === "update";
  const showStatusesPanel = activePanel === "statuses" && resultsTabEnabled;
  const updaterTabs: UpdaterPanel[] = ["update", "statuses"];

  useEffect(() => {
    if (activePanel === "statuses" && !resultsTabEnabled) {
      setActivePanel("update");
    }
  }, [activePanel, resultsTabEnabled]);

  const routeOptions = useMemo(
    () =>
      routes.map((route) => ({
        value: route.id,
        label: formatActiveRouteAssignmentLabel(route, t),
        keywords: [route.name, route.container?.name, route.date].filter(
          (entry): entry is string => Boolean(entry?.trim()),
        ),
      })),
    [routes, t],
  );

  useEffect(() => {
    if (!showUpdatePanel) return;
    barcodeInputRef.current?.focus();
  }, [showUpdatePanel]);

  function focusBarcodeField() {
    requestAnimationFrame(() => {
      barcodeInputRef.current?.focus();
    });
  }

  function resolveRouteLabel(routeRecordId: string): string {
    const route = routes.find((entry) => entry.id === routeRecordId);
    return route ? formatActiveRouteAssignmentLabel(route, t) : routeRecordId;
  }

  function resolveContainerLabel(containerId: string): string {
    const container = containers.find((entry) => String(entry.id) === containerId);
    return container ? formatContainerLabel(container) : containerId;
  }

  function openNewStatus() {
    openTab("/barcode-statuses", t("navigation.items.barcodeStatuses"));
  }

  function openEditStatus() {
    if (!canEditSelectedStatus) return;
    openTab("/barcode-statuses", t("navigation.items.barcodeStatuses"));
  }

  function openNewContainer() {
    markPendingAdd("containers");
    openFormTab({
      feature: "containers",
      baseHref: "/containers",
      mode: "add",
      label: t("containers.actions.add"),
      closeOnSave: true,
    });
  }

  function openEditContainer() {
    if (!selectedContainer) return;
    openFormTab({
      feature: "containers",
      baseHref: "/containers",
      mode: "edit",
      entityId: String(selectedContainer.id),
      label: t("containers.actions.editNamed", { name: selectedContainer.name }),
    });
  }

  function openNewRoute() {
    markPendingAdd(DAILY_ROUTES_DIRECTORY_VARIANT.formFeature);
    openFormTab({
      feature: DAILY_ROUTES_DIRECTORY_VARIANT.formFeature,
      baseHref: DAILY_ROUTES_DIRECTORY_VARIANT.baseHref,
      mode: "add",
      label: t("routes.dailyRoutes.addTabLabel"),
      closeOnSave: true,
    });
  }

  function openEditRoute() {
    if (!selectedRoute) return;
    openFormTab({
      feature: DAILY_ROUTES_DIRECTORY_VARIANT.formFeature,
      baseHref: DAILY_ROUTES_DIRECTORY_VARIANT.baseHref,
      mode: "edit",
      entityId: selectedRoute.id,
      label: t("routes.dailyRoutes.editTabLabel", {
        name: formatActiveRouteAssignmentLabel(selectedRoute, t),
      }),
    });
  }

  function buildScannerOptions() {
    return {
      changeStatus,
      newStatusId: changeStatus ? Number(newStatusId) : undefined,
      changeContainer,
      newContainerId: changeContainer ? newContainerId : undefined,
      changeRoute,
      newRouteRecordId: changeRoute ? newRouteRecordId : undefined,
      newRouteDate: changeRoute ? routes.find(route => route.id === newRouteRecordId)?.date : undefined,
      newRouteBranchId: changeRoute ? routes.find(route => route.id === newRouteRecordId)?.branch?.id : undefined,
      statusOptions: barcodeStatusOptions,
      resolveRouteLabel,
      resolveContainerLabel,
    };
  }

  /** Switch to Barcode Changes after Apply returns rows (success or failure). */
  function revealStatusesPanelOnApplyResult(nextResults: LabelUpdateResult[]): boolean {
    if (nextResults.length === 0) return false;
    setActivePanel("statuses");
    return true;
  }

  async function applyBarcodes(rawValue: string) {
    const barcodes = parseBarcodeEntries(rawValue);
    if (barcodes.length === 0 || isSubmitting || submissionInFlight.current) return;

    submissionInFlight.current = true;
    setFormError(null);

    try {
      if (barcodes.length === 1) {
        const result = await applyScanMutation.mutateAsync({
          barcode: barcodes[0],
          options: buildScannerOptions(),
        });
        setResults((current) => [result, ...current]);
        if (result.success) setBarcodeInput("");
        revealStatusesPanelOnApplyResult([result]);
        return;
      }

      const nextResults = await applyBulkMutation.mutateAsync({
        barcodes,
        options: buildScannerOptions(),
      });
      setResults((current) => [...nextResults.reverse(), ...current]);
      setBarcodeInput("");
      revealStatusesPanelOnApplyResult(nextResults);
    } catch (error) {
      setFormError(toErrorMessage(error));
      focusBarcodeField();
    } finally {
      submissionInFlight.current = false;
    }
  }

  function handleBarcodeKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    // IME composition uses Enter to confirm candidates — do not submit mid-composition.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    // Read from the DOM value — scanner wedges fire Enter before React state catches up.
    void applyBarcodes(event.currentTarget.value);
  }

  return (
    <div>
      <PageHeader
        title={t("labels.title")}
        description={t("labels.pages.description")}
        actions={<BarcodeStatusesButton />}
      />

      <div
        className={cn(
          "mt-6 flex flex-col",
          showStatusesPanel && "min-h-[min(70vh,42rem)]",
        )}
      >
        {/* Outer -mb-px overlaps the card; overflow stays on the inner row so it does not clip the seam. */}
        <div className="relative z-10 -mb-px">
          <div
            role="tablist"
            aria-label={t("labels.updater.panels.ariaLabel")}
            className="flex shrink-0 items-end gap-0 overflow-x-auto"
          >
            {updaterTabs.map((tab, index) => {
              const selected = activePanel === tab && (tab === "update" || resultsTabEnabled);
              const disabled = tab === "statuses" && !resultsTabEnabled;
              const label = t(
                tab === "update"
                  ? "labels.updater.options.title"
                  : "labels.updater.results.title",
              );
              const topAccentStyle = getWorkspaceTabTopAccentStyle(
                UPDATER_TAB_ACCENT,
                selected,
              );
              return (
                <button
                  key={tab}
                  id={`label-updater-tab-${tab}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-disabled={disabled || undefined}
                  disabled={disabled}
                  title={disabled ? t("labels.updater.results.disabledHint") : label}
                  tabIndex={disabled ? -1 : selected ? 0 : -1}
                  aria-controls={disabled ? undefined : `label-updater-panel-${tab}`}
                  onKeyDown={(event) => {
                    if (disabled) return;
                    let next: UpdaterPanel | undefined;
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      next = tab === "update"
                        ? resultsTabEnabled
                          ? "statuses"
                          : undefined
                        : "update";
                    }
                    if (event.key === "Home") next = "update";
                    if (event.key === "End") next = resultsTabEnabled ? "statuses" : "update";
                    if (next) {
                      event.preventDefault();
                      setActivePanel(next);
                      document.getElementById(`label-updater-tab-${next}`)?.focus();
                    }
                  }}
                  onClick={() => {
                    if (disabled) return;
                    setActivePanel(tab);
                  }}
                  className={cn(
                    "group relative mr-1 flex min-w-0 max-w-[min(100%,28rem)] shrink-0 items-center overflow-hidden rounded-t-lg border px-3 py-2 text-left text-sm transition",
                    selected
                      ? "z-10 border-border border-b-card bg-card font-medium text-foreground shadow-[0_1px_0_0_var(--card),0_-1px_4px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_0_0_var(--card),0_-1px_4px_rgba(0,0,0,0.25)]"
                      : "border-transparent border-b-transparent bg-muted/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    disabled &&
                      "cursor-not-allowed opacity-50 hover:bg-muted/50 hover:text-muted-foreground",
                  )}
                >
                  {topAccentStyle ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 top-0"
                      style={topAccentStyle}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "mr-1.5 shrink-0 tabular-nums",
                      selected ? "font-semibold text-primary" : "text-muted-foreground",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Card
          className={cn(
            "relative z-0 gap-0 overflow-hidden rounded-t-none py-0 shadow-sm",
            showStatusesPanel && "min-h-0 flex-1 rounded-b-lg",
          )}
        >
        {showUpdatePanel ? (
          <div
            role="tabpanel"
            id="label-updater-panel-update"
            aria-labelledby="label-updater-tab-update"
          >
            <div className="space-y-6 px-6 py-6 pb-8">
              <p className="text-sm font-medium text-foreground">
                {t("labels.updater.options.instruction")}
              </p>

              <div className="flex w-full flex-col gap-4">
                <div className="grid w-full items-start gap-4 sm:grid-cols-3">
                  <FormSection
                    variant="card"
                    className="min-w-0"
                    icon={Tag}
                    title={t("labels.updater.options.newStatus")}
                    action={(
                      <FieldEntityActions
                        onAdd={openNewStatus}
                        onEdit={canEditSelectedStatus ? openEditStatus : undefined}
                        hasSelection={Boolean(selectedStatus)}
                        addIcon={Tag}
                      />
                    )}
                  >
                    <SearchableSelect
                      id="newStatus"
                      value={newStatusId}
                      onValueChange={setNewStatusId}
                      wrapLabels
                      placeholder={t("labels.updater.options.statusPlaceholder")}
                      searchPlaceholder={t("labels.updater.search.statuses")}
                      aria-label={t("labels.updater.options.newStatus")}
                      options={[
                        { value: "", label: t("labels.updater.options.statusPlaceholder") },
                        ...barcodeStatusOptions.map((option) => ({
                          value: String(option.id),
                          label: option.label,
                          keywords: [option.name],
                        })),
                      ]}
                    />
                  </FormSection>

                  <FormSection
                    variant="card"
                    className="min-w-0"
                    icon={ContainerIcon}
                    title={t("labels.updater.options.newContainer")}
                    action={(
                      <FieldEntityActions
                        onAdd={openNewContainer}
                        onEdit={selectedContainer ? openEditContainer : undefined}
                        hasSelection={Boolean(selectedContainer)}
                        addIcon={ContainerIcon}
                      />
                    )}
                  >
                    <SearchableSelect
                      id="newContainer"
                      value={newContainerId}
                      onValueChange={setNewContainerId}
                      wrapLabels
                      placeholder={t("labels.updater.options.containerPlaceholder")}
                      searchPlaceholder={t("labels.updater.search.containers")}
                      aria-label={t("labels.updater.options.newContainer")}
                      options={[
                        { value: "", label: t("labels.updater.options.containerPlaceholder") },
                        ...containers.map((container) => ({
                          value: String(container.id),
                          label: formatContainerLabel(container),
                          keywords: [container.name, container.containerNumber, container.booking],
                        })),
                      ]}
                    />
                  </FormSection>

                  <FormSection
                    variant="card"
                    className="min-w-0"
                    icon={RouteIcon}
                    title={t("labels.updater.options.newRoute")}
                    action={(
                      <FieldEntityActions
                        onAdd={openNewRoute}
                        onEdit={selectedRoute ? openEditRoute : undefined}
                        hasSelection={Boolean(selectedRoute)}
                        addIcon={RouteIcon}
                      />
                    )}
                  >
                    <SearchableSelect
                      id="newRoute"
                      value={newRouteRecordId}
                      onValueChange={setNewRouteRecordId}
                      wrapLabels
                      placeholder={t("labels.updater.options.routePlaceholder")}
                      searchPlaceholder={t("labels.updater.search.routes")}
                      aria-label={t("labels.updater.options.newRoute")}
                      options={[
                        { value: "", label: t("labels.updater.options.routePlaceholder") },
                        ...routeOptions,
                      ]}
                    />
                  </FormSection>
                </div>

                <FormSection
                  variant="card"
                  className="w-full border-primary/20 bg-primary/5 shadow-none"
                  icon={ScanBarcode}
                  title={t("labels.updater.options.apply")}
                >
                  <p
                    id="barcodeInput-hint"
                    className="text-sm leading-relaxed text-muted-foreground"
                  >
                    {t("labels.updater.options.barcodeHint")}
                  </p>
                  <div className="space-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Label htmlFor="barcodeInput" className="sr-only">
                        {t("labels.updater.options.barcodeLabel")}
                      </Label>
                      <Input
                        id="barcodeInput"
                        ref={barcodeInputRef}
                        value={barcodeInput}
                        onChange={(event) => setBarcodeInput(event.target.value)}
                        onKeyDown={handleBarcodeKeyDown}
                        placeholder={t("labels.updater.options.barcodePlaceholder")}
                        className="min-w-[12rem] flex-1 border-2 border-foreground/60 bg-card font-mono text-sm shadow-sm"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        aria-describedby="barcodeInput-hint"
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        className="shrink-0"
                        disabled={isSubmitting}
                        aria-busy={isSubmitting}
                        onClick={() => void applyBarcodes(barcodeInput)}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ScanBarcode className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span role="status">
                          {t(
                            isSubmitting
                              ? "labels.updater.options.applying"
                              : "labels.updater.options.apply",
                          )}
                        </span>
                      </Button>
                    </div>

                    {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                  </div>
                </FormSection>
              </div>
            </div>
          </div>
        ) : null}

        {showStatusesPanel ? (
          <div
            role="tabpanel"
            id="label-updater-panel-statuses"
            aria-labelledby="label-updater-tab-statuses"
            className="flex min-h-0 flex-1 flex-col"
          >
            {results.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {t("labels.updater.results.empty")}
              </p>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <CompactTableScroll
                  aria-labelledby="label-updater-results-caption"
                  className="min-h-0 flex-1"
                >
                  <table className={compactTableClassName}>
                    <thead>
                      <tr className={compactTableHeadRowClassName}>
                        {RESULTS_COLUMNS.map((key) => (
                          <th key={key} className={compactTableHeadClassName}>
                            {t(`labels.updater.columns.${key}`)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((result) => (
                        <tr
                          key={result.id}
                          className={cn(
                            "border-b last:border-b-0",
                            result.success ? "bg-emerald-500/10" : "bg-destructive/10",
                          )}
                        >
                          <td className={cn(compactTableCellClassName, "font-mono font-medium")}>
                            {result.barcode}
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.invoiceNumber} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.container} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.previousStatus} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.newStatus} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.previousContainer} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.newContainer} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.previousRoute} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.newRoute} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.dateTime} />
                          </td>
                          <td className={compactTableCellClassName}>
                            <ResultCell value={result.createdBy} />
                          </td>
                          <td
                            className={cn(
                              compactTableCellWrapClassName,
                              "min-w-[16rem] max-w-[28rem]",
                            )}
                          >
                            {result.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CompactTableScroll>
                <p id="label-updater-results-caption" className={compactTableCaptionClassName}>
                  {t("labels.updater.results.description")}
                </p>
              </div>
            )}
          </div>
        ) : null}
        </Card>
      </div>
    </div>
  );
}
