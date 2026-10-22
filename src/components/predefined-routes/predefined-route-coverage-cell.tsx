"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

export function PredefinedRouteCoverageCell({ entries }: { entries: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  if (!entries.length) return <>{t("common.empty.dash")}</>;
  const visible = expanded ? entries : entries.slice(0, 5);
  return <div className="flex max-w-xl flex-wrap gap-1">
    {visible.map((entry) => <Badge key={entry.toLowerCase()} variant="secondary">{entry}</Badge>)}
    {entries.length > 5 && <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-primary" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
      {expanded ? t("predefinedRoutes.showLess") : t("predefinedRoutes.showMore", { count: entries.length - 5 })}
    </Button>}
  </div>;
}
