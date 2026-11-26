"use client";

import type { ButtonHTMLAttributes, MouseEvent } from "react";

import { cn } from "@/lib/utils";

type TableMoreCountButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "children"
> & {
  children: React.ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

/** Shared “+N more” control for directory table overflow cells (phones, addresses, …). */
export function TableMoreCountButton({
  children,
  className,
  onClick,
  ...props
}: TableMoreCountButtonProps) {
  return (
    <button
      type="button"
      data-stop-row-click
      className={cn(
        "shrink-0 whitespace-nowrap font-medium text-primary hover:underline",
        className,
      )}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
