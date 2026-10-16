"use client";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";

type Props = {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export function InvoiceNumberSwitch({ id, checked, disabled, onCheckedChange }: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-end gap-2">
      <Label htmlFor={id} className="cursor-pointer text-xs font-normal text-muted-foreground">
        {t("invoices.form.autoNumber.label")}
      </Label>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
              <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onCheckedChange}
                aria-label={t("invoices.form.autoNumber.tooltip")}
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("invoices.form.autoNumber.tooltip")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
