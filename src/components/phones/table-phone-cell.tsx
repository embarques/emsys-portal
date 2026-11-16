"use client";

import { useState } from "react";
import { Star } from "lucide-react";

import { ADDRESS_TEXT_WRAP_CLASSNAME } from "@/lib/customers/utils/address-utils";
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

  return (
    <div className={cn("w-full", ADDRESS_TEXT_WRAP_CLASSNAME, className)}>
      <div className={cn("flex w-full flex-col gap-0.5", ADDRESS_TEXT_WRAP_CLASSNAME)}>
        {(expanded ? entries : entries.slice(0, 2)).map(({ phone, display }, index) => {
          const dial = (phone.number || display).replace(/[^\d+]/g, "");
          return (
            <span key={`${phone.number}-${index}`} className="flex flex-wrap items-center gap-1.5 leading-snug">
              {callable && dial ? (
                <a href={`tel:${dial}`} className="whitespace-nowrap tabular-nums hover:underline" onClick={(event) => event.stopPropagation()}>{display}</a>
              ) : <span className="whitespace-nowrap tabular-nums">{display}</span>}
              {phone.isPrimary ? (
                <Star
                  className="size-3 shrink-0 fill-current text-amber-500"
                  aria-label={t("phones.primary")}
                />
              ) : null}
            </span>
          );
        })}
      </div>
      {entries.length >= 3 ? (
        <button
          type="button"
          data-stop-row-click
          aria-expanded={onShowAll ? undefined : expanded}
          className="mt-0.5 text-left text-xs font-medium text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            if (onShowAll) onShowAll();
            else setExpanded((value) => !value);
          }}
        >
          {t("phones.countBadge", { count: entries.length })}
        </button>
      ) : null}
    </div>
  );
}
