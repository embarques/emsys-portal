"use client";

import { Save } from "lucide-react";

import {
  CompactActionDialogContent,
  CompactActionDialogFooter,
} from "@/components/forms/compact-action-dialog";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SwitchField } from "@/components/ui/switch-field";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import type { useInvoicePolicyWorkspace } from "@/lib/invoice-policies/hooks/use-invoice-policy-workspace";
import { useTranslation } from "@/lib/i18n";

const textareaClassName =
  "flex min-h-32 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50";

export function InvoicePolicyDialog({
  state,
}: {
  state: ReturnType<typeof useInvoicePolicyWorkspace>;
}) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation({ advanceTextareas: false });
  const active = state.form.watch("active");

  return (
    <Dialog open={state.open} onOpenChange={state.setOpen}>
      <CompactActionDialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(state.editing ? "invoicePolicies.edit" : "invoicePolicies.add")}
          </DialogTitle>
          <DialogDescription>{t("invoicePolicies.description")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={state.save} onKeyDown={handleEnterNavigation} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="invoice-policy-title">
              {t("invoicePolicies.fields.title")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invoice-policy-title"
              autoFocus
              required
              disabled={state.busy}
              aria-invalid={!!state.form.formState.errors.title}
              {...state.form.register("title")}
            />
            {state.form.formState.errors.title ? (
              <p role="alert" className="text-sm text-destructive">
                {t(state.form.formState.errors.title.message ?? "common.validation.required")}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-policy-body">
              {t("invoicePolicies.fields.body")} <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="invoice-policy-body"
              rows={6}
              required
              disabled={state.busy}
              className={textareaClassName}
              aria-invalid={!!state.form.formState.errors.body}
              {...state.form.register("body")}
            />
            {state.form.formState.errors.body ? (
              <p role="alert" className="text-sm text-destructive">
                {t(state.form.formState.errors.body.message ?? "common.validation.required")}
              </p>
            ) : null}
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-policy-sort-order">{t("invoicePolicies.fields.sortOrder")}</Label>
            <Input
              id="invoice-policy-sort-order"
              type="number"
              disabled={state.busy}
              {...state.form.register("sortOrder", { valueAsNumber: true })}
            />
          </div>

          <SwitchField
            id="invoice-policy-active"
            label={t("invoicePolicies.fields.active")}
            description={t("invoicePolicies.form.activeHint")}
            checked={active}
            disabled={state.busy}
            onCheckedChange={(checked) => state.form.setValue("active", checked, { shouldDirty: true })}
          />

          <CompactActionDialogFooter
            error={state.error}
            isSubmitting={state.busy}
            submitLabel={t("common.actions.save")}
            submitType="submit"
            submitIcon={<Save className="h-4 w-4" />}
            onCancel={() => state.setOpen(false)}
          />
        </form>
      </CompactActionDialogContent>
    </Dialog>
  );
}
