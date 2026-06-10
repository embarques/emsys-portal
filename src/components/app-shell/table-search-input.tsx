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
    <div className={cn("relative w-full min-w-[240px] max-w-xl", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn("pl-9", inputClassName)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
