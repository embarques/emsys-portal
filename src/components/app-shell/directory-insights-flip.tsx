"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { ArrowLeft, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type DirectoryInsightMetric = {
  label: string;
  value: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
};

type DirectoryInsightsToggleProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
};

/** Toolbar control that flips the directory table to the insights face. */
export function DirectoryInsightsToggle({
  open,
  onOpenChange,
  className,
}: DirectoryInsightsToggleProps) {
  const { t } = useTranslation();

  return (
    <Button
      type="button"
      variant={open ? "secondary" : "outline"}
      size="sm"
      className={cn("gap-1.5", className)}
      aria-pressed={open}
      onClick={() => onOpenChange(!open)}
    >
      {open ? <ArrowLeft className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      {open ? t("shell.directoryInsights.back") : t("shell.directoryInsights.show")}
    </Button>
  );
}

type DirectoryInsightsFlipProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Default insights face metrics. Ignored when `insights` is provided. */
  metrics?: DirectoryInsightMetric[];
  /** Optional custom back face (e.g. appointment pie chart). */
  insights?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Optional workspace title used in the insights header. */
  title?: string;
};

const ACCENT_CLASSES = [
  "from-teal-500/20 via-teal-500/5 to-transparent text-teal-700 dark:text-teal-300",
  "from-sky-500/20 via-sky-500/5 to-transparent text-sky-700 dark:text-sky-300",
  "from-amber-500/20 via-amber-500/5 to-transparent text-amber-800 dark:text-amber-300",
  "from-violet-500/20 via-violet-500/5 to-transparent text-violet-700 dark:text-violet-300",
  "from-rose-500/20 via-rose-500/5 to-transparent text-rose-700 dark:text-rose-300",
] as const;

const BAR_CLASSES = [
  "bg-teal-600 dark:bg-teal-400",
  "bg-sky-600 dark:bg-sky-400",
  "bg-amber-600 dark:bg-amber-400",
  "bg-violet-600 dark:bg-violet-400",
  "bg-rose-600 dark:bg-rose-400",
] as const;

function parseMetricMagnitude(value: string): number | null {
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "." || cleaned === "-.") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? Math.abs(parsed) : null;
}

function RelativeShareBar({
  label,
  value,
  maxMagnitude,
  barClassName,
  className,
}: {
  label: string;
  value: string;
  maxMagnitude: number;
  barClassName: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const magnitude = parseMetricMagnitude(value);
  if (magnitude == null || maxMagnitude <= 0) return null;

  const share = Math.max(8, Math.round((magnitude / maxMagnitude) * 100));

  return (
    <div
      className={cn("overflow-hidden rounded-full bg-background/60", className)}
      role="img"
      aria-label={t("shell.directoryInsights.relativeShare", { label, percent: share })}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
          barClassName,
        )}
        style={{ width: `${share}%` }}
      />
    </div>
  );
}

function DirectoryInsightsFace({
  metrics,
  title,
  onBack,
}: {
  metrics: DirectoryInsightMetric[];
  title?: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [spotlight, ...rest] = metrics;
  const magnitudes = metrics.map((metric) => parseMetricMagnitude(metric.value));
  const maxMagnitude = Math.max(0, ...magnitudes.filter((value): value is number => value != null));

  return (
    <div className="flex h-full min-h-[22rem] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("shell.directoryInsights.eyebrow")}
          </p>
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {title ? t("shell.directoryInsights.titleNamed", { title }) : t("shell.directoryInsights.title")}
          </h2>
        </div>
        <DirectoryInsightsToggle open onOpenChange={(next) => !next && onBack()} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {metrics.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t("shell.directoryInsights.empty")}
          </p>
        ) : (
          <div
            className={cn(
              "grid gap-4",
              rest.length > 0 && "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]",
            )}
          >
            {spotlight ? (
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6",
                  ACCENT_CLASSES[0],
                )}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-current/10 blur-2xl motion-reduce:hidden"
                />
                <div className="relative space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    {spotlight.icon ? <spotlight.icon className="h-4 w-4" /> : null}
                    <span>{spotlight.label}</span>
                  </div>
                  <p className="text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl">
                    {spotlight.value}
                  </p>
                  {spotlight.description ? (
                    <p className="max-w-sm text-sm text-muted-foreground">{spotlight.description}</p>
                  ) : null}
                  {metrics.length > 1 ? (
                    <RelativeShareBar
                      label={spotlight.label}
                      value={spotlight.value}
                      maxMagnitude={maxMagnitude}
                      barClassName={BAR_CLASSES[0]}
                      className="h-2.5 max-w-xs"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

            {rest.length > 0 ? (
              <div className="space-y-3">
                {rest.map((metric, index) => {
                  const accentIndex = (index + 1) % ACCENT_CLASSES.length;

                  return (
                    <div
                      key={`${metric.label}-${index}`}
                      className={cn(
                        "rounded-2xl border bg-gradient-to-r p-4",
                        ACCENT_CLASSES[accentIndex],
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                          {metric.icon ? <metric.icon className="h-3.5 w-3.5" /> : null}
                          <span className="truncate">{metric.label}</span>
                        </div>
                        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                          {metric.value}
                        </p>
                        {metric.description ? (
                          <p className="text-xs text-muted-foreground">{metric.description}</p>
                        ) : null}
                      </div>
                      <RelativeShareBar
                        label={metric.label}
                        value={metric.value}
                        maxMagnitude={maxMagnitude}
                        barClassName={BAR_CLASSES[accentIndex]}
                        className="mt-3 h-2"
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Flips a directory table card to show the same summary metrics in a richer layout.
 * Keep the KPI cards above the table; this only replaces the table surface.
 */
export function DirectoryInsightsFlip({
  open,
  onOpenChange,
  metrics = [],
  insights,
  children,
  className,
  title,
}: DirectoryInsightsFlipProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const [frontHeight, setFrontHeight] = useState<number | undefined>();

  useLayoutEffect(() => {
    const node = frontRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || open) return;
      setFrontHeight(entry.contentRect.height);
    });

    observer.observe(node);
    setFrontHeight(node.getBoundingClientRect().height);

    return () => observer.disconnect();
  }, [open, children]);

  return (
    <div
      className={cn("[perspective:1600px]", className)}
      style={frontHeight ? { minHeight: frontHeight } : undefined}
    >
      <div
        className={cn(
          "relative w-full transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none",
          open && "[transform:rotateY(180deg)]",
        )}
        style={frontHeight ? { minHeight: frontHeight } : undefined}
      >
        <div
          ref={frontRef}
          aria-hidden={open}
          className={cn(
            "[backface-visibility:hidden]",
            open && "pointer-events-none",
          )}
        >
          {children}
        </div>

        <div
          aria-hidden={!open}
          className={cn(
            "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]",
            !open && "pointer-events-none",
          )}
        >
          {insights ?? (
            <DirectoryInsightsFace
              metrics={metrics}
              title={title}
              onBack={() => onOpenChange(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
