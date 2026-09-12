"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, StickyNote, X } from "lucide-react";

import { useCalculator } from "@/components/app-shell/calculator-provider";
import { useMemoPad } from "@/components/app-shell/memo-pad-provider";
import {
  floatingUtilityPanelBasePositionClassName,
  floatingUtilityPanelBodyClassName,
  floatingUtilityPanelClassName,
  floatingUtilityPanelStackedPositionClassName,
} from "@/components/app-shell/floating-utility-panel-styles";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import {
  useFloatingMemoPad,
  useMemoPadHasNotes,
} from "@/lib/memo-pads/hooks/use-floating-memo-pad";
import { cn } from "@/lib/utils";

export function FloatingMemoPad() {
  const { open, close, openedAt } = useMemoPad();
  const { open: calculatorOpen, openedAt: calculatorOpenedAt } = useCalculator();
  const { t } = useTranslation();
  const {
    content,
    updateContent,
    clearContent,
    isLoading,
    isError,
    isSaving,
  } = useFloatingMemoPad();
  const [savedHint, setSavedHint] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const wasSavingRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (wasSavingRef.current && !isSaving) {
      setSavedHint(true);
      const timer = window.setTimeout(() => setSavedHint(false), 1500);
      wasSavingRef.current = isSaving;
      return () => window.clearTimeout(timer);
    }
    wasSavingRef.current = isSaving;
  }, [isSaving]);

  if (!open) return null;

  function handleChange(value: string) {
    updateContent(value);
  }

  function handleClear() {
    if (content.trim()) {
      setConfirmClearOpen(true);
      return;
    }
    clearContent();
  }

  function handleConfirmClear() {
    clearContent();
    setConfirmClearOpen(false);
  }

  const lineCount = content.trim() ? content.split("\n").length : 0;
  const charCount = content.length;

  const stacked =
    calculatorOpen &&
    calculatorOpenedAt !== null &&
    openedAt !== null &&
    calculatorOpenedAt < openedAt;

  return (
    <div
      className={cn(
        "pointer-events-none fixed right-4 z-[100] sm:right-6",
        stacked
          ? floatingUtilityPanelStackedPositionClassName
          : floatingUtilityPanelBasePositionClassName
      )}
      aria-live="polite"
    >
      <div
        className={floatingUtilityPanelClassName}
        role="dialog"
        aria-label={t("shell.memoPad.title")}
      >
        <div className="flex shrink-0 items-center justify-between border-b bg-muted/40 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <StickyNote className="h-4 w-4 shrink-0" />
            {t("shell.memoPad.title")}
          </div>
          <div className="flex items-center gap-1">
            {isSaving ? (
              <span className="text-xs text-muted-foreground">{t("shell.memoPad.saving")}</span>
            ) : savedHint ? (
              <span className="text-xs text-muted-foreground">{t("shell.memoPad.saved")}</span>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("shell.memoPad.clear")}
              onClick={handleClear}
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={t("shell.memoPad.close")}
              onClick={close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className={floatingUtilityPanelBodyClassName}>
          <textarea
            value={content}
            onChange={(event) => handleChange(event.target.value)}
            placeholder={
              isLoading ? t("shell.memoPad.loadingNotes") : t("shell.memoPad.notesPlaceholder")
            }
            disabled={isLoading}
            className="min-h-0 flex-1 w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60"
            spellCheck
          />
          <div className="mt-2 flex shrink-0 items-center justify-between text-xs text-muted-foreground">
            <span>
              {lineCount} {lineCount === 1 ? t("shell.memoPad.line") : t("shell.memoPad.lines")} · {charCount}{" "}
              {t("shell.memoPad.chars")}
            </span>
            <span>{isError ? t("shell.memoPad.offline") : t("shell.memoPad.savedToAccount")}</span>
          </div>
        </div>
      </div>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="pointer-events-auto z-[110]">
          <DialogHeader>
            <DialogTitle>{t("shell.memoPad.clearTitle")}</DialogTitle>
            <DialogDescription>{t("shell.memoPad.clearConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleConfirmClear}>
              <Eraser className="h-4 w-4" />
              {t("shell.memoPad.clearAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function MemoPadToggleButton() {
  const { open, toggle } = useMemoPad();
  const hasNotes = useMemoPadHasNotes();
  const { t } = useTranslation();
  const label = open ? t("shell.memoPad.hide") : t("shell.memoPad.open");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={open ? "secondary" : "outline"}
          size="icon"
          aria-label={label}
          aria-pressed={open}
          className="relative shrink-0"
          onClick={toggle}
        >
          <StickyNote className="h-4 w-4" />
          {hasNotes && !open ? (
            <span
              className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
