"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card className="h-[158px]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-2 pb-2">
        <CardTitle className="min-w-0 text-sm font-medium text-muted-foreground">
          {t("customers.stats.new.label")}
        </CardTitle>
        <div
          className="flex shrink-0 items-center gap-2"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <SearchableSelect
            aria-label={t("customers.stats.new.periodLabel")}
            className="h-8 min-h-8 w-auto border py-0 pl-2 pr-7 text-xs max-md:min-h-8 max-md:rounded-md max-md:text-xs"
            contentClassName="min-w-[7rem]"
            fitToOptions
            options={periodOptions}
            searchable={false}
            value={period}
            onValueChange={(value) => {
              if (isNewCustomerStatPeriod(value)) setPeriod(value);
            }}
          />
          <UserPlus className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {stats.isLoading ? "…" : stats.total.toLocaleString()}
        </div>
        <CardDescription className="mt-1">
          {t(`customers.stats.new.descriptions.${period}`)}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
