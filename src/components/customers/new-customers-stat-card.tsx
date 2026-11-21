"use client";

import { useState } from "react";

import { PeriodChangeDescription } from "@/components/app-shell/period-change-description";
import { PeriodInsightCard } from "@/components/app-shell/period-insight-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useNewCustomerStats } from "@/lib/customers/hooks/use-customers";
import {
  DEFAULT_NEW_CUSTOMER_STAT_PERIOD,
  NEW_CUSTOMER_STAT_PERIODS,
  isNewCustomerStatPeriod,
  type NewCustomerStatPeriod,
} from "@/lib/customers/new-customer-stats";
import { useTranslation } from "@/lib/i18n";

export function NewCustomersStatCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<NewCustomerStatPeriod>(DEFAULT_NEW_CUSTOMER_STAT_PERIOD);
  const stats = useNewCustomerStats(period);

  const periodOptions = NEW_CUSTOMER_STAT_PERIODS.map((value) => ({
    value,
    label: t(`customers.stats.new.periods.${value}`),
  }));

  const periodLabel = t(`customers.stats.new.periods.${period}`);

  return (
    <PeriodInsightCard
      description={
        stats.isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : (
          <PeriodChangeDescription
            current={stats.total}
            previous={stats.previousTotal}
            periodLabel={periodLabel}
          />
        )
      }
      label={t("customers.stats.new.label")}
      periodControl={
        <SearchableSelect
          aria-label={t("customers.stats.new.periodLabel")}
          className="h-8 min-h-8 w-auto border bg-background py-0 pl-2 pr-7 text-xs"
          contentClassName="min-w-[7rem]"
          fitToOptions
          options={periodOptions}
          searchable={false}
          value={period}
          onValueChange={(value) => {
            if (isNewCustomerStatPeriod(value)) setPeriod(value);
          }}
        />
      }
      value={stats.isLoading ? "…" : stats.total.toLocaleString()}
    />
  );
}