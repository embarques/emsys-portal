"use client";

import { AlertCircle } from "lucide-react";
import type { AssignedDeliveryBarcode } from "@/lib/deliveries/types";
import { useTranslation } from "@/lib/i18n";

export function DeliveryActionNotice({ row }: { row: AssignedDeliveryBarcode }) {
  const { t } = useTranslation();
  const reason = !row.invoiceId
    ? "deliveries.missingInvoice"
    : !row.delivery?.id
      ? "deliveries.missingConduce"
      : null;
  if (!reason) return null;
  return (
    <p className="mt-2 flex max-w-xs items-start gap-1.5 whitespace-normal text-left text-xs leading-relaxed text-amber-700 dark:text-amber-400">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{t(reason)}</span>
    </p>
  );
}
