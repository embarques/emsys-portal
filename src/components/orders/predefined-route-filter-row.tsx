"use client";

import { Plus } from "lucide-react";
import { TableFilterSelect } from "@/components/app-shell/table-filter-select";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldOption } from "@/lib/table/filter-types";

type Props = {
  value: string;
  options: TableFilterFieldOption[];
  loading: boolean;
  error?: string;
  canCreate: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
  onRetry: () => void;
};

export function PredefinedRouteFilterRow({ value, options, loading, error, canCreate, onChange, onAdd, onRetry }: Props) {
  const { t } = useTranslation();
  return (
    <div className="mt-6 space-y-3 border-t border-border pt-5 pb-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="w-14 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("predefinedRoutes.routeLabel")}</span>
        <div className="min-w-0 flex-1">
        <TableFilterSelect
          aria-label={t("predefinedRoutes.title")}
          className="min-w-0 flex-1"
          value={value || "all"}
          options={[{ value: "all", label: t("predefinedRoutes.all") }, ...options]}
          disabled={loading || Boolean(error)}
          onChange={(next) => onChange(next === "all" ? "" : next)}
        />
        </div>
        {canCreate && <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={onAdd} aria-label={t("predefinedRoutes.add")} title={t("predefinedRoutes.add")}><Plus className="size-4" /></Button>}
      </div>
      {loading && <p role="status" className="pl-16 text-xs text-muted-foreground">{t("common.loading")}</p>}
      {error && <div role="alert" className="flex items-center gap-2 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={onRetry}>{t("predefinedRoutes.retry")}</Button></div>}
    </div>
  );
}
