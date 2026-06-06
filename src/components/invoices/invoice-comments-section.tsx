"use client";

import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { formatInvoiceCommentDateTime } from "@/lib/invoices/display";
import type { InvoiceComment } from "@/lib/invoices/types";

type InvoiceCommentsSectionProps = {
  comments: InvoiceComment[];
  onAddComment: (description: string) => void;
};

export function InvoiceCommentsSection({ comments, onAddComment }: InvoiceCommentsSectionProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const description = draft.trim();
    if (!description) {
      setError("Comment description is required.");
      return;
    }

    onAddComment(description);
    setDraft("");
    setError(null);
  }

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Comments ({comments.length})
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Notes about reaching out, delivery preferences, and other follow-ups. Comments cannot be deleted.
      </p>

      <div className="mt-4 space-y-2">
        <Label htmlFor="invoiceComment">Add comment</Label>
        <textarea
          id="invoiceComment"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
          rows={3}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="e.g. Tried reaching out — customer only wants delivery in the morning."
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <Button type="button" size="sm" onClick={handleSubmit}>
          <MessageSquarePlus className="h-4 w-4" />
          Post comment
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {[...comments].reverse().map((comment) => (
            <li key={comment.id} className="rounded-lg border bg-background px-3 py-3 text-sm">
              <p className="whitespace-pre-wrap">{comment.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatInvoiceCommentDateTime(comment.createdAt)} · {comment.createdBy || DEFAULT_CREATED_BY}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
