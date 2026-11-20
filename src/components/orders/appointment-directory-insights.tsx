"use client";

import { useMemo, useState } from "react";

import { DirectoryInsightsToggle } from "@/components/app-shell/directory-insights-flip";
import { PeriodChangeDescription } from "@/components/app-shell/period-change-description";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useNewOrderStats } from "@/lib/orders/hooks/use-orders";
import {
  DEFAULT_NEW_ORDER_STAT_PERIOD,
  NEW_ORDER_STAT_PERIODS,
  isNewOrderStatPeriod,
  type NewOrderStatPeriod,
} from "@/lib/orders/new-order-stats";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PendingSliceKey = "pickups" | "takes" | "estimates" | "payments" | "other";

type PendingSlice = {
  key: PendingSliceKey;
  label: string;
  count: number;
  colorClassName: string;
  fillClassName: string;
};

type AppointmentDirectoryInsightsProps = {
  pendingTotal: number;
  pendingPickups: number;
  pendingTakes: number;
  pendingEstimates: number;
  pendingPayments: number;
  isLoading?: boolean;
  onBack: () => void;
};

const SLICE_STYLE: Record<
  Exclude<PendingSliceKey, "other">,
  { colorClassName: string; fillClassName: string }
> = {
  pickups: {
    colorClassName: "text-teal-600 dark:text-teal-400",
    fillClassName: "fill-teal-600 dark:fill-teal-400",
  },
  takes: {
    colorClassName: "text-sky-600 dark:text-sky-400",
    fillClassName: "fill-sky-600 dark:fill-sky-400",
  },
  estimates: {
    colorClassName: "text-amber-600 dark:text-amber-400",
    fillClassName: "fill-amber-600 dark:fill-amber-400",
  },
  payments: {
    colorClassName: "text-violet-600 dark:text-violet-400",
    fillClassName: "fill-violet-600 dark:fill-violet-400",
  },
};

const OTHER_STYLE = {
  colorClassName: "text-muted-foreground",
  fillClassName: "fill-muted-foreground/70",
};

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

