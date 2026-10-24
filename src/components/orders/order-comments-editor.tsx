"use client";

import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { Banknote, Check, ClipboardList, MessageSquare, PackageOpen, Pencil, Plus, Trash2, Truck, type LucideIcon } from "lucide-react";

import { wizardInputFieldProps } from "@/components/invoices/invoice-wizard-styles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  ORDER_COMMENT_ITEM_TYPES,
  ORDER_COMMENT_PURPOSES,
  createEmptyOrderComment,
  updateOrderComment,
  isOrderCommentComplete,
  orderCommentPurposeRequiresItem,
  type OrderCommentFormValues,
  type OrderCommentItemType,
} from "@/lib/orders/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const purposeIcons: Record<string, LucideIcon> = {
  PICKUP: PackageOpen,
  TAKE: Truck,
  PAYMENT: Banknote,
  ESTIMATE: ClipboardList,
  OTHER: MessageSquare,
};

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
  quickEntry?: boolean;
  comments: OrderCommentFormValues[];
  onChange: (comments: OrderCommentFormValues[]) => void;
  /** Quick entry only: extra classes for the scrollable list of added comments. */
  listClassName?: string;
};

export function OrderCommentsEditor({ comments, onChange, quickEntry = false, listClassName }: OrderCommentsEditorProps) {
  const { t, locale } = useTranslation();
  const [editing, setEditing] = useState<EditingCell>(null);
  const [mobileEditingIndex, setMobileEditingIndex] = useState<number | null>(null);
  // Quick entry: the comment shown in the editor card; null means the new draft.
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<OrderCommentFormValues | null>(() =>
    comments.length === 0 || quickEntry ? { ...createEmptyOrderComment(), language: locale } : null,
  );
  const advancingRef = useRef(false);
  const draftRef = useRef<OrderCommentFormValues | null>(draft);
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  const resolvedActiveIndex = activeIndex !== null && activeIndex < comments.length ? activeIndex : null;

  useEffect(() => {
    const needsDraft = comments.length === 0 || (quickEntry && resolvedActiveIndex === null);
    if (needsDraft && !draftRef.current) {
      const next = { ...createEmptyOrderComment(), language: locale };
      draftRef.current = next;
      setDraft(next);
    }
  }, [comments, draft, locale, quickEntry, resolvedActiveIndex]);

  useEffect(() => {
    if (!quickEntry || editing?.field !== "note") return;

    const index = editing.index;
    const timer = window.setTimeout(() => {
      document.getElementById(`quick-comment-note-${index}`)?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [editing, quickEntry]);

  useEffect(() => {
    if (editing?.field !== "quantity") return;

    const index = editing.index;
    const timer = window.setTimeout(() => {
      const input =
        (document.getElementById(`quick-comment-quantity-${index}`) as HTMLInputElement | null) ??
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
      return comment.description.trim();
    }
    if (comment.itemType === "other") {
      return comment.customItem || t("common.empty.dash");
    }
    const quantity = comment.quantity || "1";
    return `${itemLabel(comment.itemType)} · ${t("orders.comments.columns.qty")} ${quantity}`;
  }

  // ESTIMATE and PAYMENT are limited to one per order; disable them on other rows once used.
  // TAKE and PICKUP are disabled once every item type is already used for them on other rows.
  function purposeOptionsForRow(index: number) {
    const otherRows = rows.filter((_, commentIndex) => commentIndex !== index);
    const takenSingleUse = new Set(
      otherRows
        .filter((comment) => SINGLE_USE_PURPOSES.has(comment.purpose))
        .map((comment) => comment.purpose),
    );

    const isItemPurposeExhausted = (purpose: string) => {
      if (!orderCommentPurposeRequiresItem(purpose)) return false;
      const usedItems = new Set(
        otherRows
          .filter((comment) => comment.purpose === purpose && comment.itemType)
          .map((comment) => comment.itemType),
      );
      return ORDER_COMMENT_ITEM_TYPES.every((item) => usedItems.has(item.value));
    };

    return localizedPurposes.map((purpose) => ({
      value: purpose.value,
      label: purpose.label,
      disabled: takenSingleUse.has(purpose.value) || isItemPurposeExhausted(purpose.value),
    }));
  }

  // Each item type is its own line and may only be used once per Take/Pickup
  // (one Take+other, one Take+box, one Pickup+barrel, …). Different items may
  // be combined on the same appointment.
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
      const next = draft ? updateOrderComment(draft, patch, locale) : null;
      if (!next) {
        setDraftState(null);
        return;
      }
      // Promote a complete draft into form state immediately so Save sees Take/Pickup
      // "Other" text (and other draft rows) instead of reporting "no changes".
      if (isOrderCommentComplete(next)) {
        const committedIndex = commentsRef.current.length;
        const committed = [...commentsRef.current, next];
        commentsRef.current = committed;
        setDraftState(null);
        onChange(committed);
        setActiveIndex(committedIndex);
        if (editing?.index === index) {
          setEditing({ index: committedIndex, field: editing.field });
        }
        if (mobileEditingIndex === index) {
          setMobileEditingIndex(committedIndex);
        }
        return;
      }
      setDraftState(next);
      return;
    }
    const updated = commentsRef.current.map((comment, commentIndex) =>
      commentIndex === index ? updateOrderComment(comment, patch, locale) : comment,
    );
    commentsRef.current = updated;
    onChange(updated);
  }

  function commitDraft(next: OrderCommentFormValues, nextField: CommentField | null) {
    const newIndex = commentsRef.current.length;
    const committed = [...commentsRef.current, next];
    commentsRef.current = committed;
    setDraftState(null);
    onChange(committed);
    setActiveIndex(newIndex);
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
    if (commentsRef.current.length > 0) setDraftState(null);
    setEditing(null);
    setMobileEditingIndex((index) => (index === draftIndex ? null : index));
  }

  function handleEditorClose(index: number, field: CommentField) {
    const advancing = advancingRef.current;
    advancingRef.current = false;

    const currentDraft = draftRef.current;
    const isDraftRow = Boolean(currentDraft) && index === commentsRef.current.length;

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
    if (index === commentsRef.current.length && draftRef.current) {
      const current = draftRef.current;
      if (!isOrderCommentComplete(current)) return;
      setDraftState({ ...createEmptyOrderComment(), language: locale });
      const committed = [...commentsRef.current, current];
      commentsRef.current = committed;
      onChange(committed);
      setActiveIndex(null);
      const nextIndex = committed.length;
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
      const next = updateOrderComment(draft ?? createEmptyOrderComment(), patch, locale);
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
    setActiveIndex(null);
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

    setDraftState({ ...createEmptyOrderComment(), language: locale });
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
    setActiveIndex((current) => {
      if (current === null || current === index) return null;
      return current > index ? current - 1 : current;
    });
    setEditing(null);
    setMobileEditingIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  }

  if (quickEntry) {
    const currentIndex = resolvedActiveIndex ?? draftIndex;
    const current = rows[currentIndex] as OrderCommentFormValues | undefined;
    const isCurrentDraft = isDraftIndex(currentIndex);
    const requiresItem = current ? orderCommentPurposeRequiresItem(current.purpose) : false;
    const noteField = requiresItem && current?.itemType === "other" ? "customItem" : "description";

    function quickCommentSummary(comment: OrderCommentFormValues): string {
      const parts: string[] = [];
      if (orderCommentPurposeRequiresItem(comment.purpose)) {
        if (comment.itemType === "other") parts.push(comment.customItem.trim());
        else if (comment.itemType) parts.push(`${comment.quantity || "1"} × ${itemLabel(comment.itemType)}`);
      }
      if (comment.description.trim()) parts.push(comment.description.trim());
      return parts.filter(Boolean).join(" · ");
    }

    return (
      <section className="flex min-h-0 flex-1 flex-col gap-3" aria-label={t("orders.comments.title")} data-enter-navigation="ignore">
        {current ? (
          <div className="@container shrink-0 space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-3 @sm:p-4">
            <div className="flex min-h-8 items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {isCurrentDraft
                  ? t("orders.form.design.addPurpose")
                  : t("orders.form.design.editPurpose", { index: currentIndex + 1 })}
              </h3>
              {!isCurrentDraft ? (
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={addComment}>
                    <Plus className="size-4" />{t("orders.form.design.addAnotherPurpose")}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => removeComment(currentIndex)}
                    aria-label={t("orders.comments.removeAria", { index: currentIndex + 1 })}><Trash2 className="size-4" /></Button>
                </div>
              ) : null}
            </div>
            <div role="group" aria-label={t("orders.comments.columns.purpose")} className="grid grid-cols-3 gap-2 @md:grid-cols-5">
              {purposeOptionsForRow(currentIndex).map((purpose) => {
                const Icon = purposeIcons[purpose.value] ?? MessageSquare;
                const selected = current.purpose === purpose.value;
                return (
                  <Button key={purpose.value} type="button" variant="outline"
                    className={cn("relative h-auto min-h-16 flex-col gap-1.5 whitespace-normal rounded-lg px-2 py-2.5 text-center text-xs font-medium @sm:text-sm", selected && "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary")}
                    disabled={purpose.disabled} aria-pressed={selected}
                    onClick={() => { if (!selected) changePurpose(currentIndex, purpose.value); }}>
                    {selected ? <Check className="absolute right-1.5 top-1.5 size-3.5" aria-hidden /> : null}
                    <Icon className="size-4" aria-hidden />
                    {purpose.label}
                  </Button>
                );
              })}
            </div>
            {requiresItem ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t("orders.comments.columns.item")}</p>
                <div role="group" aria-label={t("orders.comments.columns.item")} className="grid grid-cols-2 gap-2 @sm:grid-cols-4">
                  {itemOptionsForRow(currentIndex).map((item) => (
                    <Button key={item.value} type="button" variant={current.itemType === item.value ? "default" : "outline"}
                      className="h-9 rounded-lg" disabled={item.disabled} aria-pressed={current.itemType === item.value}
                      onClick={() => changeItem(currentIndex, item.value)}>{item.label}</Button>
                  ))}
                </div>
              </div>
        ) : null}
          {requiresItem && current.itemType && current.itemType !== "other" ? (
            <div className="min-w-0 space-y-1.5">
              <label htmlFor={`quick-comment-quantity-${currentIndex}`} className="text-sm font-medium">{t("orders.comments.columns.quantity")}</label>
              <Input {...wizardInputFieldProps(current.quantity)} id={`quick-comment-quantity-${currentIndex}`} type="number" min="1" value={current.quantity}
                onFocus={highlightQuantityField}
                onChange={(event) => updateComment(currentIndex, { quantity: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (isOrderCommentComplete(current)) finishAndAddAnother(currentIndex);
                  }
                }} />
            </div>
          ) : current.purpose && (!requiresItem || current.itemType === "other") ? (
            <div className="min-w-0 space-y-1.5">
              <label htmlFor={`quick-comment-note-${currentIndex}`} className="text-sm font-medium">{t("orders.comments.columns.comment")}</label>
              <Input {...wizardInputFieldProps(current[noteField])} id={`quick-comment-note-${currentIndex}`} value={current[noteField]}
                placeholder={t(noteField === "customItem" ? "orders.comments.placeholders.customItem" : "orders.comments.placeholders.note")}
                onChange={(event) => updateComment(currentIndex, { [noteField]: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (isOrderCommentComplete(current)) finishAndAddAnother(currentIndex);
                  }
                }} />
            </div>
          ) : null}
      </div>
        ) : null}
        <div className="flex shrink-0 items-center justify-between gap-2 pt-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("orders.form.design.addedPurposes", { count: comments.length })}
          </p>
        </div>
        <div className={cn("-m-1 min-h-0 space-y-2 overflow-y-auto p-1", listClassName)}>
          {comments.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              {t("orders.form.design.noPurposes")}
            </p>
          ) : null}
          {comments.map((comment, index) => {
            const Icon = purposeIcons[comment.purpose] ?? MessageSquare;
            const isActive = resolvedActiveIndex === index;
            const summary = quickCommentSummary(comment);
            return (
              <div key={`quick-comment-row-${index}`}
                className={cn("flex items-center gap-1 rounded-lg border bg-card pr-1 shadow-xs", isActive && "border-primary bg-primary/5")}>
                <button type="button" aria-current={isActive || undefined}
                  aria-label={t("orders.form.design.editPurposeAria", { index: index + 1, purpose: purposeLabel(comment.purpose) })}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-muted/40"
                  onClick={() => setActiveIndex(index)}>
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{purposeLabel(comment.purpose)}</span>
                    {summary ? <span className="block truncate text-xs text-muted-foreground">{summary}</span> : null}
                  </span>
                </button>
                <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeComment(index)}
                  aria-label={t("orders.comments.removeAria", { index: index + 1 })}><Trash2 className="size-4" /></Button>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("orders.form.workflow.visitTitle")} <span className="text-destructive">*</span>
          </h3>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
          onClick={addComment}
        >
          <Plus className="size-4" />
          {t("orders.comments.add")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{t("orders.form.workflow.visitHint")}</p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          {t("orders.form.workflow.commentsEmpty")}
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
                    {mobileCommentDescription(comment) ? (
                      <p className="break-words text-sm text-muted-foreground">
                        {mobileCommentDescription(comment)}
                      </p>
                    ) : null}
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
                    {isEditing(index, "purpose") || (isDraftIndex(index) && !comment.purpose) ? (
                      <SearchableSelect
                        id={`comment-purpose-${index}`}
                        autoFocus={isEditing(index, "purpose")}
                        defaultOpen={isEditing(index, "purpose")}
                        advanceFocusOnSelect={false}
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
                          advanceFocusOnSelect={false}
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
                          onBlur={() => handleEditorClose(index, "quantity")}
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
                          onBlur={() => handleEditorClose(index, "note")}
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
                          className={cn(cellButtonClassName, "group")}
                          onDoubleClick={() => setEditing({ index, field: "note" })}
                        >
                          {comment[noteField] ? (
                            comment[noteField]
                          ) : noteField === "customItem" ? (
                            <span className="text-muted-foreground">
                              {t("orders.comments.placeholders.customItem")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground opacity-0 group-focus-visible:opacity-100">
                              {t("orders.comments.placeholders.addComment")}
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
