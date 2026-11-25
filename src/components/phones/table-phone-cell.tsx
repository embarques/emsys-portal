"use client";

import { useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { getRecordPhoneDisplayNumber } from "@/lib/phones/phones";
import { cn } from "@/lib/utils";

type TablePhoneCellProps = {
  phones: { number: string; displayNumber?: string; isPrimary?: boolean }[];
  className?: string;
  callable?: boolean;
  onShowAll?: () => void;
};

export function TablePhoneCell({ phones, className, callable = false, onShowAll }: TablePhoneCellProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const entries = phones
    .map((phone) => ({ phone, display: getRecordPhoneDisplayNumber(phone).trim() }))
    .filter(({ display }) => display.length > 0)
    .sort((a, b) => Number(Boolean(b.phone.isPrimary)) - Number(Boolean(a.phone.isPrimary)));

  if (entries.length === 0) return <span>{t("common.empty.dash")}</span>;

  const moreCount = entries.length - 1;
  const showInlineExpanded = expanded && !onShowAll;
  const visible = showInlineExpanded ? entries : entries.slice(0, 1);

  function handleShowMore(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (onShowAll) {
      onShowAll();
      return;
    }
    setExpanded((value) => !value);
  }

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "flex min-w-0",
          showInlineExpanded ? "flex-col items-start gap-0.5" : "items-center gap-1.5",
        )}
      >
        {visible.map(({ phone, display }, index) => {
          const dial = (phone.number || display).replace(/[^\d+]/g, "");
          return (
            <span key={`${phone.number}-${index}`} className="min-w-0 truncate leading-snug">
              {callable && dial ? (
                <a
                  href={`tel:${dial}`}
                  className="whitespace-nowrap tabular-nums hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {display}
                </a>
              ) : (
                <span className="whitespace-nowrap tabular-nums">{display}</span>
              )}
            </span>
          );
        })}
        {moreCount > 0 && !showInlineExpanded ? (
          <button
            type="button"
            data-stop-row-click
            aria-label={t("phones.moreCountAria", { count: moreCount })}
            className="shrink-0 whitespace-nowrap font-medium text-primary hover:underline"
            onClick={handleShowMore}
          >
            {t("phones.moreCount", { count: moreCount })}
          </button>
        ) : null}
      </div>
    </div>
  );
}
