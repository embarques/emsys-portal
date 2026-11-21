import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PeriodInsightCardProps = {
  label: string;
  value: ReactNode;
  description: ReactNode;
  periodControl: ReactNode;
  className?: string;
};

/** Gradient KPI tile with a timeframe control — matches directory insights chrome. */
export function PeriodInsightCard({
  label,
  value,
  description,
  periodControl,
  className,
}: PeriodInsightCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-gradient-to-br from-teal-500/15 via-teal-500/5 to-transparent p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">{value}</p>
        </div>
        <div
          className="inline-flex shrink-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {periodControl}
        </div>
      </div>
      <div className="mt-3 text-sm">{description}</div>
    </div>
  );
}
