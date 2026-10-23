"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAppSelector } from "@/lib/store/hooks";
import { store } from "@/lib/store/store";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { fetchInvoiceSignatureOptions } from "@/lib/invoices/api/invoice-print-options-api";
import { invoicePrintFormSchema, MAX_SIGNATURE_PRINT_INVOICES, type InvoicePrintForm, type InvoicePrintDelivery } from "@/lib/invoices/schemas/invoice-print.schema";
import { buildInvoiceSignatureSelections, validateInvoiceSignatureSelections } from "@/lib/invoices/utils/print-signatures";
import type { BaseSyntheticEvent } from "react";
import { reserveInvoiceReportWindow, openInvoiceReportUrl } from "@/lib/invoices/print-invoice-report";
import { useGenerateInvoiceReport } from "@/lib/reports/hooks/use-reports";

export function useInvoicePrintSignatures(invoiceIds: string[], onPrinted: () => void, trip?: InvoicePrintDelivery) {
  const { t } = useTranslation();
  const { hasPermission, isAuthenticated, user, email } = useAuth();
  const companyId = useAppSelector((state) => state.auth.companyId);
  const actorId = user?.uid || email || "";
  const canPrint = isAuthenticated && Boolean(companyId) && hasPermission(PERMISSIONS.invoicesPrint.name, PERMISSIONS.invoicesPrint.resourceType);
  const ids = useMemo(() => [...new Set(invoiceIds.map((id) => id.trim()).filter(Boolean))], [invoiceIds]);
  const withinLimit = ids.length > 0 && ids.length <= MAX_SIGNATURE_PRINT_INVOICES;
  const scope = JSON.stringify([companyId, actorId, ids, trip?.deliveryId]);
  const query = useWorkspaceQuery({
    queryKey: queryKeys.invoices.signatureOptions(companyId, actorId, ids),
    queryFn: ({ signal }) => fetchInvoiceSignatureOptions(ids, signal),
    enabled: canPrint && withinLimit,
    staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
  });
  const form = useForm<InvoicePrintForm>({ resolver: zodResolver(invoicePrintFormSchema), defaultValues: { selections: [] } });
  const [initializedScope, setInitializedScope] = useState("");
  useEffect(() => {
    if (query.data && initializedScope !== scope) {
      form.reset({ selections: buildInvoiceSignatureSelections(query.data, "sender", trip) });
      setInitializedScope(scope);
    }
  }, [form, initializedScope, query.data, scope, trip]);
  const generation = useGenerateInvoiceReport();
  const { notifySuccess } = useFeedback();
  const submitting = useRef(false);
  const [generatedReport, setGeneratedReport] = useState<{ scope: string; url: string } | null>(null);
  const reportUrl = generatedReport?.scope === scope ? generatedReport.url : null;
  function submit(event?: BaseSyntheticEvent) {
    event?.preventDefault();
    if (submitting.current) return;
    const current = store.getState().auth;
    if (!canPrint || !withinLimit || !query.data || initializedScope !== scope || companyId !== current.companyId) {
      form.setError("root", { message: t("invoices.printSignatures.unavailable") }); return;
    }
    // Reserve the tab before RHF's async validation and report generation lose
    // the browser's user activation (especially on mobile Safari).
    submitting.current = true;
    let target: Window | null = null;
    try { target = reserveInvoiceReportWindow(t("invoices.printSignatures.title"), t("invoices.printSignatures.printing")); } catch { /* Show a direct PDF link if a browser blocks the tab. */ }
    const token = current.idToken;
    form.clearErrors("root");
    setGeneratedReport(null);
    return form.handleSubmit(async (values) => {
      try {
        if (!validateInvoiceSignatureSelections(query.data!, values.selections)) throw new Error(t("invoices.printSignatures.unavailable"));
        const report = await generation.mutateAsync({ type: "invoice", collection: "invoices", values: ids, lookupField: "id", signatureSelections: values.selections });
        const session = store.getState().auth;
        if (companyId !== session.companyId || token !== session.idToken) throw new Error(t("invoices.printSignatures.unavailable"));
        if (!openInvoiceReportUrl(report.url, target)) {
          setGeneratedReport({ scope, url: report.url });
          form.setError("root", { message: t("invoices.printSignatures.popupBlocked") });
          return;
        }
        notifySuccess(t("invoices.printSignatures.ready"));
        onPrinted();
      } catch (error) {
        target?.close();
        form.setError("root", { message: normalizeApiError(error).message });
      } finally { submitting.current = false; generation.reset(); }
    }, () => { target?.close(); submitting.current = false; })(event);
  }
  function applyDefault(mode: "sender" | "latest") {
    if (!query.data || submitting.current) return;
    form.setValue("selections", buildInvoiceSignatureSelections(query.data, mode), { shouldDirty: true, shouldValidate: true });
  }
  return { query, form, submit, reportUrl, applyDefault, canPrint, withinLimit, initialized: initializedScope === scope, busy: form.formState.isSubmitting, invoiceCount: ids.length, companyId };
}
