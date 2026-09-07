"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Employee } from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";

const ALL_EMPLOYEES_VALUE = "all";

type DailyIncomePrintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  isPending?: boolean;
  onConfirm: (employeeId: number | null) => void;
};

export function DailyIncomePrintDialog({
  open,
  onOpenChange,
  employees,
  isPending = false,
  onConfirm,
}: DailyIncomePrintDialogProps) {
  const { t } = useTranslation();
  const [employeeValue, setEmployeeValue] = useState(ALL_EMPLOYEES_VALUE);

  const options = useMemo(
    () => [
      {
        value: ALL_EMPLOYEES_VALUE,
        label: t("accounting.dailyIncome.print.allEmployees"),
        keywords: ["all", "todos"],
      },
      ...employees.map((employee) => ({
        value: String(employee.id),
        label: employee.name,
        keywords: [employee.name, String(employee.id)],
      })),
    ],
    [employees, t],
  );

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setEmployeeValue(ALL_EMPLOYEES_VALUE);
    }
  }

  function handleConfirm() {
    if (employeeValue === ALL_EMPLOYEES_VALUE || !employeeValue) {
      onConfirm(null);
      return;
    }
    const employeeId = Number(employeeValue);
    onConfirm(Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounting.dailyIncome.print.title")}</DialogTitle>
          <DialogDescription>{t("accounting.dailyIncome.print.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="daily-income-print-employee">
            {t("accounting.dailyIncome.print.employee")}
          </Label>
          <SearchableSelect
            id="daily-income-print-employee"
            value={employeeValue}
            onValueChange={setEmployeeValue}
            options={options}
            placeholder={t("accounting.dailyIncome.print.selectEmployee")}
            searchPlaceholder={t("accounting.dailyIncome.print.searchEmployees")}
            mobileSheet
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            <Printer className="h-4 w-4" />
            {t("accounting.dailyIncome.print.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
