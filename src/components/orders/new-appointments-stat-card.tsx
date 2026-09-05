"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div style={{ height: 158 }}>
      <Card className="relative h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
            {t("orders.stats.new.label")}
          </CardTitle>
          <CalendarPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pr-28">
          <div className="text-2xl font-bold">
            {stats.isLoading ? "…" : stats.total.toLocaleString()}
          </div>
          <CardDescription className="mt-1">
            {t(`orders.stats.new.descriptions.${period}`)}
          </CardDescription>
        </CardContent>
        <div
          className="absolute bottom-4 right-4"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
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
        </div>
      </Card>
    </div>
  );
}
