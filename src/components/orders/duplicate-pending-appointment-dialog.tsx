"use client";

import { useRef } from "react";

import {
  CompactActionDialogContent,
  CompactActionDialogFooter,
} from "@/components/forms/compact-action-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
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
      <CompactActionDialogContent
        onOpenAutoFocus={() => {
          cancelButtonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("orders.duplicatePending.title")}</DialogTitle>
          <DialogDescription className="text-foreground/80">
            {t("orders.duplicatePending.description")}
          </DialogDescription>
        </DialogHeader>

        {existing.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-input">
            <ul className="max-h-64 divide-y divide-input/80 overflow-y-auto text-sm">
              {existing.map((appointment) => (
                <li key={appointment.id} className="bg-muted/50 px-3 py-2.5">
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    <dt className="text-foreground/70">{t("orders.duplicatePending.fields.id")}</dt>
                    <dd className="font-medium text-foreground">{appointment.id}</dd>
                    <dt className="text-foreground/70">{t("orders.duplicatePending.fields.date")}</dt>
                    <dd className="text-foreground">
                      {appointment.date
                        ? formatOrderDateWithWeekday(appointment.date, locale)
                        : t("common.empty.dash")}
                    </dd>
                    <dt className="text-foreground/70">{t("orders.duplicatePending.fields.purpose")}</dt>
                    <dd className="text-foreground">{formatPurposeLabel(appointment.purpose, t)}</dd>
                  </dl>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-input px-3 py-4 text-sm text-foreground/75">
            {t("orders.duplicatePending.unknownExisting")}
          </p>
        )}

        <CompactActionDialogFooter className="sm:grid sm:grid-cols-2">
          <Button
            ref={cancelButtonRef}
            type="button"
            variant="outline"
            className="w-full border-input"
            onClick={onCancel}
          >
            {t("orders.duplicatePending.cancel")}
          </Button>
          <Button type="button" className="w-full" onClick={onConfirm}>
            {t("orders.duplicatePending.confirm")}
          </Button>
        </CompactActionDialogFooter>
      </CompactActionDialogContent>
    </Dialog>
  );
}
