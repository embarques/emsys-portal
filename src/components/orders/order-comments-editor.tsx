"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmptyOrderComment, type OrderCommentFormValues } from "@/lib/orders/types";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type OrderCommentsEditorProps = {
  comments: OrderCommentFormValues[];
  onChange: (comments: OrderCommentFormValues[]) => void;
};

export function OrderCommentsEditor({ comments, onChange }: OrderCommentsEditorProps) {
  function updateComment(index: number, patch: Partial<OrderCommentFormValues>) {
    onChange(comments.map((comment, commentIndex) => (commentIndex === index ? { ...comment, ...patch } : comment)));
  }

  function addComment() {
    onChange([...comments, createEmptyOrderComment()]);
  }

  function removeComment(index: number) {
    onChange(comments.filter((_, commentIndex) => commentIndex !== index));
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MessageSquare className="size-4" />
          </span>
          <div className="space-y-0.5">
            <h3 className="text-sm font-semibold leading-none text-foreground">Comments</h3>
            <p className="text-xs text-muted-foreground">
              Add pickup comment lines with purpose, unit, quantity, and description.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addComment}>
          <Plus className="h-4 w-4" />
          Add comment
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No comments yet.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment, index) => (
            <div key={`comment-${index}`} className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Comment {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeComment(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`comment-purpose-${index}`}>Purpose</Label>
                  <Input
                    id={`comment-purpose-${index}`}
                    value={comment.purpose}
                    onChange={(event) => updateComment(index, { purpose: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`comment-unit-${index}`}>Unit</Label>
                  <Input
                    id={`comment-unit-${index}`}
                    value={comment.unit}
                    onChange={(event) => updateComment(index, { unit: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`comment-quantity-${index}`}>Quantity</Label>
                  <Input
                    id={`comment-quantity-${index}`}
                    type="number"
                    min="0"
                    value={comment.quantity}
                    onChange={(event) => updateComment(index, { quantity: event.target.value })}
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`comment-description-${index}`}>Description</Label>
                  <textarea
                    id={`comment-description-${index}`}
                    className={textareaClassName}
                    value={comment.description}
                    onChange={(event) => updateComment(index, { description: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
