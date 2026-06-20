"use client";

import { useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  ORDER_COMMENT_ITEM_TYPES,
  ORDER_COMMENT_PURPOSES,
  createEmptyOrderComment,
  orderCommentPurposeRequiresItem,
  type OrderCommentFormValues,
  type OrderCommentItemType,
} from "@/lib/orders/types";

/** Purposes that may only appear once per order. */
const SINGLE_USE_PURPOSES = new Set<string>(["ESTIMATE", "PAYMENT", "OTHER"]);

function purposeLabel(value: string): string {
  return ORDER_COMMENT_PURPOSES.find((purpose) => purpose.value === value)?.label ?? "";
}

function itemLabel(value: string): string {
  return ORDER_COMMENT_ITEM_TYPES.find((item) => item.value === value)?.label ?? "";
}

type CommentField = "purpose" | "item" | "quantity" | "note";

type EditingCell = { index: number; field: CommentField } | null;

const cellButtonClassName =
  "flex h-9 w-full items-center truncate rounded-md px-2 text-left text-sm hover:bg-muted/60";

type OrderCommentsEditorProps = {
  comments: OrderCommentFormValues[];
  onChange: (comments: OrderCommentFormValues[]) => void;
};

export function OrderCommentsEditor({ comments, onChange }: OrderCommentsEditorProps) {
  const [editing, setEditing] = useState<EditingCell>(null);

  const isEditing = (index: number, field: CommentField) =>
    editing?.index === index && editing.field === field;

  const stopEditing = () => setEditing(null);

  // ESTIMATE and PAYMENT are limited to one per order; disable them on other rows once used.
  function purposeOptionsForRow(index: number) {
    const takenSingleUse = new Set(
      comments
        .filter((comment, commentIndex) => commentIndex !== index && SINGLE_USE_PURPOSES.has(comment.purpose))
        .map((comment) => comment.purpose),
    );

    return ORDER_COMMENT_PURPOSES.map((purpose) => ({
      value: purpose.value,
      label: purpose.label,
      disabled: takenSingleUse.has(purpose.value),
    }));
  }

  // Each item (including "Other") may only be used once per purpose within an order.
  function itemOptionsForRow(index: number) {
    const { purpose } = comments[index];
    const takenItems = new Set(
      comments
        .filter(
          (comment, commentIndex) =>
            commentIndex !== index && comment.purpose === purpose && comment.itemType,
        )
        .map((comment) => comment.itemType),
    );

    return ORDER_COMMENT_ITEM_TYPES.map((item) => ({
      value: item.value,
      label: item.label,
      disabled: takenItems.has(item.value),
    }));
  }

  function updateComment(index: number, patch: Partial<OrderCommentFormValues>) {
    onChange(comments.map((comment, commentIndex) => (commentIndex === index ? { ...comment, ...patch } : comment)));
  }

  function changePurpose(index: number, purpose: string) {
    // Reset purpose-specific fields so stale item/comment data isn't sent for the new purpose.
    updateComment(index, {
      purpose,
      itemType: "",
      customItem: "",
      quantity: "",
      description: "",
    });
  }

  // After picking a purpose, jump to the next field; with no further field, start another comment.
  function focusNextAfterPurpose(index: number, purpose: string) {
    if (!purpose) {
      stopEditing();
      return;
    }
    if (orderCommentPurposeRequiresItem(purpose)) {
      setEditing({ index, field: "item" });
      return;
    }
    setEditing({ index, field: "note" });
  }

  function addComment() {
    const newIndex = comments.length;
    onChange([...comments, createEmptyOrderComment()]);
    // Jump straight into the new comment's purpose so the user can keep entering.
    setEditing({ index: newIndex, field: "purpose" });
  }

  function removeComment(index: number) {
    onChange(comments.filter((_, commentIndex) => commentIndex !== index));
    stopEditing();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MessageSquare className="size-4" />
          </span>
          <h3 className="text-sm font-semibold leading-none text-foreground">Comments</h3>
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
        <div className="overflow-hidden rounded-xl border">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="w-32 shrink-0">Purpose</span>
            <span className="w-28 shrink-0">Item</span>
            <span className="w-16 shrink-0">Qty</span>
            <span className="flex-1">Comment</span>
            <span className="w-9 shrink-0" />
          </div>

          <div className="divide-y">
            {comments.map((comment, index) => {
              const requiresItem = orderCommentPurposeRequiresItem(comment.purpose);
              const isOtherItem = comment.itemType === "other";
              const noteField: "customItem" | "description" | null = requiresItem
                ? isOtherItem
                  ? "customItem"
                  : null
                : comment.purpose
                  ? "description"
                  : null;

              return (
                <div key={`comment-${index}`} className="flex items-center gap-2 px-2 py-1">
                  {/* Purpose */}
                  <div className="w-32 shrink-0">
                    {isEditing(index, "purpose") ? (
                      <SearchableSelect
                        id={`comment-purpose-${index}`}
                        searchable={false}
                        autoFocus
                        defaultOpen
                        onClose={stopEditing}
                        value={comment.purpose}
                        onValueChange={(value) => {
                          changePurpose(index, value);
                          focusNextAfterPurpose(index, value);
                        }}
                        placeholder="Purpose"
                        options={purposeOptionsForRow(index)}
                      />
                    ) : (
                      <button
                        type="button"
                        className={cellButtonClassName}
                        onDoubleClick={() => setEditing({ index, field: "purpose" })}
                      >
                        {comment.purpose ? (
                          purposeLabel(comment.purpose)
                        ) : (
                          <span className="text-muted-foreground">Purpose</span>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Item */}
                  <div className="w-28 shrink-0">
                    {requiresItem ? (
                      isEditing(index, "item") ? (
                        <SearchableSelect
                          id={`comment-item-${index}`}
                          searchable={false}
                          autoFocus
                          defaultOpen
                          onClose={stopEditing}
                          value={comment.itemType}
                          onValueChange={(value) => {
                            updateComment(index, {
                              itemType: value as OrderCommentItemType,
                              customItem: value === "other" ? comment.customItem : "",
                            });
                            // Custom items need a description first; known items jump to quantity.
                            setEditing({ index, field: value === "other" ? "note" : "quantity" });
                          }}
                          placeholder="Item"
                          options={itemOptionsForRow(index)}
                        />
                      ) : (
                        <button
                          type="button"
                          className={cellButtonClassName}
                          onDoubleClick={() => setEditing({ index, field: "item" })}
                        >
                          {comment.itemType ? (
                            itemLabel(comment.itemType)
                          ) : (
                            <span className="text-muted-foreground">Item</span>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="px-2 text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Quantity (not applicable to custom "other" items — qty goes in details) */}
                  <div className="w-16 shrink-0">
                    {requiresItem && comment.itemType && comment.itemType !== "other" ? (
                      isEditing(index, "quantity") ? (
                        <Input
                          id={`comment-quantity-${index}`}
                          type="number"
                          min="0"
                          autoFocus
                          className="h-9"
                          value={comment.quantity}
                          onChange={(event) => updateComment(index, { quantity: event.target.value })}
                          onBlur={stopEditing}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.shiftKey) return;
                            event.preventDefault();
                            addComment();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={cellButtonClassName}
                          onDoubleClick={() => setEditing({ index, field: "quantity" })}
                        >
                          {comment.quantity ? (
                            comment.quantity
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="px-2 text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Comment / note */}
                  <div className="flex-1">
                    {noteField ? (
                      isEditing(index, "note") ? (
                        <Input
                          id={`comment-note-${index}`}
                          autoFocus
                          className="h-9"
                          value={comment[noteField]}
                          placeholder={
                            noteField === "customItem"
                              ? "Describe the item and quantity"
                              : "Add a comment, press Enter to add another"
                          }
                          onChange={(event) => updateComment(index, { [noteField]: event.target.value })}
                          onBlur={stopEditing}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.shiftKey) return;
                            event.preventDefault();
                            // Custom "other" items keep the quantity in this details field, so
                            // both note types finish the comment and start a new one.
                            addComment();
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className={cellButtonClassName}
                          onDoubleClick={() => setEditing({ index, field: "note" })}
                        >
                          {comment[noteField] ? (
                            comment[noteField]
                          ) : (
                            <span className="text-muted-foreground">
                              {noteField === "customItem" ? "Describe the item and quantity" : "Add a comment"}
                            </span>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="px-2 text-sm text-muted-foreground">—</span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-destructive hover:text-destructive"
                    aria-label={`Remove comment ${index + 1}`}
                    onClick={() => removeComment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
