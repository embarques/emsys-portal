"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TableSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

export function TableSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  inputClassName,
}: TableSearchInputProps) {
  return (
    <div className={cn("relative w-full min-w-[10rem]", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 border-border/80 bg-background pl-9 shadow-none focus-visible:ring-2 focus-visible:ring-ring/40",
          inputClassName,
        )}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
