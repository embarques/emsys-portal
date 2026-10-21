import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type FieldMessageProps = {
  /** Validation error; replaces the hint while present. */
  error?: string | null;
  hint?: React.ReactNode;
  className?: string;
};

/** One line under a form control: the error when invalid, otherwise the hint. */
export function FieldMessage({ error, hint, className }: FieldMessageProps) {
  if (error) {
    return (
      <p
        role="alert"
        className={cn("flex items-start gap-1.5 text-xs font-medium leading-snug text-destructive", className)}
      >
        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0">{error}</span>
      </p>
    );
  }
  if (!hint) return null;
  return <p className={cn("text-xs leading-snug text-muted-foreground", className)}>{hint}</p>;
}
