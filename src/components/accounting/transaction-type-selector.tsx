"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildTransactionEntryGroups, type TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Only options that are easy to confuse with a neighbour get a secondary line. */
const OPTIONS_WITH_HINT = new Set<TransactionEntryCategory>(["INITIAL-PAYMENT", "PAYMENT", "INVENTORY", "INVENTORY-PAYMENT", "LOAN-PAYMENT"]);

const PICKER_LABEL_KEYS: Partial<Record<TransactionEntryCategory, string>> = {
  PAYMENT: "accounting.dailyIncome.wizard.typeSelector.existingInvoice",
};

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
  isBusy?: boolean;
  onGroupChange?: () => void;
  onChange: (type: TransactionEntryCategory) => void;
  appearance?: "default" | "phone";
  inventoryPaymentEnabled?: boolean;
  loanIssueEnabled?: boolean;
  loanIncreaseEnabled?: boolean;
  loanPaymentEnabled?: boolean;
};

type PickerProps = Pick<Props, "value" | "onChange"> & { isDisabled: (category: TransactionEntryCategory) => boolean };

export function TransactionTypeSelector({ value, onChange, children, isBusy = false, inventoryPaymentEnabled = true, loanIssueEnabled = true, loanIncreaseEnabled = true, loanPaymentEnabled = true }: Props) {
  const { t } = useTranslation();
  const isDisabled = (category: TransactionEntryCategory) =>
    isBusy || (category === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) ||
    (category === "LOAN-ISSUE" && !loanIssueEnabled) ||
    (category === "LOAN-INCREASE" && !loanIncreaseEnabled) ||
    (category === "LOAN-PAYMENT" && !loanPaymentEnabled);

  if (children) {
    return <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}>{children}</section>;
  }

  // Mounted only while visible, so every return to the picker starts at the top level.
  return <TransactionTypePicker value={value} onChange={onChange} isDisabled={isDisabled} />;
}

function TransactionTypePicker({ value, onChange, isDisabled }: PickerProps) {
  const { t } = useTranslation();
  const pickerId = useId();
  const groups = buildTransactionEntryGroups(t).filter((group) => group.options.length > 0);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const returnFocusGroupRef = useRef<string | null>(null);
  const pickerRef = useRef<HTMLElement>(null);
  const openGroup = groups.find((group) => group.id === openGroupId);

  // Focus follows the level: the current type (or first row) on open, the group row on return.
  useEffect(() => {
    if (!pickerRef.current) return;
    const options = visibleOptionButtons(pickerRef.current);
    const returnTo = !openGroupId && returnFocusGroupRef.current
      ? options.find((option) => option.dataset.group === returnFocusGroupRef.current)
      : undefined;
    (returnTo ?? options.find((option) => option.hasAttribute("data-selected")) ?? options[0])?.focus({ preventScroll: true });
  }, [openGroupId]);

  function enterGroup(groupId: string) {
    const group = groups.find((entry) => entry.id === groupId);
    if (!group) return;
    if (group.options.length === 1) {
      onChange(group.options[0].value);
      return;
    }
    returnFocusGroupRef.current = groupId;
    setOpenGroupId(groupId);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || !target.hasAttribute("data-type-option")) return;
    if (event.key === "ArrowLeft" && openGroupId) {
      event.preventDefault();
      setOpenGroupId(null);
      return;
    }
    if (event.key === "ArrowRight" && !openGroupId && target.dataset.group) {
      event.preventDefault();
      enterGroup(target.dataset.group);
      return;
    }
    const options = visibleOptionButtons(event.currentTarget);
    const index = options.indexOf(target);
    const next = event.key === "ArrowDown" ? options[(index + 1) % options.length]
      : event.key === "ArrowUp" ? options[(index - 1 + options.length) % options.length]
        : event.key === "Home" ? options[0]
          : event.key === "End" ? options.at(-1)
            : undefined;
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  const headingId = `${pickerId}-heading`;

  return (
    <section ref={pickerRef} onKeyDown={handleKeyDown} className="space-y-3"
      aria-label={openGroup ? undefined : t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}
      aria-labelledby={openGroup ? headingId : undefined}>
      {openGroup ? (
        <div className="-ml-2 flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" aria-label={t("accounting.dailyIncome.wizard.typeSelector.back")} onClick={() => setOpenGroupId(null)}>
            <ArrowLeft className="size-4" />
          </Button>
          <h4 id={headingId} className="text-sm font-semibold">{openGroup.label}</h4>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("accounting.dailyIncome.wizard.typeSelector.prompt")}</p>
      )}
      <ul className="divide-y divide-border border-y border-border">
        {openGroup ? openGroup.options.map((option) => (
          <li key={option.value}>
            <PickerRow
              icon={option.icon}
              label={t(PICKER_LABEL_KEYS[option.value] ?? `accounting.dailyIncome.wizard.typeSelector.options.${option.value}`)}
              hint={OPTIONS_WITH_HINT.has(option.value) ? t(`accounting.dailyIncome.wizard.typeSelector.hints.${option.value}`) : undefined}
              idPrefix={`${pickerId}-${option.value}`}
              selected={value === option.value}
              disabled={isDisabled(option.value)}
              onClick={() => onChange(option.value)}
            />
          </li>
        )) : groups.map((group) => (
          <li key={group.id}>
            <PickerRow
              icon={group.icon}
              iconClassName={SEMANTIC_ICON_CLASS[group.id]}
              label={group.label}
              idPrefix={`${pickerId}-${group.id}`}
              group={group.id}
              selected={group.options.some((option) => option.value === value)}
              disabled={group.options.every((option) => isDisabled(option.value))}
              onClick={() => enterGroup(group.id)}
            />
          </li>
        ))}
      </ul>
    </section>
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
