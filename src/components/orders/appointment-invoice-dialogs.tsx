"use client";

import { InvoiceCreateWizard } from "@/components/invoices/invoice-form-workspace";
import { Users } from "lucide-react";

import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import type { useCreateAppointmentInvoice } from "@/lib/orders/hooks/use-create-appointment-invoice";
import { getUniqueOrderReceivers } from "@/lib/orders/types";

const invoiceWizardDialogClassName =
  "left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[100dvw] max-w-[100dvw] translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden overflow-x-hidden rounded-none border-0 p-0 max-sm:[&>button:last-child]:hidden sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-6xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border";

type AppointmentInvoiceDialogsProps = {
  state: ReturnType<typeof useCreateAppointmentInvoice>;
};

export function AppointmentInvoiceDialogs({ state }: AppointmentInvoiceDialogsProps) {
  const { t } = useTranslation();
  const receivers = getUniqueOrderReceivers(state.receiverChoiceOrder);

  return (
    <>
      <Dialog
        open={state.receiverChoiceOrder !== null}
        onOpenChange={(open) => {
          if (!open) state.cancelReceiverChoice();
        }}
      >
        <CompactActionDialogContent>
          <CompactActionDialogHeader
            icon={Users}
            title={t("orders.dialogs.chooseInvoiceReceiverTitle")}
            description={t("orders.dialogs.chooseInvoiceReceiverDescription", { count: receivers.length })}
          />
          <CompactActionDialogBody className="max-h-[60vh] space-y-2">
          <ul className="space-y-2">
            {receivers.map((receiver) => (
              <li key={receiver.id}>
                <button
                  type="button"
                  className="w-full rounded-lg text-left transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => state.chooseReceiver(receiver.id)}
                >
                  <CustomerContactSummary customer={receiver} addressIndex={0} />
                </button>
              </li>
            ))}
          </ul>
          </CompactActionDialogBody>
          <CompactActionDialogFooter>
            <Button variant="outline" onClick={state.cancelReceiverChoice}>
              {t("common.actions.cancel")}
            </Button>
          </CompactActionDialogFooter>
        </CompactActionDialogContent>
      </Dialog>

      <Dialog
        open={state.dialogPrefill !== null}
        onOpenChange={(open) => {
          if (!open) state.closeDialog();
        }}
      >
        <DialogContent
          className={invoiceWizardDialogClassName}
          onOpenAutoFocus={(event) => {
            // Wizard step autofocus opens comboboxes unless dialog focus is suppressed.
            event.preventDefault();
          }}
        >
          <DialogHeader className="hidden shrink-0 border-b border-border px-5 py-4 sm:block sm:px-6">
            <DialogTitle>{t("invoices.workspace.addInvoice")}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {state.dialogPrefill ? (
              <InvoiceCreateWizard
                inDialog
                appointmentPrefill={state.dialogPrefill}
                onCancel={state.closeDialog}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
