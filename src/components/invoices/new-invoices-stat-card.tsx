"use client";

import { useState } from "react";
import { FilePlus2 } from "lucide-react";

import { PeriodChangeDescription } from "@/components/app-shell/period-change-description";
import { PeriodStatCard } from "@/components/app-shell/period-stat-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useNewInvoiceStats } from "@/lib/invoices/hooks/use-invoices";
import {
  DEFAULT_NEW_INVOICE_STAT_PERIOD,
  NEW_INVOICE_STAT_PERIODS,
  isNewInvoiceStatPeriod,
  type NewInvoiceStatPeriod,
} from "@/lib/invoices/new-invoice-stats";
import { useTranslation } from "@/lib/i18n";

export function NewInvoicesStatCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<NewInvoiceStatPeriod>(DEFAULT_NEW_INVOICE_STAT_PERIOD);
  const stats = useNewInvoiceStats(period);

  const periodOptions = NEW_INVOICE_STAT_PERIODS.map((value) => ({
    value,
    label: t(`invoices.stats.new.periods.${value}`),
  }));

  const periodLabel = t(`invoices.stats.new.periods.${period}`);

  return (
    <PeriodStatCard
      description={
        stats.isLoading ? (
          "…"
        ) : (
          <PeriodChangeDescription
            current={stats.total}
            previous={stats.previousTotal}
            periodLabel={periodLabel}
          />
        )
      }
      icon={FilePlus2}
      label={t("invoices.stats.new.label")}
      periodControl={
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
      }
      value={stats.isLoading ? "…" : stats.total.toLocaleString()}
    />
  );
}
