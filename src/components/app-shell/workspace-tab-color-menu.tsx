"use client";

import {
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  normalizeWorkspaceTabColor,
  WORKSPACE_TAB_PRESET_COLORS,
} from "@/lib/layout/workspace-tab-colors";
import { cn } from "@/lib/utils";

type WorkspaceTabColorMenuProps = {
  tabId: string;
  currentColor?: string | null;
  onColorChange: (tabId: string, color: string | null) => void;
};

export function WorkspaceTabColorMenu({ tabId, currentColor, onColorChange }: WorkspaceTabColorMenuProps) {
  const activeColor = normalizeWorkspaceTabColor(currentColor);

  function applyColor(color: string | null) {
    onColorChange(tabId, color);
  }

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>Set color</ContextMenuSubTrigger>
      <ContextMenuSubContent className="w-56 p-2">
        <div className="grid grid-cols-5 gap-1.5 px-1 py-1">
          {WORKSPACE_TAB_PRESET_COLORS.map((color) => {
            const selected = activeColor === color;

            return (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`Set tab color ${color}`}
                aria-pressed={selected}
                className={cn(
                  "h-7 w-7 rounded-md border border-border/60 transition hover:scale-105",
                  selected && "ring-2 ring-primary ring-offset-1 ring-offset-popover",
                )}
                style={{ backgroundColor: color }}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => applyColor(color)}
              />
            );
          })}
        </div>

        <label
          className="mt-2 flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
          onPointerDown={(event) => event.preventDefault()}
        >
          <span className="shrink-0 text-muted-foreground">Custom</span>
          <input
            type="color"
            value={activeColor ?? "#3b82f6"}
            aria-label="Pick a custom tab color"
            className="h-8 w-full cursor-pointer rounded border border-border bg-transparent p-0.5"
            onChange={(event) => applyColor(event.target.value)}
          />
        </label>

        <ContextMenuItem
          disabled={!activeColor}
          onSelect={() => applyColor(null)}
          className="mt-1"
        >
          Reset color
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}
