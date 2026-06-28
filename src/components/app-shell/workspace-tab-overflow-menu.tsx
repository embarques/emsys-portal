"use client";

import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { WorkspaceTab } from "@/lib/layout/workspace-tab-types";
import { normalizeWorkspaceTabColor } from "@/lib/layout/workspace-tab-colors";
import { cn } from "@/lib/utils";

type WorkspaceTabOverflowMenuProps = {
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
};

export function WorkspaceTabOverflowMenu({ tabs, activeTabId, onActivate }: WorkspaceTabOverflowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mb-1 mr-1 mt-2 h-9 w-9 shrink-0 rounded-lg"
          aria-label="Open tab list"
          title="All tabs"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-64 overflow-y-auto">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const color = normalizeWorkspaceTabColor(tab.color);

          return (
            <DropdownMenuItem key={tab.id} onSelect={() => onActivate(tab.id)} className="gap-2">
              {color ? (
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full border border-border/50"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
              ) : null}
              <span className={cn("min-w-0 flex-1 truncate", active && "font-medium")}>
                <span className="mr-1.5 tabular-nums text-muted-foreground">{tab.number}</span>
                {tab.label}
              </span>
              {active ? <Check className="h-4 w-4 shrink-0 opacity-70" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
