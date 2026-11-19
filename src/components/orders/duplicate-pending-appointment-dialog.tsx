"use client";

import { useRef } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatOrderDateWithWeekday } from "@/lib/orders/display";
import type { ExistingPendingAppointment } from "@/lib/orders/duplicate-pending-appointment";
import { useTranslation } from "@/lib/i18n";

type DuplicatePendingAppointmentDialogProps = {
  open: boolean;
  existing: ExistingPendingAppointment[];
  onConfirm: () => void;
  onCancel: () => void;
};

function formatPurposeLabel(
  purpose: string,
  t: (key: string) => string,
): string {
  const trimmed = purpose.trim();
  if (!trimmed) return t("common.empty.dash");

  const tokens = trimmed.split(/[\s,|/]+/).map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) return t("common.empty.dash");

  return tokens
    .map((token) => {
      const key = `orders.comments.purposes.${token.toUpperCase()}`;
      const localized = t(key);
      return localized === key ? token : localized;
    })
    .join(" · ");
}

export function DuplicatePendingAppointmentDialog({
  open,
  existing,
  onConfirm,
  onCancel,
}: DuplicatePendingAppointmentDialogProps) {
  const { t, locale } = useTranslation();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          cancelButtonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("orders.duplicatePending.title")}</DialogTitle>
          <DialogDescription>{t("orders.duplicatePending.description")}</DialogDescription>
        </DialogHeader>

        {existing.length > 0 ? (
          <ul className="max-h-64 space-y-3 overflow-y-auto text-sm">
            {existing.map((appointment) => (
              <li
                key={appointment.id}
                className="rounded-md border border-border bg-muted/30 px-3 py-2"
              >
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <dt className="text-muted-foreground">{t("orders.duplicatePending.fields.id")}</dt>
                  <dd>{appointment.id}</dd>
                  <dt className="text-muted-foreground">{t("orders.duplicatePending.fields.date")}</dt>
                  <dd>
                    {appointment.date
                      ? formatOrderDateWithWeekday(appointment.date, locale)
                      : t("common.empty.dash")}
                  </dd>
                  <dt className="text-muted-foreground">{t("orders.duplicatePending.fields.purpose")}</dt>
                  <dd>{formatPurposeLabel(appointment.purpose, t)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("orders.duplicatePending.unknownExisting")}</p>
        )}

        <DialogFooter>
          <Button ref={cancelButtonRef} type="button" variant="outline" onClick={onCancel}>
            {t("orders.duplicatePending.cancel")}
          </Button>
          <Button type="button" onClick={onConfirm}>
            {t("orders.duplicatePending.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
