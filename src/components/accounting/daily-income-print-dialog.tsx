"use client";

import { useEffect, useMemo, useState } from "react";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
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

export type DailyIncomePrintSelection = {
  date: string;
  employeeId: number | null;
};

type DailyIncomePrintDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Closeout date from the daily income date field. */
  date: string;
  employees: Employee[];
  isPending?: boolean;
  onConfirm: (selection: DailyIncomePrintSelection) => void;
};

export function DailyIncomePrintDialog({
  open,
  onOpenChange,
  date,
  employees,
  isPending = false,
  onConfirm,
}: DailyIncomePrintDialogProps) {
  const { t } = useTranslation();
  const [printDate, setPrintDate] = useState(date.slice(0, 10));
  const [employeeValue, setEmployeeValue] = useState(ALL_EMPLOYEES_VALUE);

  useEffect(() => {
    if (!open) return;
    setPrintDate(date.slice(0, 10));
    setEmployeeValue(ALL_EMPLOYEES_VALUE);
  }, [open, date]);

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
      setPrintDate(date.slice(0, 10));
    }
  }

  function handleConfirm() {
    const nextDate = printDate.slice(0, 10);
    if (!nextDate) return;

    if (employeeValue === ALL_EMPLOYEES_VALUE || !employeeValue) {
      onConfirm({ date: nextDate, employeeId: null });
      return;
    }
    const employeeId = Number(employeeValue);
    onConfirm({
      date: nextDate,
      employeeId: Number.isInteger(employeeId) && employeeId > 0 ? employeeId : null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("accounting.dailyIncome.print.title")}</DialogTitle>
          <DialogDescription>{t("accounting.dailyIncome.print.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="daily-income-print-date">{t("accounting.dailyIncome.print.date")}</Label>
            <DateInput
              id="daily-income-print-date"
              value={printDate}
              onChange={(event) => setPrintDate(event.target.value.slice(0, 10))}
            />
          </div>
          <div className="space-y-2">
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
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending || !printDate}>
            <Printer className="h-4 w-4" />
            {t("accounting.dailyIncome.print.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
