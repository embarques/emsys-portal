"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { PeriodChangeDescription } from "@/components/app-shell/period-change-description";
import { PeriodStatCard } from "@/components/app-shell/period-stat-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useNewOrderStats } from "@/lib/orders/hooks/use-orders";
import {
  DEFAULT_NEW_ORDER_STAT_PERIOD,
  NEW_ORDER_STAT_PERIODS,
  isNewOrderStatPeriod,
  type NewOrderStatPeriod,
} from "@/lib/orders/new-order-stats";
import { useTranslation } from "@/lib/i18n";

export function NewAppointmentsStatCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<NewOrderStatPeriod>(DEFAULT_NEW_ORDER_STAT_PERIOD);
  const stats = useNewOrderStats(period);

  const periodOptions = NEW_ORDER_STAT_PERIODS.map((value) => ({
    value,
    label: t(`orders.stats.new.periods.${value}`),
  }));

  const periodLabel = t(`orders.stats.new.periods.${period}`);

  return (
    <PeriodStatCard
      description={
        stats.isLoading ? (
          "…"
        ) : stats.isError ? (
          <span className="text-destructive">{t("orders.stats.new.error")}</span>
        ) : (
          <PeriodChangeDescription
            current={stats.total}
            previous={stats.previousTotal}
            periodLabel={periodLabel}
          />
        )
      }
      icon={CalendarPlus}
      label={t("orders.stats.new.label")}
      periodControl={
        <SearchableSelect
          aria-label={t("orders.stats.new.periodLabel")}
          className="h-8 min-h-8 w-auto border py-0 pl-2 pr-7 text-xs max-md:min-h-8 max-md:rounded-md max-md:text-xs"
          contentClassName="min-w-[7rem]"
          fitToOptions
          options={periodOptions}
          searchable={false}
          value={period}
          onValueChange={(value) => {
            if (isNewOrderStatPeriod(value)) setPeriod(value);
          }}
        />
      }
      value={stats.isLoading ? "…" : stats.isError ? "—" : stats.total.toLocaleString()}
    />
  );
}
