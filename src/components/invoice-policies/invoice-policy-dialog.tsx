"use client";

import { ScrollText } from "lucide-react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle>
            {t(state.editing ? "invoicePolicies.edit" : "invoicePolicies.add")}
          </DialogTitle>
          <DialogDescription>{t("invoicePolicies.description")}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={state.save}
          onKeyDown={handleEnterNavigation}
          className="flex min-h-0 flex-1 flex-col"
        >
          <FormBody workflow isBusy={state.busy}>
            <FormSection
              variant="card"
              icon={ScrollText}
              title={t("invoicePolicies.form.details")}
              description={t("invoicePolicies.form.hint")}
            >
              <div className="space-y-1">
                <Label htmlFor="invoice-policy-title">
                  {t("invoicePolicies.fields.title")}{" "}
                  <span className="text-destructive">*</span>
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
                    {state.form.formState.errors.title.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="invoice-policy-body">
                  {t("invoicePolicies.fields.body")}{" "}
                  <span className="text-destructive">*</span>
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
                    {state.form.formState.errors.body.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1">
                <Label htmlFor="invoice-policy-sort-order">
                  {t("invoicePolicies.fields.sortOrder")}
                </Label>
                <Input
                  id="invoice-policy-sort-order"
                  type="number"
                  disabled={state.busy}
                  {...state.form.register("sortOrder", { valueAsNumber: true })}
                />
              </div>

              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t("invoicePolicies.fields.active")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("invoicePolicies.form.activeHint")}
                  </p>
                </div>
                <Switch
                  checked={active}
                  disabled={state.busy}
                  onCheckedChange={(checked) => state.form.setValue("active", checked, { shouldDirty: true })}
                  aria-label={t("invoicePolicies.fields.active")}
                />
              </div>
            </FormSection>
          </FormBody>
          <FormFooter
            error={state.error}
            isSubmitting={state.busy}
            submitLabel={t("common.actions.save")}
            onCancel={() => state.setOpen(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
