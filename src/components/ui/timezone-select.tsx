"use client";

import { useMemo } from "react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { getTimezoneOptions, timezoneOption } from "@/lib/timezones";

export function TimezoneSelect({ id, value, onValueChange }: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const { locale, t } = useTranslation();
  const options = useMemo(() => {
    const catalog = getTimezoneOptions(locale);
    // Preserve saved aliases or identifiers absent from the bundled catalog.
    return value && !catalog.some(option => option.value === value)
      ? [timezoneOption(value, locale), ...catalog]
      : catalog;
  }, [locale, value]);

  return <SearchableSelect
    id={id}
    value={value}
    onValueChange={onValueChange}
    options={options}
    required
    mobileSheet
    placeholder={t("accounting.financialActivity.timezone")}
    searchPlaceholder={t("accounting.financialActivity.searchTimezones")}
    emptyMessage={t("accounting.financialActivity.noTimezonesFound")}
  />;
}