/** SVG donut slice path; full circle uses a two-arc path. */
function describeDonutSlice(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number,
) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) return "";
  if (sweep >= 359.999) {
    const outerStart = polarToCartesian(cx, cy, outerRadius, 0);
    const outerMid = polarToCartesian(cx, cy, outerRadius, 180);
    const innerStart = polarToCartesian(cx, cy, innerRadius, 0);
    const innerMid = polarToCartesian(cx, cy, innerRadius, 180);
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerMid.x} ${outerMid.y}`,
      `A ${outerRadius} ${outerRadius} 0 1 1 ${outerStart.x} ${outerStart.y}`,
      `M ${innerStart.x} ${innerStart.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerMid.x} ${innerMid.y}`,
      `A ${innerRadius} ${innerRadius} 0 1 0 ${innerStart.x} ${innerStart.y}`,
      "Z",
    ].join(" ");
  }

  const largeArc = sweep > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function shareOfTotal(count: number, total: number) {
  if (total <= 0 || count <= 0) return 0;
  return (count / total) * 100;
}

function PendingAppointmentsPie({
  slices,
  pendingTotal,
  selectedKey,
  onSelect,
}: {
  slices: PendingSlice[];
  pendingTotal: number;
  selectedKey: PendingSliceKey | null;
  onSelect: (key: PendingSliceKey) => void;
}) {
  const { t } = useTranslation();
  const pieTotal = slices.reduce((sum, slice) => sum + slice.count, 0);
  const selected = slices.find((slice) => slice.key === selectedKey) ?? null;

  let cursor = 0;
  const arcs = slices
    .filter((slice) => slice.count > 0)
    .map((slice) => {
      const startAngle = (cursor / pieTotal) * 360;
      cursor += slice.count;
      const endAngle = (cursor / pieTotal) * 360;
      return { slice, startAngle, endAngle };
    });

  const centerLabel = selected
    ? selected.count.toLocaleString()
    : pendingTotal.toLocaleString();
  const centerCaption = selected
    ? selected.label
    : t("orders.insights.pending.totalLabel");
  const centerShare = selected
    ? t("orders.insights.pending.ofTotal", {
        percent: shareOfTotal(selected.count, pendingTotal).toFixed(1),
      })
    : t("orders.insights.pending.allPending");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-center">
      <div className="relative mx-auto w-full max-w-[14rem]">
        <svg
          viewBox="0 0 200 200"
          className="size-full overflow-visible"
          role="img"
          aria-label={t("orders.insights.pending.chartLabel")}
        >
          <title>{t("orders.insights.pending.chartLabel")}</title>
          {pieTotal <= 0 ? (
            <circle cx="100" cy="100" r="74" className="fill-muted" />
          ) : (
            arcs.map(({ slice, startAngle, endAngle }) => {
              const isSelected = selectedKey === slice.key;
              return (
                <path
                  key={slice.key}
                  d={describeDonutSlice(
                    100,
                    100,
                    isSelected ? 84 : 78,
                    isSelected ? 46 : 50,
                    startAngle,
                    endAngle,
                  )}
                  className={cn(
                    slice.fillClassName,
                    "cursor-pointer outline-none transition-[opacity] duration-200 motion-reduce:transition-none focus-visible:stroke-foreground focus-visible:stroke-2",
                    selectedKey && !isSelected && "opacity-40",
                  )}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={t("orders.insights.pending.sliceLabel", {
                    label: slice.label,
                    count: slice.count,
                    percent: shareOfTotal(slice.count, pendingTotal).toFixed(1),
                  })}
                  onClick={() => onSelect(slice.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(slice.key);
                    }
                  }}
                >
                  <title>
                    {t("orders.insights.pending.sliceLabel", {
                      label: slice.label,
                      count: slice.count,
                      percent: shareOfTotal(slice.count, pendingTotal).toFixed(1),
                    })}
                  </title>
                </path>
              );
            })
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-3xl font-bold tabular-nums tracking-tight">{centerLabel}</p>
          <p className="mt-0.5 line-clamp-2 text-xs font-medium text-muted-foreground">{centerCaption}</p>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">{centerShare}</p>
        </div>
      </div>

      <ul className="space-y-2" role="list">
        {slices.map((slice) => {
          const percent = shareOfTotal(slice.count, pendingTotal);
          const isSelected = selectedKey === slice.key;
          return (
            <li key={slice.key}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  isSelected
                    ? "border-primary/40 bg-primary/5"
                    : "border-transparent bg-muted/40 hover:bg-muted/70",
                )}
                aria-pressed={isSelected}
                onClick={() => onSelect(slice.key)}
              >
                <span className={cn("size-2.5 shrink-0 rounded-full bg-current", slice.colorClassName)} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{slice.label}</span>
                <span className="tabular-nums text-sm font-semibold">{slice.count.toLocaleString()}</span>
                <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
                  {percent.toFixed(1)}%
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <table className="sr-only">
        <caption>{t("orders.insights.pending.chartLabel")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("orders.insights.pending.typeColumn")}</th>
            <th scope="col">{t("orders.insights.pending.countColumn")}</th>
            <th scope="col">{t("orders.insights.pending.shareColumn")}</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={slice.key}>
              <th scope="row">{slice.label}</th>
              <td>{slice.count.toLocaleString()}</td>
              <td>{shareOfTotal(slice.count, pendingTotal).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewAppointmentsInsightCard() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<NewOrderStatPeriod>(DEFAULT_NEW_ORDER_STAT_PERIOD);
  const stats = useNewOrderStats(period);

  const periodOptions = NEW_ORDER_STAT_PERIODS.map((value) => ({
    value,
    label: t(`orders.stats.new.periods.${value}`),
  }));
  const periodLabel = t(`orders.stats.new.periods.${period}`);

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-teal-500/15 via-teal-500/5 to-transparent p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{t("orders.stats.new.label")}</p>
          <p className="text-4xl font-bold tracking-tight tabular-nums">
            {stats.isLoading ? "…" : stats.isError ? "—" : stats.total.toLocaleString()}
          </p>
        </div>
        <SearchableSelect
          aria-label={t("orders.stats.new.periodLabel")}
          className="h-8 min-h-8 w-auto border bg-background py-0 pl-2 pr-7 text-xs"
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
      <div className="mt-3 text-sm">
        {stats.isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : stats.isError ? (
          <span className="text-destructive">{t("orders.stats.new.error")}</span>
        ) : (
          <PeriodChangeDescription
            current={stats.total}
            previous={stats.previousTotal}
            periodLabel={periodLabel}
          />
        )}
      </div>
    </div>
  );
}

/** Insights face for Appointments: pending-purpose pie + period-scoped new appointments. */
export function AppointmentDirectoryInsights({
  pendingTotal,
  pendingPickups,
  pendingTakes,
  pendingEstimates,
  pendingPayments,
  isLoading = false,
  onBack,
}: AppointmentDirectoryInsightsProps) {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<PendingSliceKey | null>(null);

  const slices = useMemo(() => {
    const typed: PendingSlice[] = [
      {
        key: "pickups",
        label: t("orders.stats.pendingPickups.label"),
        count: pendingPickups,
        ...SLICE_STYLE.pickups,
      },
      {
        key: "takes",
        label: t("orders.stats.pendingTakes.label"),
        count: pendingTakes,
        ...SLICE_STYLE.takes,
      },
      {
        key: "estimates",
        label: t("orders.stats.pendingEstimates.label"),
        count: pendingEstimates,
        ...SLICE_STYLE.estimates,
      },
      {
        key: "payments",
        label: t("orders.stats.pendingPayments.label"),
        count: pendingPayments,
        ...SLICE_STYLE.payments,
      },
    ];

    const typedSum = typed.reduce((sum, slice) => sum + slice.count, 0);
    const otherCount = Math.max(0, pendingTotal - typedSum);
    if (otherCount > 0) {
      typed.push({
        key: "other",
        label: t("orders.insights.pending.other"),
        count: otherCount,
        ...OTHER_STYLE,
      });
    }

    return typed;
  }, [
    pendingEstimates,
    pendingPayments,
    pendingPickups,
    pendingTakes,
    pendingTotal,
    t,
  ]);

  function selectSlice(key: PendingSliceKey) {
    setSelectedKey((current) => (current === key ? null : key));
  }

  return (
    <div className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("shell.directoryInsights.eyebrow")}
          </p>
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {t("shell.directoryInsights.titleNamed", { title: t("orders.title") })}
          </h2>
          <p className="text-sm text-muted-foreground">{t("orders.insights.description")}</p>
        </div>
        <DirectoryInsightsToggle open onOpenChange={(next) => !next && onBack()} />
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">
        <NewAppointmentsInsightCard />

        <section className="rounded-2xl border p-5">
          <div className="mb-4 space-y-1">
            <h3 className="text-sm font-semibold">{t("orders.insights.pending.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("orders.insights.pending.description")}</p>
          </div>

          {isLoading ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] lg:items-center">
              <div className="mx-auto size-44 animate-pulse rounded-full bg-muted" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-11 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            </div>
          ) : pendingTotal <= 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("orders.insights.pending.empty")}
            </p>
          ) : (
            <PendingAppointmentsPie
              slices={slices}
              pendingTotal={pendingTotal}
              selectedKey={selectedKey}
              onSelect={selectSlice}
            />
          )}
        </section>
      </div>
    </div>
  );
}
