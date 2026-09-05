"use client";

import { Check, Mail, MapPin, Phone } from "lucide-react";

import { TableTagText } from "@/components/app-shell/table-tag-text";
import { formatPrimaryPhonesDisplayOrDash } from "@/lib/phones/phones";
import {
  formatEmployeeAddress,
  getEmployeeActiveBadgeClass,
  getEmployeeBranchBadgeClass,
} from "@/lib/employees/display";
import type { Employee } from "@/lib/employees/types";
import { useEmployeeLabels } from "@/lib/employees/hooks/use-employee-labels";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type EmployeeMobileRowProps = {
  employee: Employee;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
};

function getEmployeeInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function EmployeeMobileRow({
  employee,
  selected,
  selectionMode,
  onToggleSelect,
  onOpen,
}: EmployeeMobileRowProps) {
  const { t } = useTranslation();
  const employeeLabels = useEmployeeLabels();
  const phone = formatPrimaryPhonesDisplayOrDash(employee.phones);
  const address = formatEmployeeAddress(employee);

  function activateRow() {
    if (selectionMode) {
      onToggleSelect();
      return;
    }
    onOpen();
  }

  return (
    <article
      role="button"
      tabIndex={0}
      className={cn(
        "border-b p-4 text-left outline-none transition-colors last:border-b-0",
        selected && "bg-primary/5",
      )}
      onClick={activateRow}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activateRow();
      }}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className={cn(
            "grid size-14 shrink-0 place-items-center rounded-2xl border text-sm font-bold transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSelect();
          }}
          aria-pressed={selected}
          aria-label={employee.name}
        >
          {selected ? <Check className="size-6" /> : getEmployeeInitials(employee.name)}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold leading-tight text-foreground">
                {employee.name}
              </h3>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {[employeeLabels.title(employee.title), employeeLabels.department(employee.department)]
                  .filter(Boolean)
                  .join(" · ") || t("common.empty.dash")}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <TableTagText className={getEmployeeActiveBadgeClass(employee.active)}>
                {employeeLabels.active(employee.active)}
              </TableTagText>
              <TableTagText className={getEmployeeBranchBadgeClass(employee)}>
                {employeeLabels.branchLabel(employee)}
              </TableTagText>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <p className="flex min-w-0 items-center gap-2">
              <Phone className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{phone}</span>
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <Mail className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 truncate">{employee.email || t("common.empty.dash")}</span>
            </p>
            <p className="flex min-w-0 items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="min-w-0 whitespace-normal break-words [overflow-wrap:break-word]">
                {address}
              </span>
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
