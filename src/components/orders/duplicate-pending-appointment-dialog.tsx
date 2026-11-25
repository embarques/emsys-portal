"use client";

import { useRef } from "react";
import { AlertTriangle } from "lucide-react";

import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatOrderDateWithWeekday, formatOrderPurposeLabel } from "@/lib/orders/display";
import type { ExistingPendingAppointment } from "@/lib/orders/duplicate-pending-appointment";
import { useTranslation } from "@/lib/i18n";

type DuplicatePendingAppointmentDialogProps = {
  open: boolean;
  existing: ExistingPendingAppointment[];
  onConfirm: () => void;
  onCancel: () => void;
};

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
        <CompactActionDialogHeader
          icon={AlertTriangle}
          title={t("orders.duplicatePending.title")}
          description={t("orders.duplicatePending.description")}
        />

        <CompactActionDialogBody>
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
                    <dd className="text-foreground">{formatOrderPurposeLabel(appointment.purpose, t)}</dd>
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
        </CompactActionDialogBody>

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
