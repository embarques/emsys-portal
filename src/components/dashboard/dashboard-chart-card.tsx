"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DashboardBarChart,
  type DashboardBarSeries,
} from "@/components/dashboard/dashboard-bar-chart";

type DashboardChartCardProps = {
  title: string;
  description: string;
  allTimeLabel: string;
  truncatedLabel?: string;
  errorLabel: string;
  retryLabel?: string;
  onRetry?: () => void;
  emptyLabel: string;
  categories: string[];
  series: DashboardBarSeries[];
  isLoading: boolean;
  isError: boolean;
  legend?: DashboardBarSeries[];
};

export function DashboardChartCard({
  title,
  description,
  allTimeLabel,
  truncatedLabel,
  errorLabel,
  retryLabel,
  onRetry,
  emptyLabel,
  categories,
  series,
  isLoading,
  isError,
  legend,
}: DashboardChartCardProps) {
  const legendItems = legend ?? (series.length > 1 ? series : []);

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {allTimeLabel}
          </span>
        </div>
        <CardDescription>{description}</CardDescription>
        {truncatedLabel ? (
          <p className="text-xs text-muted-foreground">{truncatedLabel}</p>
        ) : null}
      </CardHeader>
      <CardContent className="px-5">
        <DashboardBarChart
          categories={categories}
          series={series}
          isLoading={isLoading}
          isError={isError}
          errorLabel={errorLabel}
          retryLabel={retryLabel}
          onRetry={onRetry}
          emptyLabel={emptyLabel}
        />
        {legendItems.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {legendItems.map((item) => (
              <li key={item.key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${item.barClassName}`} />
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
