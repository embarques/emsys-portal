"use client";

import { useState } from "react";
import { Ship } from "lucide-react";

import { PeriodStatCard } from "@/components/app-shell/period-stat-card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD,
  DEPARTED_CONTAINER_STAT_PERIODS,
  DEPARTED_CONTAINER_STAT_PERIOD_DAYS,
  isDepartedContainerStatPeriod,
  type DepartedContainerStatPeriod,
} from "@/lib/containers/departed-container-stats";
import { formatDepartedAnnualPace } from "@/lib/containers/display";
import { useDepartedContainerStats } from "@/lib/containers/hooks/use-containers";
import { useTranslation } from "@/lib/i18n";

export function DepartedContainersStatCard() {
  const { t, locale } = useTranslation();
  const [period, setPeriod] = useState<DepartedContainerStatPeriod>(
    DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD,
  );
  const stats = useDepartedContainerStats(period);

  const periodOptions = DEPARTED_CONTAINER_STAT_PERIODS.map((value) => ({
    value,
    label: t(`containers.stats.departed.periods.${value}`),
  }));

  const annualPace = formatDepartedAnnualPace(
    stats.total,
    DEPARTED_CONTAINER_STAT_PERIOD_DAYS[period],
    locale,
  );

  return (
    <PeriodStatCard
      description={
        stats.isLoading ? "…" : t("containers.stats.departed.annualPace", { pace: annualPace })
      }
      icon={Ship}
      label={t("containers.stats.departed.label")}
      periodControl={
        <SearchableSelect
          aria-label={t("containers.stats.departed.periodLabel")}
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
      value={stats.isLoading ? "…" : stats.total.toLocaleString(locale)}
    />
  );
}
