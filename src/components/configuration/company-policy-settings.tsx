"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useCurrentCompany, useUpdateCompanyPolicy } from "@/lib/company/hooks/use-current-company";
import { createCompanyPolicySchema } from "@/lib/company/policy-schema";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanyPolicySettings() {
  const { hasPermission, companyId } = useAuth();
  if (!hasPermission("canUpdateSettings", "settings")) return null;
  return <CompanyPolicyForm key={companyId} />;
}

function CompanyPolicyForm() {
  const { t } = useTranslation();
  const company = useCurrentCompany();
  const mutation = useUpdateCompanyPolicy();
  const { notifySuccess } = useFeedback();
  const schema = useMemo(() => createCompanyPolicySchema(t("settings.companyPolicy.invalid")), [t]);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<{ policyUrl: string }>({
    resolver: zodResolver(schema), defaultValues: { policyUrl: "" },
  });
  useEffect(() => { if (company.data && !isDirty) reset({ policyUrl: company.data.policyUrl ?? "" }); }, [company.data, reset, isDirty]);
  const error = company.error ?? mutation.error;
  async function save(values: { policyUrl: string }) {
    if (values.policyUrl === (company.data?.policyUrl ?? "").trim()) {
      notifySuccess(t("common.form.noChanges")); return;
    }
    try {
      const saved = await mutation.mutateAsync(values);
      reset({ policyUrl: saved.policyUrl ?? "" });
      notifySuccess(t("settings.toast.saved"));
    } catch { /* Preserve entered values; mutation error appears below. */ }
  }
  return <Card>
    <CardHeader><CardTitle>{t("settings.companyPolicy.title")}</CardTitle><CardDescription>{t("settings.companyPolicy.description")}</CardDescription></CardHeader>
    <CardContent>
      <form onSubmit={handleSubmit(save)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-policy-url">{t("settings.companyPolicy.label")}</Label>
          <Input id="company-policy-url" type="url" maxLength={2048} placeholder="https://" {...register("policyUrl")} disabled={company.isLoading || !company.data || isSubmitting} aria-invalid={Boolean(errors.policyUrl)} aria-describedby="company-policy-hint company-policy-error" />
          <p id="company-policy-hint" className="text-sm text-muted-foreground">{t("settings.companyPolicy.hint")}</p>
          <p id="company-policy-error" role="alert" className="text-sm text-destructive">{errors.policyUrl?.message}</p>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{normalizeApiError(error).message}</p> : null}
        <Button type="submit" disabled={company.isLoading || !company.data || isSubmitting}>{isSubmitting ? t("common.actions.saving") : t("settings.actions.save")}</Button>
      </form>
    </CardContent>
  </Card>;
}
