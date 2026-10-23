"use client";

import { InvoiceCreateWizard } from "@/components/invoices/invoice-form-workspace";
import { CustomerContactSummary } from "@/components/orders/customer-contact-summary";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
        <DialogContent className="z-[60]">
          <DialogHeader>
            <DialogTitle>{t("orders.dialogs.chooseInvoiceReceiverTitle")}</DialogTitle>
            <DialogDescription>
              {t("orders.dialogs.chooseInvoiceReceiverDescription", { count: receivers.length })}
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
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
          <DialogFooter>
            <Button variant="outline" onClick={state.cancelReceiverChoice}>
              {t("common.actions.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={state.dialogPrefill !== null}
        onOpenChange={(open) => {
          if (!open) state.closeDialog();
        }}
      >
        <DialogContent className={invoiceWizardDialogClassName}>
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
