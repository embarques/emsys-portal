"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCommentPurposeLabel } from "@/lib/orders/display";
import {
  ORDER_COMMENT_PURPOSES,
  createEmptyOrderComment,
  type OrderCommentFormValues,
  type OrderCommentPurpose,
} from "@/lib/orders/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type OrderCommentsEditorProps = {
  comments: OrderCommentFormValues[];
  onChange: (comments: OrderCommentFormValues[]) => void;
};

function getPurposeMeta(purpose: OrderCommentPurpose) {
  return ORDER_COMMENT_PURPOSES.find((entry) => entry.value === purpose)!;
}

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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Comments</h3>
          <p className="text-sm text-muted-foreground">Add purpose-driven comments for this order.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addComment}>
          <Plus className="h-4 w-4" />
          Add comment
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          No comments yet. Add estimates, payment notes, pickup/take quantities, or free-form comments.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment, index) => {
            const meta = getPurposeMeta(comment.purpose);
            const isOtherQuantity =
              comment.purpose === "take_other" || comment.purpose === "pickup_other";

            return (
              <div key={comment.id} className="rounded-xl border bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    Comment {index + 1}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeComment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor={`${comment.id}-purpose`}>Purpose</Label>
                    <select
                      id={`${comment.id}-purpose`}
                      className={selectClassName}
                      value={comment.purpose}
                      onChange={(event) =>
                        updateComment(index, {
                          purpose: event.target.value as OrderCommentPurpose,
                          note: "",
                          quantity: "1",
                          description: "",
                          text: "",
                        })
                      }
                    >
                      {ORDER_COMMENT_PURPOSES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {meta.allowsNote ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`${comment.id}-note`}>Optional note</Label>
                      <textarea
                        id={`${comment.id}-note`}
                        value={comment.note}
                        onChange={(event) => updateComment(index, { note: event.target.value })}
                        rows={2}
                        className={textareaClassName}
                        placeholder={`Additional details for ${getCommentPurposeLabel(comment.purpose).toLowerCase()}...`}
                      />
                    </div>
                  ) : null}

                  {meta.requiresQuantity ? (
                    <div className="space-y-2">
                      <Label htmlFor={`${comment.id}-quantity`}>
                        Quantity <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`${comment.id}-quantity`}
                        type="number"
                        min={1}
                        value={comment.quantity}
                        onChange={(event) => updateComment(index, { quantity: event.target.value })}
                        required
                      />
                    </div>
                  ) : null}

                  {isOtherQuantity ? (
                    <div className="space-y-2">
                      <Label htmlFor={`${comment.id}-description`}>Description</Label>
                      <Input
                        id={`${comment.id}-description`}
                        value={comment.description}
                        onChange={(event) => updateComment(index, { description: event.target.value })}
                        placeholder="What is being taken or picked up?"
                      />
                    </div>
                  ) : null}

                  {meta.requiresText ? (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor={`${comment.id}-text`}>
                        Comment <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        id={`${comment.id}-text`}
                        value={comment.text}
                        onChange={(event) => updateComment(index, { text: event.target.value })}
                        rows={3}
                        className={textareaClassName}
                        placeholder="Enter the comment..."
                        required
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
