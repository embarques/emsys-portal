import { LoaderCircle, type LucideIcon } from "lucide-react";

type DirectoryTableLoaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  columns: string[];
  rows?: number;
};

const SKELETON_WIDTHS = [72, 58, 84, 46, 64, 78, 52] as const;

export function DirectoryTableLoader({
  icon: Icon,
  title,
  description,
  columns,
  rows = 4,
}: DirectoryTableLoaderProps) {
  const gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;

  return (
    <div
      className="relative overflow-hidden border-y bg-gradient-to-b from-primary/[0.06] via-background to-background px-6 py-8"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px animate-pulse bg-gradient-to-r from-transparent via-primary to-transparent" />

      <div className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-4 grid h-16 w-16 place-items-center">
          <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
          <div className="absolute inset-0 rounded-full border border-primary/15" />
          <LoaderCircle
            className="absolute inset-0 h-16 w-16 animate-spin text-primary drop-shadow-sm"
            strokeWidth={2.25}
            aria-hidden="true"
          />
          <div className="relative grid h-12 w-12 place-items-center rounded-full border border-primary/25 bg-card shadow-lg shadow-primary/10">
            <Icon className="h-7 w-7 text-primary" aria-hidden="true" />
          </div>
        </div>

        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        <div className="mt-4 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary"
              style={{ animationDelay: `${dot * 140}ms` }}
            />
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl overflow-hidden rounded-xl border bg-card/80 shadow-sm" aria-hidden="true">
        <div className="grid gap-6 border-b bg-muted/40 px-5 py-3" style={{ gridTemplateColumns }}>
          {columns.map((label) => (
            <span key={label} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {label}
            </span>
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid gap-6 border-b px-5 py-4 last:border-b-0"
            style={{ gridTemplateColumns }}
          >
            {columns.map((_, cellIndex) => (
              <span
                key={cellIndex}
                className="h-3 max-w-full animate-pulse rounded-full bg-muted"
                style={{
                  animationDelay: `${rowIndex * 100 + cellIndex * 45}ms`,
                  width: `${SKELETON_WIDTHS[(rowIndex + cellIndex) % SKELETON_WIDTHS.length]}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <span className="sr-only">{title}</span>
    </div>
  );
}
