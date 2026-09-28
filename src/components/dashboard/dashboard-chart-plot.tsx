"use client";

import type { DashboardChartSeries, DashboardChartVariant } from "@/components/dashboard/dashboard-chart";
import { cn } from "@/lib/utils";

const donutColors = [
  "text-rose-600 dark:text-rose-400",
  "text-pink-400 dark:text-pink-300",
  "text-fuchsia-700 dark:text-fuchsia-500",
  "text-rose-300 dark:text-rose-200",
  "text-pink-700 dark:text-pink-500",
  "text-fuchsia-400 dark:text-fuchsia-300",
  "text-rose-900 dark:text-rose-600",
];

type DashboardChartPlotProps = {
  variant: Exclude<DashboardChartVariant, "bar">;
  label: string;
  categories: string[];
  series: DashboardChartSeries[];
};

export function DashboardChartPlot({ variant, label, categories, series }: DashboardChartPlotProps) {
  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));
  const baseline = 174;
  const x = (index: number) => 40 + (index / Math.max(categories.length - 1, 1)) * 480;
  const y = (value: number) => baseline - (value / maxValue) * 136;

  return (
    <figure aria-label={label} className="min-w-0">
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr><td />{series.map((item) => <th key={item.key} scope="col">{item.label}</th>)}</tr>
        </thead>
        <tbody>
          {categories.map((category, index) => (
            <tr key={category}>
              <th scope="row">{category}</th>
              {series.map((item) => <td key={item.key}>{(item.values[index] ?? 0).toLocaleString()}</td>)}
            </tr>
          ))}
        </tbody>
      </table>

      {variant === "horizontal-bar" ? (
        <div className="space-y-2.5" aria-hidden="true">
          {categories.map((category, index) => (
            <div key={category} className="flex items-center gap-3">
              <span className="w-10 shrink-0 truncate text-xs text-muted-foreground" title={category}>{category}</span>
              <div className="min-w-0 flex-1 space-y-1">
                {series.map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", item.colorClassName)}
                        style={{ width: `${((item.values[index] ?? 0) / maxValue) * 100}%` }}
                        title={`${category} · ${item.label}: ${(item.values[index] ?? 0).toLocaleString()}`}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {(item.values[index] ?? 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : variant === "donut" ? (
        <div className="space-y-4">
          {series.map((item) => {
            const values = categories.map((_, index) => item.values[index] ?? 0);
            const total = values.reduce((sum, value) => sum + value, 0);
            return (
              <div key={item.key} className="flex flex-col items-center gap-5 sm:flex-row" aria-hidden="true">
                <svg viewBox="0 0 200 200" className="size-44 shrink-0 overflow-visible">
                  <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" strokeWidth="26" className="text-muted" />
                  {values.map((value, index) => {
                    const share = total > 0 ? (value / total) * 100 : 0;
                    const offset = total > 0 ? (values.slice(0, index).reduce((sum, v) => sum + v, 0) / total) * 100 : 0;
                    return value > 0 ? (
                      <circle
                        key={categories[index]}
                        cx="100" cy="100" r="74" pathLength="100"
                        fill="none" stroke="currentColor" strokeWidth="26"
                        strokeDasharray={`${share} ${100 - share}`}
                        strokeDashoffset={-offset}
                        transform="rotate(-90 100 100)"
                        className={donutColors[index % donutColors.length]}
                      >
                        <title>{`${categories[index]}: ${value.toLocaleString()} (${share.toFixed(1)}%)`}</title>
                      </circle>
                    ) : null;
                  })}
                  <text x="100" y="105" textAnchor="middle" className="fill-foreground text-xl font-semibold tabular-nums">{total.toLocaleString()}</text>
                </svg>
                <ul className="w-full min-w-0 space-y-1.5 text-xs">
                  {categories.map((category, index) => (
                    <li key={category} className="flex items-center gap-2">
                      <span className={cn("size-2.5 shrink-0 rounded-full bg-current", donutColors[index % donutColors.length])} />
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{category}</span>
                      <span className="tabular-nums">{values[index].toLocaleString()}</span>
                      <span className="w-12 text-right tabular-nums text-muted-foreground">{(total > 0 ? (values[index] / total) * 100 : 0).toFixed(1)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg viewBox="0 0 560 208" className="w-full min-w-[480px]" aria-hidden="true">
            {[0, 0.5, 1].map((fraction) => (
              <line key={fraction} x1="40" x2="520" y1={y(maxValue * fraction)} y2={y(maxValue * fraction)} className="stroke-border" strokeDasharray="4 4" />
            ))}
            {series.map((item) => {
              const points = categories.map((_, index) => `${x(index)},${y(item.values[index] ?? 0)}`).join(" ");
              return (
                <g key={item.key} className={item.colorClassName}>
                  {variant === "area" && categories.length > 0 ? (
                    <polygon points={`${x(0)},${baseline} ${points} ${x(categories.length - 1)},${baseline}`} fill="currentColor" fillOpacity="0.15" />
                  ) : null}
                  <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                  {categories.map((category, index) => (
                    <g key={category}>
                      <circle cx={x(index)} cy={y(item.values[index] ?? 0)} r="4" fill="currentColor" className="stroke-card" strokeWidth="2">
                        <title>{`${category} · ${item.label}: ${(item.values[index] ?? 0).toLocaleString()}`}</title>
                      </circle>
                      <text x={x(index)} y={y(item.values[index] ?? 0) - 12} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                        {(item.values[index] ?? 0).toLocaleString()}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}
            {categories.map((category, index) => (
              <text key={category} x={x(index)} y="201" textAnchor="middle" className="fill-muted-foreground text-[11px]">{category}</text>
            ))}
          </svg>
        </div>
      )}
    </figure>
  );
}
