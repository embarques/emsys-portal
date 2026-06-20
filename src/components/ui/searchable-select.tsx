"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string[];
  disabled?: boolean;
};

type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  searchable?: boolean;
  required?: boolean;
  id?: string;
  name?: string;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

const popoverContentClassName =
  "w-[var(--radix-popover-trigger-width)] min-w-[12rem] overflow-hidden border-muted-foreground/25 p-0 shadow-lg";

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select an option",
  searchPlaceholder = "Search…",
  emptyMessage = "No results found.",
  disabled = false,
  searchable = true,
  required = false,
  id,
  name,
  className,
  contentClassName,
  align = "start",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);

  const requiredField = required ? (
    <input
      aria-hidden
      tabIndex={-1}
      required
      name={name}
      value={value}
      onChange={() => {}}
      className="pointer-events-none absolute inset-0 size-full opacity-0"
    />
  ) : name ? (
    <input type="hidden" name={name} value={value} />
  ) : null;

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setQuery("");
    setOpen(false);
  }

  const optionItems = options.map((option) => (
    <CommandItem
      key={option.value}
      value={option.value}
      keywords={[option.label, ...(option.keywords ?? [])]}
      disabled={option.disabled}
      onMouseDown={(event) => event.preventDefault()}
      onSelect={() => handleSelect(option.value)}
    >
      <Check
        className={cn("size-4 shrink-0", option.value === value ? "opacity-100" : "opacity-0")}
      />
      <span className="truncate">{option.label}</span>
    </CommandItem>
  ));

  // Plain select: trigger is a button, no inline typing.
  if (!searchable) {
    return (
      <div className="relative">
        <Popover open={open} onOpenChange={disabled ? undefined : setOpen} modal>
          <PopoverTrigger asChild>
            <button
              type="button"
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
              disabled={disabled}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className
              )}
            >
              <span className={cn("truncate text-left", !selectedOption && "text-muted-foreground")}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align={align} className={cn(popoverContentClassName, contentClassName)}>
            <Command>
              <CommandList>
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                {optionItems}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {requiredField}
      </div>
    );
  }

  // Searchable: the trigger itself is a text field; options filter as you type.
  return (
    <div className="relative">
      <Command className="overflow-visible bg-transparent">
        <Popover
          open={open}
          onOpenChange={(next) => {
            if (disabled) return;
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverAnchor asChild>
            <div
              onClick={() => {
                if (disabled) return;
                setOpen(true);
                inputRef.current?.focus();
              }}
              className={cn(
                "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors",
                "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
                disabled && "cursor-not-allowed opacity-50",
                className
              )}
            >
              <CommandPrimitive.Input
                ref={inputRef}
                id={id}
                disabled={disabled}
                value={query}
                onValueChange={(next) => {
                  setQuery(next);
                  if (!open) setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                    inputRef.current?.blur();
                  }
                }}
                role="combobox"
                aria-expanded={open}
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
                placeholder={open ? searchPlaceholder : selectedOption ? selectedOption.label : placeholder}
                className={cn(
                  "flex-1 truncate bg-transparent text-left outline-none disabled:cursor-not-allowed",
                  !open && selectedOption ? "placeholder:text-foreground" : "placeholder:text-muted-foreground"
                )}
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            align={align}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            className={cn(popoverContentClassName, contentClassName)}
          >
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {optionItems}
            </CommandList>
          </PopoverContent>
        </Popover>
      </Command>
      {requiredField}
    </div>
  );
}
