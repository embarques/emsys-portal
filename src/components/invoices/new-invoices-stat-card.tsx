"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useNewInvoiceStats } from "@/lib/invoices/hooks/use-invoices";
import {
  DEFAULT_NEW_INVOICE_STAT_PERIOD,
  NEW_INVOICE_STAT_PERIODS,
  isNewInvoiceStatPeriod,
  type NewInvoiceStatPeriod,
} from "@/lib/invoices/new-invoice-stats";
import { useTranslation } from "@/lib/i18n";
import { formatPeriodChangeDescription } from "@/lib/stats/rolling-period";

export function NewInvoicesStatCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<NewInvoiceStatPeriod>(DEFAULT_NEW_INVOICE_STAT_PERIOD);
  const stats = useNewInvoiceStats(period);

  const periodOptions = NEW_INVOICE_STAT_PERIODS.map((value) => ({
    value,
    label: t(`invoices.stats.new.periods.${value}`),
  }));

  const periodLabel = t(`invoices.stats.new.periods.${period}`);
  const changeDescription = formatPeriodChangeDescription(
    stats.total,
    stats.previousTotal,
    periodLabel,
    t,
  );

  return (
    <div style={{ height: 158 }}>
      <Card className="relative h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
            {t("invoices.stats.new.label")}
          </CardTitle>
          <FilePlus2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pr-28">
          <div className="text-2xl font-bold">
            {stats.isLoading ? "…" : stats.total.toLocaleString()}
          </div>
          <CardDescription className="mt-1">
            {stats.isLoading ? "…" : changeDescription}
          </CardDescription>
        </CardContent>
        <div
          className="absolute bottom-4 right-4"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <SearchableSelect
            aria-label={t("invoices.stats.new.periodLabel")}
            className="h-8 min-h-8 w-auto border py-0 pl-2 pr-7 text-xs max-md:min-h-8 max-md:rounded-md max-md:text-xs"
            contentClassName="min-w-[7rem]"
            fitToOptions
            options={periodOptions}
            searchable={false}
            value={period}
            onValueChange={(value) => {
              if (isNewInvoiceStatPeriod(value)) setPeriod(value);
            }}
          />
        </div>
      </Card>
    </div>
  );
}
