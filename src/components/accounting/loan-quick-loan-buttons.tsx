"use client";

import { Button } from "@/components/ui/button";
import type { Loan } from "@/lib/accounting/loans/types";
import { sortLoansOldestFirst } from "@/lib/accounting/loans/payment-allocation";
import { useTranslation } from "@/lib/i18n";

type Props = {
  loans: Loan[];
  disabled?: boolean;
  onSelect: (loan: Loan) => void;
};

function sortLoansNewestFirst(loans: Loan[]): Loan[] {
  return [...loans].sort(
    (left, right) =>
      right.openedAt.localeCompare(left.openedAt) || right.createdAt.localeCompare(left.createdAt),
  );
}

/** One-click oldest / newest active-loan prefill next to the loan picker. */
export function LoanQuickLoanButtons({ loans, disabled = false, onSelect }: Props) {
  const { t } = useTranslation();
  if (loans.length === 0) return null;

  const oldest = sortLoansOldestFirst(loans)[0];
  const newest = sortLoansNewestFirst(loans)[0];
  if (!oldest || !newest) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full max-md:min-h-12"
        disabled={disabled}
        onClick={() => onSelect(oldest)}
      >
        {t("accounting.loans.quickLoan.oldest")}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full max-md:min-h-12"
        disabled={disabled}
        onClick={() => onSelect(newest)}
      >
        {t("accounting.loans.quickLoan.newest")}
      </Button>
    </div>
  );
}
