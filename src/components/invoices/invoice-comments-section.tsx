"use client";

import { useState } from "react";
import { MessageSquare, MessageSquarePlus } from "lucide-react";

import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { Button } from "@/components/ui/button";
import {
  CompactTableScroll,
  compactTableCellClassName,
  compactTableCellWrapClassName,
  compactTableClassName,
  compactTableHeadClassName,
  compactTableHeadRowClassName,
  compactTableRowClassName,
} from "@/components/ui/compact-table";
import { Label } from "@/components/ui/label";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { InvoiceComment } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type InvoiceCommentsSectionProps = {
  comments: InvoiceComment[];
  onAddComment: (description: string) => void;
};

function isFilled(value: string): boolean {
  const trimmed = value.trim();
  return trimmed !== "" && trimmed !== "—" && trimmed !== "-";
}

export function InvoiceCommentsSection({ comments, onAddComment }: InvoiceCommentsSectionProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const description = draft.trim();
    if (!description) {
      setError(t("invoices.view.comments.validationRequired"));
      return;
    }

    onAddComment(description);
    setDraft("");
    setError(null);
  }

  const sortedComments = [...comments].reverse();
  const empty = t("common.empty.dash");

  return (
    <RecordViewSheetSection
      title={t("invoices.view.comments.title", { count: comments.length })}
      icon={MessageSquare}
    >
      {sortedComments.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.comments.empty")}</p>
      ) : (
        <CompactTableScroll aria-label={t("invoices.view.comments.title", { count: comments.length })}>
          <table className={compactTableClassName}>
            <thead>
              <tr className={compactTableHeadRowClassName}>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.comments.fields.date")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.comments.fields.createdBy")}
                </th>
                <th className={compactTableHeadClassName}>
                  {t("invoices.view.comments.fields.description")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedComments.map((comment) => {
                const date = comment.createdAt ? formatInvoiceCommentDateTime(comment.createdAt) : "";
                const createdBy = comment.createdBy?.trim() ?? "";
                const description = comment.description?.trim() ?? "";
                return (
                  <tr key={comment.id} className={compactTableRowClassName}>
                    <td className={compactTableCellClassName}>
                      {isFilled(date) ? date : empty}
                    </td>
                    <td className={compactTableCellClassName}>
                      {isFilled(createdBy) ? createdBy : empty}
                    </td>
                    <td className={cn(compactTableCellWrapClassName, "whitespace-pre-wrap")}>
                      {isFilled(description) ? description : empty}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CompactTableScroll>
      )}
      <div className="border-t bg-muted/20 px-3 py-3">
        <Label
          htmlFor="invoiceComment"
          className="min-h-0 py-0 text-xs font-medium text-muted-foreground"
        >
          {t("invoices.view.comments.addLabel")}
        </Label>
        <div
          className={cn(
            "mt-1.5 overflow-hidden rounded-lg border bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            error && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
          )}
        >
          <textarea
            id="invoiceComment"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            rows={2}
            className="block w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t("invoices.view.comments.placeholder")}
          />
          <div className="flex justify-end px-2 pb-2">
            <Button type="button" size="sm" onClick={handleSubmit} disabled={!draft.trim()}>
              <MessageSquarePlus className="h-4 w-4" />
              {t("invoices.view.comments.postAction")}
            </Button>
          </div>
        </div>
        {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      </div>
    </RecordViewSheetSection>
  );
}
