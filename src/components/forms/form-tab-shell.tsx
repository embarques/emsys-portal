"use client";

import { cn } from "@/lib/utils";

type FormTabShellProps = {
  title: string;
  description?: string | null;
  /** The form element (e.g. CustomerForm). Should be a flex-1 flex column. */
  children: React.ReactNode;
  className?: string;
};

/**
 * Chrome for an add/edit form rendered inside a workspace tab. Mirrors the look of
 * the former dialog (titled header + bordered card) and constrains height so the
 * form body scrolls while the footer stays pinned.
 */
export function FormTabShell({ title, description, children, className }: FormTabShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl", className)}>
      <div className="flex h-auto max-h-[calc(100vh-8rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="shrink-0 border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold leading-tight">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
