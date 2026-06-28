import Image from "next/image";

import { cn } from "@/lib/utils";

type EmsysLogoProps = {
  /** Square mark for collapsed sidebar / compact headers. */
  variant?: "mark" | "full";
  className?: string;
  priority?: boolean;
};

export function EmsysLogo({ variant = "full", className, priority = false }: EmsysLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/emsys-icon.png"
        alt="EMSYS"
        width={48}
        height={48}
        priority={priority}
        className={cn("size-12 rounded-2xl object-cover shadow-lg shadow-primary/20", className)}
      />
    );
  }

  return (
    <Image
      src="/emsys-logo.png"
      alt="EMSYS Management Portal"
      width={160}
      height={44}
      priority={priority}
      className={cn("h-10 w-auto max-w-[160px] object-contain object-left", className)}
    />
  );
}
