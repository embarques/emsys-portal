"use client";

import { useMemo } from "react";
import { useColumnVisibility } from "@/components/app-shell/use-column-visibility";
import { useTranslation } from "@/lib/i18n";
import { formatAuditDateTime } from "@/lib/audit/display";
import { formatTableColumnLabel } from "@/lib/table/column-labels";
import { completeApiTableColumns, type ApiTableField, type ApiTableRecord } from "@/lib/table/api-table-fields";
import type { DataTableColumn } from "@/lib/table/types";

/** Add documented response columns while retaining each feature's existing cell renderers. */
export function useApiTableColumns<T extends ApiTableRecord>(
  storageKey: string,
  columns: DataTableColumn<T>[],
  fields: readonly ApiTableField[],
) {
  const { t, locale } = useTranslation();
  const completeColumns = useMemo(() => completeApiTableColumns(columns, fields, {
    label: (field) => {
      const key = `common.apiColumns.${field}`;
      const translated = t(key);
      return translated === key ? formatTableColumnLabel(field.replaceAll("_", " ")) : translated;
    },
    date: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : formatAuditDateTime(value),
    number: (value) => new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(value),
    yes: t("common.apiColumns.yes"),
    no: t("common.apiColumns.no"),
    empty: t("common.empty.dash"),
  }), [columns, fields, locale, t]);

  // Start the expanded schema layout with every column visible; subsequent choices persist.
  return useColumnVisibility(`${storageKey}-api-fields-v1`, completeColumns);
}
