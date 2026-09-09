"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { MessageSquare, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  ORDER_COMMENT_ITEM_TYPES,
  ORDER_COMMENT_PURPOSES,
  createEmptyOrderComment,
  isOrderCommentComplete,
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

/** Highlight quantity so typing replaces the default (usually 1). */
function highlightQuantityField(event: FocusEvent<HTMLInputElement>) {
  const target = event.currentTarget;
  window.requestAnimationFrame(() => target.select());
}

type OrderCommentsEditorProps = {
  comments: OrderCommentFormValues[];
  onChange: (comments: OrderCommentFormValues[]) => void;
};

export function OrderCommentsEditor({ comments, onChange }: OrderCommentsEditorProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<EditingCell>(null);
  const [mobileEditingIndex, setMobileEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<OrderCommentFormValues | null>(null);
  const advancingRef = useRef(false);
  const draftRef = useRef<OrderCommentFormValues | null>(null);

  useEffect(() => {
    if (editing?.field !== "quantity") return;

    const index = editing.index;
    const timer = window.setTimeout(() => {
      const input =
        (document.getElementById(`comment-quantity-${index}`) as HTMLInputElement | null) ??
        (document.getElementById(`mobile-comment-quantity-${index}`) as HTMLInputElement | null);
      if (!input) return;
      input.focus();
      input.select();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [editing]);

  function setDraftState(next: OrderCommentFormValues | null) {
    draftRef.current = next;
    setDraft(next);
  }

  const rows = draft ? [...comments, draft] : comments;
  const draftIndex = comments.length;

  function isDraftIndex(index: number) {
    return draft !== null && index === draftIndex;
  }

  function commentAt(index: number): OrderCommentFormValues {
    return rows[index];
  }

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

  function isMobileCommentComplete(comment: OrderCommentFormValues): boolean {
    return isOrderCommentComplete(comment);
  }

  function mobileCommentDescription(comment: OrderCommentFormValues): string {
    if (!comment.purpose) return t("common.empty.dash");
    if (!orderCommentPurposeRequiresItem(comment.purpose)) {
      return comment.description || t("common.empty.dash");
    }
    if (comment.itemType === "other") {
      return comment.customItem || t("common.empty.dash");
    }
    const quantity = comment.quantity || "1";
    return `${itemLabel(comment.itemType)} · ${t("orders.comments.columns.qty")} ${quantity}`;
  }

  // ESTIMATE and PAYMENT are limited to one per order; disable them on other rows once used.
  function purposeOptionsForRow(index: number) {
    const takenSingleUse = new Set(
      rows
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
    const { purpose } = commentAt(index);
    const takenItems = new Set(
      rows
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
    if (isDraftIndex(index)) {
      setDraftState(draft ? { ...draft, ...patch } : null);
      return;
    }
    onChange(comments.map((comment, commentIndex) => (commentIndex === index ? { ...comment, ...patch } : comment)));
  }

  function commitDraft(next: OrderCommentFormValues, nextField: CommentField | null) {
    const newIndex = comments.length;
    setDraftState(null);
    onChange([...comments, next]);
    if (isMobileViewportNow()) {
      setEditing(null);
      setMobileEditingIndex(nextField ? newIndex : null);
      return;
    }
    if (nextField) {
      setEditing({ index: newIndex, field: nextField });
      return;
    }
    setEditing(null);
  }

  function discardIncompleteDraft() {
    const current = draftRef.current;
    if (!current || isOrderCommentComplete(current)) return;
    setDraftState(null);
    setEditing(null);
    setMobileEditingIndex((index) => (index === draftIndex ? null : index));
  }

  function handleEditorClose(index: number, field: CommentField) {
    const advancing = advancingRef.current;
    advancingRef.current = false;

    const currentDraft = draftRef.current;
    const isDraftRow = Boolean(currentDraft) && index === comments.length;

    if (isDraftRow && currentDraft) {
      // An empty purpose row is never a saved comment, even if a leftover
      // advancing flag remains from a previously completed comment.
      if (field === "purpose" && !currentDraft.purpose.trim()) {
        discardIncompleteDraft();
        return;
      }

      if (
        field === "item" &&
        orderCommentPurposeRequiresItem(currentDraft.purpose) &&
        !currentDraft.itemType
      ) {
        discardIncompleteDraft();
        return;
      }
    }

    if (advancing) return;

    if (isDraftRow && currentDraft && isOrderCommentComplete(currentDraft)) {
      commitDraft(currentDraft, null);
      return;
    }

    setEditing(null);
  }

  function finishAndAddAnother(index: number) {
    if (index === comments.length && draftRef.current) {
      const current = draftRef.current;
      if (!isOrderCommentComplete(current)) return;
      setDraftState(createEmptyOrderComment());
      onChange([...comments, current]);
      const nextIndex = comments.length + 1;
      if (isMobileViewportNow()) {
        setEditing(null);
        setMobileEditingIndex(nextIndex);
        return;
      }
      setEditing({ index: nextIndex, field: "purpose" });
      return;
    }
    addComment();
  }

  function changePurpose(index: number, purpose: string) {
    advancingRef.current = true;
    const patch: Partial<OrderCommentFormValues> = {
      purpose,
      itemType: "",
      customItem: "",
      quantity: "1",
      description: "",
    };
    if (isDraftIndex(index)) {
      const next = { ...(draft ?? createEmptyOrderComment()), ...patch };
      if (isOrderCommentComplete(next)) {
        commitDraft(next, "note");
        return;
      }
      setDraftState(next);
      return;
    }
    updateComment(index, patch);
  }

  function changeItem(index: number, value: string) {
    advancingRef.current = true;
    const comment = commentAt(index);
    const patch: Partial<OrderCommentFormValues> = {
      itemType: value as OrderCommentItemType,
      customItem: value === "other" ? comment.customItem : "",
      quantity: comment.quantity || "1",
    };
    const nextField: CommentField = value === "other" ? "note" : "quantity";
    if (isDraftIndex(index)) {
      const next = { ...(draft ?? comment), ...patch };
      if (isOrderCommentComplete(next)) {
        commitDraft(next, nextField);
        return;
      }
      setDraftState(next);
      setEditing({ index, field: nextField });
      return;
    }
    updateComment(index, patch);
    setEditing({ index, field: nextField });
  }

  // After picking a purpose, jump to the next field; with no further field, start another comment.
  function focusNextAfterPurpose(index: number, purpose: string) {
    if (!purpose) {
      advancingRef.current = false;
      handleEditorClose(index, "purpose");
      return;
    }
    if (orderCommentPurposeRequiresItem(purpose)) {
      setEditing({ index, field: "item" });
      return;
    }
    setEditing({ index, field: "note" });
  }

  function addComment() {
    advancingRef.current = false;
    if (draft) {
      const field: CommentField = !draft.purpose
        ? "purpose"
        : orderCommentPurposeRequiresItem(draft.purpose) && !draft.itemType
          ? "item"
          : "note";
      if (isMobileViewportNow()) {
        setEditing(null);
        setMobileEditingIndex(draftIndex);
        return;
      }
      setEditing({ index: draftIndex, field });
      return;
    }

    setDraftState(createEmptyOrderComment());
    const newIndex = comments.length;
    if (isMobileViewportNow()) {
      setEditing(null);
      setMobileEditingIndex(newIndex);
      return;
    }
    setEditing({ index: newIndex, field: "purpose" });
  }

  function removeComment(index: number) {
    if (isDraftIndex(index)) {
      setDraftState(null);
      setEditing(null);
      setMobileEditingIndex((current) => {
        if (current === null) return null;
        if (current === index) return null;
        if (current > index) return current - 1;
        return current;
      });
      return;
    }
    onChange(comments.filter((_, commentIndex) => commentIndex !== index));
    setEditing(null);
    setMobileEditingIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <MessageSquare className="size-4" />
        </span>
        <h3 className="text-sm font-semibold leading-none text-foreground">{t("orders.comments.title")}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t("orders.empty.noComments")}
        </p>
      ) : (
        <>
        <div className="space-y-3 md:hidden" data-enter-navigation="ignore">
          {rows.map((comment, index) => {
            const requiresItem = orderCommentPurposeRequiresItem(comment.purpose);
            const isOtherItem = comment.itemType === "other";
            const noteField: "customItem" | "description" | null = requiresItem
              ? isOtherItem
                ? "customItem"
                : null
              : comment.purpose
                ? "description"
                : null;
            const isMobileEditing =
              mobileEditingIndex === index || !isMobileCommentComplete(comment);

            return (
              <div key={`mobile-comment-${index}`} className="space-y-3 rounded-xl border bg-background p-3 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {t("orders.comments.title")} {index + 1}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isMobileEditing ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 text-foreground hover:text-foreground"
                        aria-label={t("common.actions.edit")}
                        onClick={() => setMobileEditingIndex(index)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-destructive hover:text-destructive"
                      aria-label={t("orders.comments.removeAria", { index: index + 1 })}
                      onClick={() => removeComment(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {!isMobileEditing ? (
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-base font-semibold text-foreground">
                        {purposeLabel(comment.purpose)}
                      </p>
                      {requiresItem && comment.itemType && comment.itemType !== "other" ? (
                        <p className="shrink-0 text-sm font-semibold text-foreground">
                          x {comment.quantity || "1"}
                        </p>
                      ) : null}
                    </div>
                    <p className="break-words text-sm text-muted-foreground">
                      {mobileCommentDescription(comment)}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("orders.comments.columns.purpose")}
                      </p>
                      <SearchableSelect
                        id={`mobile-comment-purpose-${index}`}
                        value={comment.purpose}
                        onValueChange={(value) => changePurpose(index, value)}
                        onClose={() => handleEditorClose(index, "purpose")}
                        placeholder={t("orders.comments.placeholders.purpose")}
                        searchPlaceholder={t("orders.comments.placeholders.searchPurpose")}
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
                          onValueChange={(value) => changeItem(index, value)}
                          onClose={() => handleEditorClose(index, "item")}
                          placeholder={t("orders.comments.placeholders.item")}
                          searchPlaceholder={t("orders.comments.placeholders.searchItem")}
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
                          autoFocus={isEditing(index, "quantity")}
                          className="h-11 rounded-xl text-base"
                          value={comment.quantity || "1"}
                          onFocus={highlightQuantityField}
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

                  </>
                )}
              </div>
            );
          })}
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
            {rows.map((comment, index) => {
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
                        onClose={() => handleEditorClose(index, "purpose")}
                        value={comment.purpose}
                        onValueChange={(value) => {
                          changePurpose(index, value);
                          focusNextAfterPurpose(index, value);
                        }}
                        placeholder={t("orders.comments.placeholders.purpose")}
                        searchPlaceholder={t("orders.comments.placeholders.searchPurpose")}
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
                          onClose={() => handleEditorClose(index, "item")}
                          value={comment.itemType}
                          onValueChange={(value) => changeItem(index, value)}
                          placeholder={t("orders.comments.placeholders.item")}
                          searchPlaceholder={t("orders.comments.placeholders.searchItem")}
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
                          value={comment.quantity || "1"}
                          onFocus={highlightQuantityField}
                          onChange={(event) => updateComment(index, { quantity: event.target.value })}
                          onBlur={() => setEditing(null)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.shiftKey) return;
                            event.preventDefault();
                            finishAndAddAnother(index);
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
                          onBlur={() => setEditing(null)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || event.shiftKey) return;
                            event.preventDefault();
                            // Custom "other" items keep the quantity in this details field, so
                            // both note types finish the comment and start a new one.
                            finishAndAddAnother(index);
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

      <Button
        type="button"
        variant="outline"
        className="h-9 w-full justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary"
        onClick={addComment}
      >
        <Plus className="size-4" />
        {t("orders.comments.add")}
      </Button>
    </section>
  );
}
