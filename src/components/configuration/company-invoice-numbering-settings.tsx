"use client";

import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import type { InvoiceNumbering } from "@/lib/company/invoice-numbering-api";
import { useInvoiceNumbering } from "@/lib/company/hooks/use-invoice-numbering";
import { useTranslation } from "@/lib/i18n";

export function CompanyInvoiceNumberingSettings() {
  const { companyId, hasPermission } = useAuth();
  const canEdit = hasPermission("canUpdateSettings", "settings");
  if (!canEdit && !hasPermission("canViewSettings", "settings")) return null;
  return (
    <InvoiceNumberingForm
      key={companyId}
      companyId={companyId}
      canEdit={canEdit}
      canUnlock={canEdit && hasPermission("canUnlockInvoiceNumbering", "invoice_numbering")}
    />
  );
}

function InvoiceNumberingForm({ companyId, canEdit, canUnlock }: {
  companyId: string | null | undefined;
  canEdit: boolean;
  canUnlock: boolean;
}) {
  const { t } = useTranslation();
  const text = (field: string) => t(`settings.invoiceNumbering.${field}`);
  const { query, mutation } = useInvoiceNumbering(companyId);
  const { notifySuccess } = useFeedback();
  const [unlocked, setUnlocked] = useState(false);
  const { register, handleSubmit, reset, resetField, formState: { isDirty } } = useForm<InvoiceNumbering>();
  useEffect(() => {
    if (query.data && !isDirty) reset(query.data);
  }, [query.data, isDirty, reset]);

  const disabled = !canEdit || !query.data || mutation.isPending;
  const locked = !canUnlock || !unlocked;
  const lockLabel = text(locked ? "unlock" : "lock");
  const error = query.error ?? mutation.error;
  const save = handleSubmit(async (values) => {
    if (disabled || !query.data) return;
    const { prefix, suffix, startValue, maxValue, paddingLength, isActive } = values;
    try {
      const saved = await mutation.mutateAsync(locked
        ? { prefix, isActive, startValue: query.data.startValue, maxValue: query.data.maxValue, paddingLength: query.data.paddingLength }
        : { prefix, suffix, startValue, maxValue, paddingLength, isActive });
      reset(saved);
      setUnlocked(false);
      notifySuccess(t("settings.toast.saved"));
    } catch {
      // Keep the draft visible so the user can correct a rejected range.
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{text("title")}</CardTitle>
        <CardDescription>{text("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-numbering-prefix">{text("prefix")}</Label>
            <Input id="invoice-numbering-prefix" maxLength={64} disabled={disabled} {...register("prefix")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-numbering-suffix">{text("suffix")}</Label>
            <div className="flex items-center gap-2">
              <Input id="invoice-numbering-suffix" maxLength={64} readOnly={locked} disabled={disabled} {...register("suffix")} />
              <Button type="button" size="icon" variant="outline" aria-label={lockLabel}
                title={canUnlock ? lockLabel : text("permissionRequired")} disabled={!canUnlock || disabled}
                onClick={() => {
                  if (unlocked) {
                    resetField("suffix");
                    resetField("startValue");
                    resetField("maxValue");
                    resetField("paddingLength");
                  }
                  setUnlocked(!unlocked);
                }}>
                {locked ? <Lock /> : <LockOpen />}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["startValue", "maxValue"] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={`invoice-numbering-${field}`}>{text(field)}</Label>
                <Input id={`invoice-numbering-${field}`} inputMode="numeric" pattern="[1-9][0-9]{0,17}" required
                  readOnly={locked} disabled={disabled} {...register(field)} />
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="invoice-numbering-padding">{text("paddingLength")}</Label>
              <Input id="invoice-numbering-padding" type="number" min={1} max={18} required readOnly={locked}
                disabled={disabled} {...register("paddingLength", { valueAsNumber: true })} />
            </div>
          </div>
          <Label className="flex items-center gap-2">
            <input type="checkbox" disabled={disabled} {...register("isActive")} />
            {text("isActive")}
          </Label>
          {error ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(error).message}</p> : null}
          {canEdit ? <Button type="submit" disabled={disabled || !isDirty}>{t("settings.actions.save")}</Button> : null}
        </form>
      </CardContent>
    </Card>
  );
}
