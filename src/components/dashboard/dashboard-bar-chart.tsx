"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardBarSeries = {
  key: string;
  label: string;
  values: number[];
  barClassName: string;
};

type DashboardBarChartProps = {
  categories: string[];
  series: DashboardBarSeries[];
  isLoading?: boolean;
  isError?: boolean;
  errorLabel: string;
  retryLabel?: string;
  onRetry?: () => void;
  emptyLabel: string;
};

export function DashboardBarChart({
  categories,
  series,
  isLoading = false,
  isError = false,
  errorLabel,
  retryLabel,
  onRetry,
  emptyLabel,
}: DashboardBarChartProps) {
  const maxValue = Math.max(0, ...series.flatMap((item) => item.values));
  const hasValues = maxValue > 0;
  const seriesCount = Math.max(series.length, 1);

  if (isError) {
    return (
      <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">{errorLabel}</p>
        {onRetry && retryLabel ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-end gap-1.5" aria-hidden>
        {categories.map((category, index) => (
          <div key={category} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full animate-pulse rounded-t-sm bg-muted"
              style={{ height: `${36 + ((index * 17) % 48)}%` }}
            />
            <span className="h-3 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (!hasValues) {
    return (
      <p className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="flex items-end gap-1.5" role="img">
      {categories.map((category, categoryIndex) => (
        <div key={category} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="grid w-full gap-0.5 text-center text-[10px] leading-none tabular-nums text-muted-foreground"
            style={{ gridTemplateColumns: `repeat(${seriesCount}, minmax(0, 1fr))` }}
          >
            {series.map((item) => {
              const value = item.values[categoryIndex] ?? 0;
              return (
                <span key={item.key} className="truncate">
                  {value > 0 ? value.toLocaleString() : "\u00a0"}
                </span>
              );
            })}
          </div>
          <div className="flex h-36 w-full items-end gap-0.5">
            {series.map((item) => {
              const value = item.values[categoryIndex] ?? 0;
              const heightPct = maxValue > 0 ? (value / maxValue) * 100 : 0;

              return (
                <div
                  key={item.key}
                  className={cn("min-w-0 flex-1 rounded-t-sm", item.barClassName)}
                  style={{ height: `${Math.max(heightPct, value > 0 ? 3 : 0)}%` }}
                  title={`${category} · ${item.label}: ${value.toLocaleString()}`}
                />
              );
            })}
          </div>
          <span className="max-w-full truncate text-[11px] leading-none text-muted-foreground">
            {category}
          </span>
        </div>
      ))}
    </div>
  );
}
