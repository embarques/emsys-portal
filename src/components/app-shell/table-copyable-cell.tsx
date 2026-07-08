"use client";

import { Copy } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type TableCopyableCellProps = {
  value: string;
  children?: React.ReactNode;
  truncate?: boolean;
  className?: string;
};

export function TableCopyableCell({
  value,
  children,
  truncate = true,
  className,
}: TableCopyableCellProps) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();

  async function handleCopy(event: React.MouseEvent) {
    event.stopPropagation();
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      notifySuccess(t("common.table.copy.success"));
    } catch {
      notifyError(t("common.table.copy.error"));
    }
  }

  return (
    <div className={cn("group/copy relative flex min-w-0 items-start gap-0.5", className)}>
      <span className={cn("min-w-0 flex-1 cursor-text select-text", truncate && "truncate")}>
        {children ?? value}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            data-stop-row-click
            className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover/copy:opacity-100"
            aria-label={t("common.table.copy.action")}
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("common.table.copy.action")}</TooltipContent>
      </Tooltip>
    </div>
  );
}
