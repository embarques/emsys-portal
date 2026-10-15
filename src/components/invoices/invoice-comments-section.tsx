"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { RecordViewList } from "@/components/app-shell/record-view-list";
import { RecordViewSheetSection } from "@/components/app-shell/record-view-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InvoiceViewField, InvoiceViewListItem } from "@/components/invoices/invoice-view-field";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { InvoiceComment } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";

type InvoiceCommentsSectionProps = {
  comments: InvoiceComment[];
  onAddComment: (description: string) => void;
};

const commentFieldClassName = "min-w-0 [&_span:last-child]:break-words";

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

  return (
    <RecordViewSheetSection title={t("invoices.view.comments.title", { count: comments.length })}>
      {sortedComments.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t("invoices.view.comments.empty")}</p>
      ) : (
        <RecordViewList className="bg-muted/20 p-3">
          {sortedComments.map((comment) => (
            <InvoiceViewListItem key={comment.id}>
              <div className="grid grid-cols-2 gap-x-4">
                <InvoiceViewField
                  className={commentFieldClassName}
                  label={t("invoices.view.comments.fields.date")}
                  value={comment.createdAt ? formatInvoiceCommentDateTime(comment.createdAt) : undefined}
                />
                <InvoiceViewField
                  className={commentFieldClassName}
                  label={t("invoices.view.comments.fields.createdBy")}
                  value={comment.createdBy || undefined}
                />
              </div>
              <InvoiceViewField
                className={commentFieldClassName}
                label={t("invoices.view.comments.fields.description")}
                value={<span className="whitespace-pre-wrap">{comment.description}</span>}
              />
            </InvoiceViewListItem>
          ))}
        </RecordViewList>
      )}
      <div className="space-y-2 border-t px-4 py-4">
        <Label htmlFor="invoiceComment">{t("invoices.view.comments.addLabel")}</Label>
        <textarea
          id="invoiceComment"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder={t("invoices.view.comments.placeholder")}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="button" size="sm" onClick={handleSubmit}>
          <MessageSquarePlus className="h-4 w-4" />
          {t("invoices.view.comments.postAction")}
        </Button>
      </div>
    </RecordViewSheetSection>
  );
}
