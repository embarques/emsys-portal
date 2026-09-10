"use client";

import { useTranslation } from "@/lib/i18n";
import {
  formatPeriodChangeDescription,
  resolvePeriodChange,
  type PeriodChangeKind,
} from "@/lib/stats/rolling-period";
import { cn } from "@/lib/utils";

type PeriodChangeDescriptionProps = {
  current: number;
  previous: number;
  periodLabel: string;
};

function periodChangeTextClass(kind: PeriodChangeKind): string | undefined {
  switch (kind) {
    case "more":
    case "fromZero":
      return "text-emerald-600 dark:text-emerald-400";
    case "less":
      return "text-rose-600 dark:text-rose-400";
    case "same":
      return undefined;
  }
}

/** Signed percent vs the previous rolling window; green for up, red for down. */
export function PeriodChangeDescription({
  current,
  previous,
  periodLabel,
}: PeriodChangeDescriptionProps) {
  const { t } = useTranslation();
  const change = resolvePeriodChange(current, previous);

  return (
    <span className={cn(periodChangeTextClass(change.kind))}>
      {formatPeriodChangeDescription(current, previous, periodLabel, t)}
    </span>
  );
}
