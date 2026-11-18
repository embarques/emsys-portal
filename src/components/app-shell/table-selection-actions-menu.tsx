"use client";

import { type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import { tableSelectionActionStyles } from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type TableSelectionActionsMenuProps = {
  children: ReactNode;
  disabled?: boolean;
  /** Hide the menu entirely when there are no secondary actions to show. */
  hidden?: boolean;
  align?: "start" | "center" | "end";
  className?: string;
  triggerClassName?: string;
};

/**
 * Overflow "Actions" menu for selection-header secondary commands.
 * Keep Add / Edit / Delete / Print as standalone toolbar buttons; put
 * everything else (map, complete, documents, bulk status, …) in here.
 */
export function TableSelectionActionsMenu({
  children,
  disabled = false,
  hidden = false,
  align = "end",
  className,
  triggerClassName,
}: TableSelectionActionsMenuProps) {
  const { t } = useTranslation();

  if (hidden) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-haspopup="menu"
          className={cn("whitespace-nowrap", tableSelectionActionStyles.actions, triggerClassName)}
        >
          <span>{t("common.actions.actions")}</span>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("min-w-56", className)}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
