"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";

import { PageHeader } from "@/components/app-shell/page-header";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { getStatusBadgeClass, getStatusLabel } from "@/lib/inventory/display";
import { useInventoryItems, useInventoryRecipients, useInventorySnapshotData } from "@/lib/inventory/hooks/use-inventory";

export function InventoryReportsWorkspace() {
  const { t } = useTranslation();
  const { data: items = [] } = useInventoryItems();
  const { data: recipients = [] } = useInventoryRecipients();
  const snapshot = useInventorySnapshotData();

  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterItemId, setFilterItemId] = useState("all");
  const [filterRecipientId, setFilterRecipientId] = useState("all");

  const stockOnHand = useMemo(() => {
    return items
      .filter((item) => filterItemId === "all" || item.id === filterItemId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit: item.unit,
        status: item.status,
        reorderLevel: item.reorderLevel,
      }));
  }, [filterItemId, items]);

  const dispatchSummary = useMemo(() => {
    const asOf = new Date(`${asOfDate}T23:59:59`).getTime();
    const grouped = new Map<string, { name: string; count: number; quantity: number }>();

    for (const dispatch of snapshot.dispatches) {
      if (new Date(dispatch.dispatchDate).getTime() > asOf) continue;
      if (filterRecipientId !== "all" && dispatch.recipientId !== filterRecipientId) continue;

      const lines = snapshot.dispatchLines.filter((line) => line.dispatchId === dispatch.id);
      const filteredLines =
        filterItemId === "all" ? lines : lines.filter((line) => line.itemId === filterItemId);
      if (filteredLines.length === 0) continue;

      const recipient = recipients.find((entry) => entry.id === dispatch.recipientId);
      const key = dispatch.recipientId;
      const current = grouped.get(key) ?? { name: recipient?.name ?? key, count: 0, quantity: 0 };
      current.count += 1;
      current.quantity += filteredLines.reduce((sum, line) => sum + line.quantity, 0);
      grouped.set(key, current);
    }

    return Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity);
  }, [asOfDate, filterItemId, filterRecipientId, recipients, snapshot.dispatchLines, snapshot.dispatches]);

  const lowStockAlerts = useMemo(
    () => items.filter((item) => item.quantity - item.reserved <= item.reorderLevel),
    [items],
  );

  const itemOptions = [
    { value: "all", label: t("inventory.reports.filters.allItems") },
    ...items.map((item) => ({ value: item.id, label: `${item.sku} — ${item.name}` })),
  ];

  const recipientOptions = [
    { value: "all", label: t("inventory.reports.filters.allRecipients") },
    ...recipients.map((recipient) => ({ value: recipient.id, label: recipient.name })),
  ];

  return (
    <div>
      <PageHeader
        title={t("inventory.reports.title")}
        description={t("inventory.pages.reports")}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t("inventory.reports.filters.dateFrom")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="asOfDate">{t("inventory.reports.filters.dateTo")}</Label>
            <Input id="asOfDate" type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("inventory.reports.filters.item")}</Label>
            <SearchableSelect
              value={filterItemId}
              onValueChange={setFilterItemId}
              options={itemOptions}
              searchPlaceholder={t("inventory.search.items")}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("inventory.reports.filters.recipient")}</Label>
            <SearchableSelect
              value={filterRecipientId}
              onValueChange={setFilterRecipientId}
              options={recipientOptions}
              searchPlaceholder={t("inventory.search.recipients")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="gap-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              {t("inventory.reports.stockOnHand")}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {stockOnHand.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t("inventory.empty.reports")}</p>
            ) : (
              stockOnHand.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">{item.sku}</div>
                  </div>
                  <div className="text-right">
                    <div>
                      {item.quantity} {item.unit}
                    </div>
                    <TableTagText className={getStatusBadgeClass(item.status)}>
                      {getStatusLabel(item.status)}
                    </TableTagText>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="gap-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">{t("inventory.reports.dispatchSummary")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {dispatchSummary.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">{t("inventory.empty.reports")}</p>
            ) : (
              dispatchSummary.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="font-medium">{entry.name}</div>
                  <div className="text-right text-muted-foreground">
                    {entry.count} dispatches · {entry.quantity} units
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 gap-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">{t("inventory.reports.lowStockAlerts")}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {lowStockAlerts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("inventory.reports.noLowStock")}</p>
          ) : (
            lowStockAlerts.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {t("inventory.columns.reorderLevel")}: {item.reorderLevel} {item.unit}
                  </div>
                </div>
                <div className="font-medium text-amber-700 dark:text-amber-300">
                  {item.quantity} {item.unit}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
