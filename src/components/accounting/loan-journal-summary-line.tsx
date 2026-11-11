"use client";

import { formatLoanMoney } from "@/lib/accounting/loans/display";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Account and amount of one journal side, for the compact current-transaction summary. */
export function JournalSummaryLine({ account, amount }: { account?: string; amount?: number }) {
  const { t } = useTranslation();
  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className={cn(!account && "text-muted-foreground")}>{account || t("accounting.loans.journalPreview.selectAccount")}</span>
      <span>{formatLoanMoney(amount ?? 0)}</span>
    </span>
  );
}
