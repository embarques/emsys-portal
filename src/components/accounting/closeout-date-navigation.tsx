"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { useTranslation } from "@/lib/i18n";

export function CloseoutDateNavigation({ id, date, today, onCurrent, onChange }: {
  id: string; date: string; today: string; onCurrent?: () => void; onChange: (date: string) => void;
}) {
  const { t } = useTranslation();
  function move(days: number) {
    if (!date && !today) return;
    const value = new Date(`${date || today}T12:00:00`);
    value.setDate(value.getDate() + days);
    onChange(`${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`);
  }
  return <div className="flex items-center gap-1">
    <Button variant="outline" size="icon" className="size-10 shrink-0" disabled={!date && !today} onClick={() => move(-1)} aria-label={t("accounting.dailyIncome.navigation.previousDay")}><ChevronLeft className="size-4" /></Button>
    <DateInput id={id} className="h-10 bg-card" value={date} onChange={(event) => onChange(event.target.value)} />
    <Button variant="outline" size="icon" className="size-10 shrink-0" disabled={!date && !today} onClick={() => move(1)} aria-label={t("accounting.dailyIncome.navigation.nextDay")}><ChevronRight className="size-4" /></Button>
    <Button variant="ghost" className="h-10 shrink-0 px-2" disabled={date === today} onClick={() => onCurrent ? onCurrent() : onChange(today)}>{t(onCurrent ? "accounting.dailyIncome.navigation.current" : "accounting.dailyIncome.navigation.today")}</Button>
  </div>;
}
