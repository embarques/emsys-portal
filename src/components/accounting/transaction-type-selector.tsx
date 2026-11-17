"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  buildTransactionEntryGroups,
  resolveTransactionEntryGroup,
  type TransactionEntryCategory,
  type TransactionEntryGroup,
  type TransactionEntryOption,
} from "@/lib/accounting/daily-income/transaction-type-config";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Only options that are easy to confuse with a neighbour get a secondary line. */
const OPTIONS_WITH_HINT = new Set<TransactionEntryCategory>([
  "INITIAL-PAYMENT",
  "PAYMENT",
  "SALES",
  "INVENTORY",
  "INVENTORY-PAYMENT",
  "LOAN-DECREASE",
  "LOAN-PAYMENT",
]);

const SEMANTIC_ICON_CLASS: Record<string, string> = {
  income: "text-emerald-600 dark:text-emerald-400",
  expenses: "text-red-600 dark:text-red-400",
};

function visibleOptionButtons(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("[data-type-option]:not(:disabled)"))
    .filter((button) => button.getClientRects().length > 0);
}

type Props = {
  value: TransactionEntryCategory | null;
  children?: ReactNode;
  /**
   * When true, keep the type picker mounted but hidden and show `children` in the same shell.
   * Preserves drill-down path so back returns to Income → Invoice (etc.), not the root.
   */
  formActive?: boolean;
  /** Bump when the wizard reopens so the drill-down path resets for a new session. */
  typePickerKey?: number;
  isBusy?: boolean;
  onGroupChange?: () => void;
  onChange: (type: TransactionEntryCategory) => void;
  appearance?: "default" | "phone";
  inventoryPaymentEnabled?: boolean;
  loanIssueEnabled?: boolean;
  loanIncreaseEnabled?: boolean;
  loanDecreaseEnabled?: boolean;
  loanPaymentEnabled?: boolean;
};

type PickerProps = Pick<Props, "value" | "onChange"> & { isDisabled: (category: TransactionEntryCategory) => boolean };

export function TransactionTypeSelector({
  value,
  onChange,
  children,
  formActive = false,
  typePickerKey = 0,
  isBusy = false,
  appearance = "default",
  inventoryPaymentEnabled = true,
  loanIssueEnabled = true,
  loanIncreaseEnabled = true,
  loanDecreaseEnabled = true,
  loanPaymentEnabled = true,
}: Props) {
  const { t } = useTranslation();
  const isPhone = appearance === "phone";
  const isDisabled = (category: TransactionEntryCategory) =>
    isBusy || (category === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) ||
    (category === "LOAN-ISSUE" && !loanIssueEnabled) ||
    (category === "LOAN-INCREASE" && !loanIncreaseEnabled) ||
    (category === "LOAN-DECREASE" && !loanDecreaseEnabled) ||
    (category === "LOAN-PAYMENT" && !loanPaymentEnabled);

  // One shell for type drill-down and form steps: only title/content swap; picker stays mounted.
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}>
      <div
        className={cn(
          "min-h-0 flex-1",
          formActive ? "hidden" : "overflow-y-auto",
          !formActive && (isPhone ? "bg-background px-4 py-5" : "bg-muted/35 p-4 sm:p-6 lg:p-8"),
        )}
        inert={formActive ? true : undefined}
      >
        <TransactionTypePicker key={typePickerKey} value={value} onChange={onChange} isDisabled={isDisabled} />
      </div>
      {children ? (
        <div
          className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !formActive && "hidden")}
          inert={!formActive ? true : undefined}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}

