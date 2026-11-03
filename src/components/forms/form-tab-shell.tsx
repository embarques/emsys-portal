"use client";

import { useFormViewport } from "@/hooks/use-form-viewport";

import { cn } from "@/lib/utils";

type FormTabShellProps = {
  title: string;
  description?: string | null;
  /** Optional content aligned to the right of the title row. */
  actions?: React.ReactNode;
  /** The form element (e.g. CustomerForm). Should be a flex-1 flex column. */
  children: React.ReactNode;
  className?: string;
  compactHeader?: boolean;
};

/**
 * Chrome for an add/edit form rendered inside a workspace tab. Mirrors the look of
 * the former dialog (titled header + bordered card) and fills the viewport below
 * shell chrome so the form body scrolls while the footer stays pinned.
 */
export function FormTabShell({ title, description, actions, children, className, compactHeader = false }: FormTabShellProps) {
  const shellRef = useFormViewport();

  return (
    <div
      ref={shellRef}
      className={cn(
        "mx-auto flex h-[calc(100dvh-var(--form-viewport-inset,8rem))] w-full max-w-3xl min-h-0 flex-col",
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className={cn("flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4", compactHeader && "py-3")}>
          <div className={cn("min-w-0", compactHeader && "flex flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1")}>
            <h2 className="text-base font-semibold leading-tight">{title}</h2>
            {description ? (
              <p className={cn("text-sm text-muted-foreground", !compactHeader && "mt-0.5")}>{description}</p>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
