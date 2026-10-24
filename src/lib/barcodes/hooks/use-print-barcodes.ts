"use client";

import { useRef } from "react";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { buildBarcodePrintRequest } from "@/lib/barcodes/print-barcodes";
import type { Barcode } from "@/lib/barcodes/types";
import { useUserError } from "@/lib/errors";
import { useTranslation } from "@/lib/i18n";
import { useGenerateLabelReport } from "@/lib/reports/hooks/use-reports";
import { openReportUrl } from "@/lib/reports/open-report";

export function usePrintBarcodes() {
  const { hasPermission } = useAuth();
  const canPrint = hasPermission(PERMISSIONS.packagesView.name, PERMISSIONS.packagesView.resourceType);
  const mutation = useGenerateLabelReport();
  const submitting = useRef(false);
  const { notifyError, notifySuccess } = useFeedback();
  const { toErrorMessage } = useUserError();
  const { t } = useTranslation();

  async function printBarcodes(barcodes: Barcode[]) {
    if (!canPrint || submitting.current) return;
    const request = buildBarcodePrintRequest(barcodes);
    if (!request) {
      notifyError(t("barcodes.print.missingIdentity"));
      return;
    }
    submitting.current = true;
    try {
      const { url } = await mutation.mutateAsync(request);
      openReportUrl(url);
      notifySuccess(t("barcodes.print.ready", { count: request.values.length }));
    } catch (error) {
      notifyError(toErrorMessage(error));
    } finally {
      submitting.current = false;
    }
  }

  return { canPrint, isPrinting: mutation.isPending, printBarcodes };
}
