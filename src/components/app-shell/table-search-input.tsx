"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";

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
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative w-full min-w-[10rem]", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80" />
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-9 border-border/80 bg-background pl-9 pr-9 shadow-none focus-visible:ring-2 focus-visible:ring-ring/40",
          inputClassName,
        )}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {value ? (
        <button
          type="button"
          className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          title="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