function TransactionTypePicker({ value, onChange, isDisabled }: PickerProps) {
  const { t } = useTranslation();
  const pickerId = useId();
  const groups = buildTransactionEntryGroups(t).filter((group) => group.options.length > 0 || group.children.length > 0);
  const [path, setPath] = useState<string[]>([]);
  const returnFocusGroupRef = useRef<string | null>(null);
  const pickerRef = useRef<HTMLElement>(null);
  const openGroup = path.length > 0 ? resolveTransactionEntryGroup(groups, path) : null;
  const parentGroup = path.length > 1 ? resolveTransactionEntryGroup(groups, path.slice(0, -1)) : null;
  const childGroups = openGroup ? openGroup.children : groups;
  const leafOptions = openGroup?.options ?? [];

  // Focus follows the level: the current type (or first row) on open, the group row on return.
  useEffect(() => {
    if (!pickerRef.current) return;
    const options = visibleOptionButtons(pickerRef.current);
    const returnTo = returnFocusGroupRef.current
      ? options.find((option) => option.dataset.group === returnFocusGroupRef.current)
      : undefined;
    if (returnTo) returnFocusGroupRef.current = null;
    (returnTo ?? options.find((option) => option.hasAttribute("data-selected")) ?? options[0])?.focus({ preventScroll: true });
  }, [path]);

  function enterGroup(group: TransactionEntryGroup) {
    if (group.children.length === 0 && group.options.length === 1) {
      onChange(group.options[0].value);
      return;
    }
    returnFocusGroupRef.current = null;
    setPath((current) => [...current, group.id]);
  }

  function goBack() {
    if (path.length === 0) return;
    returnFocusGroupRef.current = path[path.length - 1] ?? null;
    setPath((current) => current.slice(0, -1));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.hasAttribute("data-type-option")) return;
    if (event.key === "ArrowLeft" && path.length > 0 && !target.hasAttribute("data-tile")) {
      event.preventDefault();
      goBack();
      return;
    }
    const isTile = target.hasAttribute("data-tile");
    if (event.key === "ArrowRight" && target.dataset.group && !isTile) {
      event.preventDefault();
      const group = childGroups.find((entry) => entry.id === target.dataset.group);
      if (group) enterGroup(group);
      return;
    }
    const options = visibleOptionButtons(event.currentTarget);
    const index = options.indexOf(target);
    const next = event.key === "ArrowDown" || (isTile && event.key === "ArrowRight") ? options[(index + 1) % options.length]
      : event.key === "ArrowUp" || (isTile && event.key === "ArrowLeft") ? options[(index - 1 + options.length) % options.length]
        : event.key === "Home" ? options[0]
          : event.key === "End" ? options.at(-1)
            : undefined;
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const headingId = `${pickerId}-heading`;
  const optionLabel = (option: TransactionEntryOption) =>
    t(`accounting.dailyIncome.wizard.typeSelector.options.${option.value}`);
  const backLabel = path.length <= 1
    ? t("accounting.dailyIncome.wizard.typeSelector.back")
    : t("accounting.dailyIncome.wizard.typeSelector.backTo", { group: parentGroup?.label ?? "" });
  const groupDisabled = (group: TransactionEntryGroup): boolean => {
    if (group.children.length > 0) return group.children.every((child) => groupDisabled(child));
    return group.options.length > 0 && group.options.every((option) => isDisabled(option.value));
  };
  const groupSelected = (group: TransactionEntryGroup): boolean => {
    if (group.children.some((child) => groupSelected(child))) return true;
    return group.options.some((option) => option.value === value);
  };
  const firstLeafOption = (group: TransactionEntryGroup): TransactionEntryOption | undefined => {
    if (group.options[0]) return group.options[0];
    for (const child of group.children) {
      const leaf = firstLeafOption(child);
      if (leaf) return leaf;
    }
    return undefined;
  };
  const optionTile = (option: TransactionEntryOption) => (
    <li key={option.value}>
      <PickerTile
        icon={option.icon}
        iconClassName={option.iconClassName}
        iconBackgroundClassName={option.iconBackgroundClassName}
        label={optionLabel(option)}
        description={OPTIONS_WITH_HINT.has(option.value) ? t(`accounting.dailyIncome.wizard.typeSelector.hints.${option.value}`) : option.description}
        idPrefix={`${pickerId}-tile-${option.value}`}
        selected={value === option.value}
        disabled={isDisabled(option.value)}
        onClick={() => onChange(option.value)}
      />
    </li>
  );
  const groupTile = (group: TransactionEntryGroup) => {
    const leaf = firstLeafOption(group);
    return (
      <li key={group.id} className={!openGroup && group.id === "transfers" ? "col-span-2" : undefined}>
        <PickerTile
          icon={group.icon}
          iconClassName={leaf?.iconClassName ?? "text-foreground"}
          iconBackgroundClassName={leaf?.iconBackgroundClassName ?? "bg-muted"}
          label={group.label}
          description={group.description}
          idPrefix={`${pickerId}-tile-${group.id}`}
          group={group.id}
          selected={groupSelected(group)}
          disabled={groupDisabled(group)}
          onClick={() => enterGroup(group)}
        />
      </li>
    );
  };

  // Wide layout: 2-col root (Transfer spans), 3-col when a level has exactly three tiles (e.g. Invoice).
  // Narrow keeps the list drill-down.
  const tileCount = openGroup ? childGroups.length + leafOptions.length : childGroups.length;
  const gridColsClass = tileCount === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <section ref={pickerRef} onKeyDown={handleKeyDown} className="@container space-y-5" aria-labelledby={headingId}>
      <header className={cn("flex items-center gap-1", openGroup && "-ml-2")}>
        {openGroup ? (
          <Button type="button" variant="ghost" size="icon" aria-label={backLabel} onClick={goBack}>
            <ArrowLeft className="size-4" />
          </Button>
        ) : null}
        <h2 id={headingId} className="text-2xl font-semibold tracking-tight">
          {openGroup ? openGroup.label : t("accounting.dailyIncome.wizard.typeSelector.prompt")}
        </h2>
      </header>
      <ul className={cn("hidden gap-4 @2xl:grid", gridColsClass)}>
        {openGroup
          ? [...childGroups.map(groupTile), ...leafOptions.map(optionTile)]
          : childGroups.map(groupTile)}
      </ul>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm @2xl:hidden">
        {openGroup ? (
          <>
            {childGroups.map((group) => (
              <li key={group.id}>
                <PickerRow
                  icon={group.icon}
                  label={group.label}
                  hint={group.description}
                  idPrefix={`${pickerId}-${group.id}`}
                  group={group.id}
                  selected={groupSelected(group)}
                  disabled={groupDisabled(group)}
                  onClick={() => enterGroup(group)}
                />
              </li>
            ))}
            {leafOptions.map((option) => (
              <li key={option.value}>
                <PickerRow
                  icon={option.icon}
                  label={optionLabel(option)}
                  hint={OPTIONS_WITH_HINT.has(option.value) ? t(`accounting.dailyIncome.wizard.typeSelector.hints.${option.value}`) : undefined}
                  idPrefix={`${pickerId}-${option.value}`}
                  selected={value === option.value}
                  disabled={isDisabled(option.value)}
                  onClick={() => onChange(option.value)}
                />
              </li>
            ))}
          </>
        ) : childGroups.map((group) => (
          <li key={group.id}>
            <PickerRow
              icon={group.icon}
              iconClassName={SEMANTIC_ICON_CLASS[group.id]}
              label={group.label}
              idPrefix={`${pickerId}-${group.id}`}
              group={group.id}
              selected={groupSelected(group)}
              disabled={groupDisabled(group)}
              onClick={() => enterGroup(group)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PickerTile({ icon: Icon, iconClassName, iconBackgroundClassName, label, description, idPrefix, group, selected, disabled, onClick }: {
  icon: LucideIcon;
  iconClassName: string;
  iconBackgroundClassName: string;
  label: string;
  description: string;
  idPrefix: string;
  group?: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" data-type-option data-tile data-group={group} data-selected={selected || undefined}
      aria-labelledby={`${idPrefix}-label`} aria-describedby={`${idPrefix}-hint`}
      disabled={disabled} onClick={onClick}
      className="flex h-full w-full cursor-pointer flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm outline-none transition-[color,background-color,border-color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-ring enabled:hover:border-foreground/20 enabled:hover:bg-accent/40 enabled:hover:shadow-md enabled:active:scale-[0.98] enabled:active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg dark:bg-muted", iconBackgroundClassName)}>
        <Icon className={cn("size-5", iconClassName)} aria-hidden="true" />
      </span>
      <span className="space-y-1">
        <span id={`${idPrefix}-label`} className="block text-sm font-semibold">{label}</span>
        <span id={`${idPrefix}-hint`} className="block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function PickerRow({ icon: Icon, iconClassName, label, hint, idPrefix, group, selected, disabled, onClick }: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  hint?: string;
  idPrefix: string;
  group?: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" data-type-option data-group={group} data-selected={selected || undefined}
      aria-labelledby={`${idPrefix}-label`} aria-describedby={hint ? `${idPrefix}-hint` : undefined}
      disabled={disabled} onClick={onClick}
      className="group flex min-h-12 w-full items-center gap-3 px-3 py-1.5 text-left outline-none transition-colors focus-visible:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring enabled:hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50">
      <Icon className={cn("size-4 shrink-0 text-muted-foreground", iconClassName)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span id={`${idPrefix}-label`} className="block text-sm font-medium">{label}</span>
        {hint ? <span id={`${idPrefix}-hint`} className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground group-focus-visible:text-muted-foreground" aria-hidden="true" />
    </button>
  );
}
