"use client";

import { useState } from "react";
import { DollarSign } from "lucide-react";

import { PeriodStatCard } from "@/components/app-shell/period-stat-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD,
  DEPARTED_CONTAINER_STAT_PERIODS,
  isDepartedContainerStatPeriod,
  type DepartedContainerStatPeriod,
} from "@/lib/containers/departed-container-stats";
import { useAverageContainerValueStats } from "@/lib/containers/hooks/use-containers";
import { useTranslation } from "@/lib/i18n";
import { formatInvoiceMoney } from "@/lib/invoices/display";

export function AverageContainerValueStatCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<DepartedContainerStatPeriod>(
    DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD,
  );
  const stats = useAverageContainerValueStats(period);

  const periodOptions = DEPARTED_CONTAINER_STAT_PERIODS.map((value) => ({
    value,
    label: t(`containers.stats.departed.periods.${value}`),
  }));

  return (
    <PeriodStatCard
      description={
        stats.isLoading
          ? "…"
          : t("containers.stats.averageValue.description", { count: stats.containerCount })
      }
      icon={DollarSign}
      label={t("containers.stats.averageValue.label")}
      periodControl={
        <SearchableSelect
          aria-label={t("containers.stats.averageValue.periodLabel")}
          className="h-8 min-h-8 w-auto border py-0 pl-2 pr-7 text-xs max-md:min-h-8 max-md:rounded-md max-md:text-xs"
          contentClassName="min-w-[7rem]"
          fitToOptions
          options={periodOptions}
          searchable={false}
          value={period}
          onValueChange={(value) => {
            if (isDepartedContainerStatPeriod(value)) setPeriod(value);
          }}
        />
      }
      value={stats.isLoading ? "…" : formatInvoiceMoney(stats.average)}
    />
  );
}
