"use client";

import { useMemo, useState } from "react";
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
import { useTranslation } from "@/lib/i18n";

/** Purposes that may only appear once per order. */
const SINGLE_USE_PURPOSES = new Set<string>(["ESTIMATE", "PAYMENT", "OTHER"]);

type CommentField = "purpose" | "item" | "quantity" | "note";

type EditingCell = { index: number; field: CommentField } | null;

const cellButtonClassName =
  "flex h-9 w-full items-center truncate rounded-md px-2 text-left text-sm hover:bg-muted/60";

function isMobileViewportNow() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

type OrderCommentsEditorProps = {
  comments: OrderCommentFormValues[];
  onChange: (comments: OrderCommentFormValues[]) => void;
};

export function OrderCommentsEditor({ comments, onChange }: OrderCommentsEditorProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EditingCell>(null);

  const purposeLabel = (value: string) =>
    ORDER_COMMENT_PURPOSES.find((purpose) => purpose.value === value)
      ? t(`orders.comments.purposes.${value}`)
      : "";

  const itemLabel = (value: string) =>
    ORDER_COMMENT_ITEM_TYPES.find((item) => item.value === value)
      ? t(`orders.comments.items.${value}`)
      : "";

  const localizedPurposes = useMemo(
    () =>
      ORDER_COMMENT_PURPOSES.map((purpose) => ({
        value: purpose.value,
        label: t(`orders.comments.purposes.${purpose.value}`),
      })),
    [t],
  );

  const localizedItems = useMemo(
    () =>
      ORDER_COMMENT_ITEM_TYPES.map((item) => ({
        value: item.value,
        label: t(`orders.comments.items.${item.value}`),
      })),
    [t],
  );

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

    return localizedPurposes.map((purpose) => ({
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

    return localizedItems.map((item) => ({
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
      quantity: "1",
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
    if (isMobileViewportNow()) {
      stopEditing();
      return;
    }
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
          <h3 className="text-sm font-semibold leading-none text-foreground">{t("orders.comments.title")}</h3>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addComment}>
          <Plus className="h-4 w-4" />
          {t("orders.comments.add")}
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t("orders.empty.noComments")}
        </p>
      ) : (
        <>
        <div className="space-y-3 md:hidden" data-enter-navigation="ignore">
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
              <div key={`mobile-comment-${index}`} className="space-y-3 rounded-xl border bg-background p-3 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {t("orders.comments.title")} {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-destructive hover:text-destructive"
                    aria-label={t("orders.comments.removeAria", { index: index + 1 })}
                    onClick={() => removeComment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("orders.comments.columns.purpose")}
                  </p>
                  <SearchableSelect
                    id={`mobile-comment-purpose-${index}`}
                    value={comment.purpose}
                    onValueChange={(value) => changePurpose(index, value)}
                    placeholder={t("orders.comments.placeholders.purpose")}
                    options={purposeOptionsForRow(index)}
                    mobileSheet
                  />
                </div>

                {requiresItem ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("orders.comments.columns.item")}
                    </p>
                    <SearchableSelect
                      id={`mobile-comment-item-${index}`}
                      value={comment.itemType}
                      onValueChange={(value) =>
                        updateComment(index, {
                          itemType: value as OrderCommentItemType,
                          customItem: value === "other" ? comment.customItem : "",
                          quantity: comment.quantity || "1",
                        })
                      }
                      placeholder={t("orders.comments.placeholders.item")}
                      options={itemOptionsForRow(index)}
                      mobileSheet
                    />
                  </div>
                ) : null}

                {requiresItem && comment.itemType && comment.itemType !== "other" ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("orders.comments.columns.qty")}
                    </p>
                    <Input
                      id={`mobile-comment-quantity-${index}`}
                      type="number"
                      min="1"
                      className="h-11 rounded-xl text-base"
                      value={comment.quantity || "1"}
                      onChange={(event) => updateComment(index, { quantity: event.target.value || "1" })}
                    />
                  </div>
                ) : null}

                {noteField ? (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("orders.comments.columns.comment")}
                    </p>
                    <Input
                      id={`mobile-comment-note-${index}`}
                      className="h-11 rounded-xl text-base"
                      value={comment[noteField]}
                      placeholder={
                        noteField === "customItem"
                          ? t("orders.comments.placeholders.customItem")
                          : t("orders.comments.placeholders.note")
                      }
                      onChange={(event) => updateComment(index, { [noteField]: event.target.value })}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={addComment}
          >
            <Plus className="h-4 w-4" />
            {t("orders.comments.add")}
          </Button>
        </div>

        <div className="hidden overflow-hidden rounded-xl border md:block">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="w-32 shrink-0">{t("orders.comments.columns.purpose")}</span>
            <span className="w-28 shrink-0">{t("orders.comments.columns.item")}</span>
            <span className="w-16 shrink-0">{t("orders.comments.columns.qty")}</span>
            <span className="flex-1">{t("orders.comments.columns.comment")}</span>
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
                        autoFocus
                        defaultOpen
                        onClose={stopEditing}
                        value={comment.purpose}
                        onValueChange={(value) => {
                          changePurpose(index, value);
                          focusNextAfterPurpose(index, value);
                        }}
                        placeholder={t("orders.comments.placeholders.purpose")}
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
                          <span className="text-muted-foreground">{t("orders.comments.placeholders.purpose")}</span>
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
                          autoFocus
                          defaultOpen
                          onClose={stopEditing}
                          value={comment.itemType}
                          onValueChange={(value) => {
                            updateComment(index, {
                              itemType: value as OrderCommentItemType,
                              customItem: value === "other" ? comment.customItem : "",
                              quantity: comment.quantity || "1",
                            });
                            // Custom items need a description first; known items jump to quantity.
                            setEditing({ index, field: value === "other" ? "note" : "quantity" });
                          }}
                          placeholder={t("orders.comments.placeholders.item")}
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
                            <span className="text-muted-foreground">{t("orders.comments.placeholders.item")}</span>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="px-2 text-sm text-muted-foreground">{t("common.empty.dash")}</span>
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
                      <span className="px-2 text-sm text-muted-foreground">{t("common.empty.dash")}</span>
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
                              ? t("orders.comments.placeholders.customItem")
                              : t("orders.comments.placeholders.note")
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
                              {noteField === "customItem"
                                ? t("orders.comments.placeholders.customItem")
                                : t("orders.comments.placeholders.addComment")}
                            </span>
                          )}
                        </button>
                      )
                    ) : (
                      <span className="px-2 text-sm text-muted-foreground">{t("common.empty.dash")}</span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-destructive hover:text-destructive"
                    aria-label={t("orders.comments.removeAria", { index: index + 1 })}
                    onClick={() => removeComment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}
    </section>
  );
}
