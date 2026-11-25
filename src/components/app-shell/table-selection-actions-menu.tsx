"use client";

import {
  createContext,
  useContext,
  useId,
  type ComponentPropsWithoutRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/lib/i18n";
import {
  outlineStyleFromMenuActionClass,
  tableSelectionActionStyles,
} from "@/lib/table/selection-action-styles";
import { cn } from "@/lib/utils";

type TableSelectionActionItemProps = ComponentPropsWithoutRef<typeof DropdownMenuItem>;

type CollectedEntry =
  | { type: "item"; props: TableSelectionActionItemProps }
  | { type: "separator" };

type CollectContextValue = {
  /**
   * Idempotent by `id` so React Strict Mode's double render of the same
   * child instance does not push the same action twice.
   */
  register: (id: string, entry: CollectedEntry) => void;
};

const TableSelectionActionsCollectContext = createContext<CollectContextValue | null>(
  null,
);

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
 * Overflow "Actions" menu for selection-header / view-sheet secondary commands.
 * Keep Add / Edit / Delete / Print as standalone toolbar buttons; put
 * everything else (map, complete, documents, bulk status, …) in here.
 *
 * When only one action registers, it is flattened to a standalone outline
 * button instead of an "Actions" dropdown.
 *
 * Callers that mount this menu in both mobile and desktop toolbars must pass
 * a fresh element tree to each (do not reuse one React element instance).
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

  // Map keeps insertion order and overwrites on re-register (Strict Mode safe).
  const collected = new Map<string, CollectedEntry>();
  const collectCtx: CollectContextValue = {
    register(id, entry) {
      collected.set(id, entry);
    },
  };

  return (
    <TableSelectionActionsCollectContext.Provider value={collectCtx}>
      {children}
      <TableSelectionActionsResolved
        getEntries={() => Array.from(collected.values())}
        disabled={disabled}
        align={align}
        className={className}
        triggerClassName={triggerClassName}
        actionsLabel={t("common.actions.actions")}
      />
    </TableSelectionActionsCollectContext.Provider>
  );
}

/**
 * Menu row that participates in single-action flattening. Use this instead of
 * `DropdownMenuItem` inside `TableSelectionActionsMenu`.
 */
export function TableSelectionActionItem(props: TableSelectionActionItemProps) {
  const ctx = useContext(TableSelectionActionsCollectContext);
  const id = useId();
  if (ctx) {
    ctx.register(id, { type: "item", props });
    return null;
  }
  return <DropdownMenuItem {...props} />;
}

/** Separator that is omitted when the menu flattens to a single action. */
export function TableSelectionActionSeparator() {
  const ctx = useContext(TableSelectionActionsCollectContext);
  const id = useId();
  if (ctx) {
    ctx.register(id, { type: "separator" });
    return null;
  }
  return <DropdownMenuSeparator />;
}

function TableSelectionActionsResolved({
  getEntries,
  disabled,
  align,
  className,
  triggerClassName,
  actionsLabel,
}: {
  getEntries: () => CollectedEntry[];
  disabled: boolean;
  align: "start" | "center" | "end";
  className?: string;
  triggerClassName?: string;
  actionsLabel: string;
}) {
  const entries = getEntries();
  const items = entries.filter(
    (entry): entry is Extract<CollectedEntry, { type: "item" }> => entry.type === "item",
  );

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <FlattenedSelectionAction
        {...items[0].props}
        menuDisabled={disabled}
        triggerClassName={triggerClassName}
      />
    );
  }

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
          <span>{actionsLabel}</span>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={cn("min-w-56", className)}>
        {entries.map((entry, index) => {
          if (entry.type === "separator") {
            return <DropdownMenuSeparator key={`separator-${index}`} />;
          }
          return <DropdownMenuItem key={`item-${index}`} {...entry.props} />;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FlattenedSelectionAction({
  menuDisabled,
  triggerClassName,
  className,
  disabled,
  onSelect,
  onClick,
  asChild,
  children,
}: TableSelectionActionItemProps & {
  menuDisabled: boolean;
  triggerClassName?: string;
}) {
  const outlineClass = outlineStyleFromMenuActionClass(
    typeof className === "string" ? className : undefined,
  );
  const isDisabled = Boolean(menuDisabled || disabled);

  const activate = (event: MouseEvent<HTMLElement>) => {
    if (isDisabled) return;
    onClick?.(event as never);
    onSelect?.(event.nativeEvent);
  };

  if (asChild) {
    return (
      <Button
        asChild
        variant="outline"
        size="sm"
        disabled={isDisabled}
        className={cn("whitespace-nowrap", outlineClass, triggerClassName)}
        onClick={activate}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isDisabled}
      className={cn("whitespace-nowrap", outlineClass, triggerClassName)}
      onClick={activate}
    >
      {children}
    </Button>
  );
}
