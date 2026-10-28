"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { closeoutSetupSchema, type CloseoutSetupValues } from "@/lib/accounting/daily-income/start-transaction";
import { useTranslation } from "@/lib/i18n";

export function TransactionCloseoutSetup({ pending, error, onSubmit, onCancel }: {
  pending: boolean; error: string | null; onSubmit: (values: CloseoutSetupValues) => void; onCancel: () => void;
}) {
  const { t } = useTranslation();
  const form = useForm<CloseoutSetupValues>({ resolver: zodResolver(closeoutSetupSchema), defaultValues: { currency: "USD", rate: 1 } });
  const currency = form.watch("currency");
  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onCancel(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{t("accounting.dailyIncome.start.title")}</DialogTitle><DialogDescription>{t("accounting.dailyIncome.start.description")}</DialogDescription></DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <fieldset disabled={pending} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closeout-setup-currency">{t("accounting.dailyIncome.statement.fields.currency")}</Label>
            <select id="closeout-setup-currency" className="h-10 w-full rounded-md border bg-background px-3" {...form.register("currency", { onChange: () => form.setValue("rate", 1) })}>
              <option value="USD">USD</option><option value="DOP">DOP</option>
            </select>
          </div>
          {currency === "DOP" && <div className="space-y-2">
            <Label htmlFor="closeout-setup-rate">{t("accounting.dailyIncome.statement.fields.exchangeRate")}</Label>
            <Input id="closeout-setup-rate" type="number" step="any" min="0.000001" aria-invalid={Boolean(form.formState.errors.rate)} {...form.register("rate", { valueAsNumber: true })} />
            {form.formState.errors.rate && <p role="alert" className="text-sm text-destructive">{t("accounting.dailyIncome.start.ratePositive")}</p>}
          </div>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>{t("common.actions.cancel")}</Button>
          <Button type="submit" disabled={pending}>{t(pending ? "common.actions.saving" : "accounting.dailyIncome.start.continue")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
