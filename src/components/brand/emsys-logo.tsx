import { cn } from "@/lib/utils";

const LOGO_SRC = "/logo.svg";

type EmsysLogoProps = {
  /** Smaller size for sidebar; larger for login and hero surfaces. */
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
};

export function EmsysLogo({ variant = "full", className, priority = false }: EmsysLogoProps) {
  const sizeClass =
    variant === "mark"
      ? "block h-12 w-auto max-w-none object-contain object-center"
      : "block h-44 w-auto max-w-[160px] object-contain object-center";

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG brand asset from /public
    <img
      src={LOGO_SRC}
      alt="EMSYS Management Portal"
      fetchPriority={priority ? "high" : undefined}
      className={cn(sizeClass, className)}
    />
  );
}
