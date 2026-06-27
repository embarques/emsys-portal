"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, BookmarkPlus, Check, ChevronDown, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createFilterRowId, countCompleteFilterRows } from "@/lib/table/filter-builder";
import type { TableFilterFieldDefinition, TableFilterRowState } from "@/lib/table/filter-types";
import { useFilterPresets } from "@/lib/filter-presets/hooks/use-filter-presets";
import { cn } from "@/lib/utils";

export type FilterPresetMenuProps = {
  /** Unique localStorage scope, typically the feature name (e.g. "customers"). */
  storageKey: string;
  /** Current advanced-filter rows to capture when saving a preset. */
  rows: TableFilterRowState[];
  /** Field definitions used to determine whether the current rows are saveable. */
  fields?: TableFilterFieldDefinition[];
  /** Applies a preset's rows (fresh row ids are generated before this is called). */
  onApply: (rows: TableFilterRowState[]) => void;
  className?: string;
};

const controlClassName =
  "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground shadow-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-background";

export function FilterPresetMenu({
  storageKey,
  rows,
  fields,
  onApply,
  className,
}: FilterPresetMenuProps) {
  const { presets, isLoading, isMutating, savePreset, deletePreset } = useFilterPresets(storageKey);
  const [loadOpen, setLoadOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const saveInputRef = useRef<HTMLInputElement>(null);

  const completeRowCount = countCompleteFilterRows(rows, fields);
  const canSave = completeRowCount > 0;

  useEffect(() => {
    if (!saveOpen) {
      setDraftName("");
    }
  }, [saveOpen]);

  useEffect(() => {
    if (saveOpen) {
      saveInputRef.current?.focus();
    }
  }, [saveOpen]);

  const presetsLabel = useMemo(
    () => (presets.length > 0 ? `Presets (${presets.length})` : "Presets"),
    [presets.length],
  );

  function applyPreset(preset: { rows: TableFilterRowState[] }) {
    const clonedRows = preset.rows.map((row) => ({ ...row, id: createFilterRowId() }));
    onApply(clonedRows);
    setLoadOpen(false);
  }

  function handleSave() {
    const name = draftName.trim();
    if (!name || !canSave) return;
    savePreset(name, rows);
    setDraftName("");
    setSaveOpen(false);
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Save current filters as a preset */}
      <Popover open={saveOpen} onOpenChange={(next) => setSaveOpen(next && canSave)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!canSave}
            className={controlClassName}
            aria-label="Save current filters as preset"
            title={canSave ? "Save current filters as preset" : "Add a filter to save a preset"}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save preset
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="z-[110] w-64 p-3"
          onMouseDown={(event) => event.stopPropagation()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Save filter preset</p>
            <Input
              ref={saveInputRef}
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSave();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setSaveOpen(false);
                }
              }}
              placeholder="Preset name…"
              className="h-8 text-sm"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSaveOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-3 text-xs"
                disabled={!draftName.trim() || isMutating}
                onClick={handleSave}
              >
                Save
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Load a saved preset via searchable dropdown */}
      <Popover open={loadOpen} onOpenChange={setLoadOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={controlClassName}
            aria-label="Load filter preset"
          >
            <Bookmark className="h-3.5 w-3.5" />
            {presetsLabel}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", loadOpen && "rotate-180")}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="z-[110] w-64 p-0"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {presets.length === 0 && isLoading ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Loading presets…
            </p>
          ) : presets.length > 0 ? (
            <Command>
              <CommandInput placeholder="Search presets…" />
              <CommandList className="max-h-56">
                <CommandEmpty>No presets found.</CommandEmpty>
                <CommandGroup heading="Saved presets">
                  {presets.map((preset) => (
                    <CommandItem
                      key={preset.id}
                      value={preset.name}
                      onSelect={() => applyPreset(preset)}
                      className="justify-between gap-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{preset.name}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Delete preset ${preset.name}`}
                        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          deletePreset(preset.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          ) : (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No saved presets yet. Build a filter and use “Save preset”.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
