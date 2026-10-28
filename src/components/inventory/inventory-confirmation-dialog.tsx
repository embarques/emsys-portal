"use client";

import { useRef, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import type { ConfirmationActionOption } from "@/lib/inventory/utils/confirmations";

const MAX_TEXT = 1000;

const schema = z.object({ kind: z.enum(["confirm", "reject"]), text: z.string().max(MAX_TEXT) }).superRefine((values, context) => {
  if (values.kind === "reject" && !values.text.trim()) {
    context.addIssue({ code: "custom", path: ["text"], message: "inventory.confirmations.reasonRequired" });
  }
});

type ConfirmationFormValues = z.infer<typeof schema>;

type InventoryConfirmationDialogProps = {
  action: ConfirmationActionOption | null;
  /** `inventory.confirmations.subjects.*` key suffix. */
  subject: "receipt" | "dispatch" | "reconciliation";
  description: string;
  /** Extra line, e.g. when stock moves. */
  note?: string;
  isPending: boolean;
  error?: string | null;
  onSubmit: (action: ConfirmationActionOption, text: string) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
};

/** Confirm (optional notes) or reject (required reason) one party of a pending inventory record. */
export function InventoryConfirmationDialog(props: InventoryConfirmationDialogProps) {
  return (
    <Dialog open={props.action !== null} onOpenChange={(open) => { if (!open && !props.isPending) props.onOpenChange(false); }}>
      <DialogContent centerInWorkspace>
        {props.action ? <ConfirmationForm key={`${props.action.kind}-${props.action.party}`} {...props} action={props.action} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmationForm({
  action,
  subject,
  description,
  note,
  isPending,
  error,
  onSubmit,
  onOpenChange,
}: InventoryConfirmationDialogProps & { action: ConfirmationActionOption }) {
  const { t } = useTranslation();
  const form = useForm<ConfirmationFormValues>({ resolver: zodResolver(schema), defaultValues: { kind: action.kind, text: "" } });
  const submitting = useRef(false);
  const isReject = action.kind === "reject";
  const party = t(`inventory.confirmations.parties.${action.party}`);
  const textError = form.formState.errors.text?.message;
  const busy = isPending || form.formState.isSubmitting;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Validation is async, so a second click can arrive before the mutation is pending.
    if (submitting.current) return;
    submitting.current = true;
    void form.handleSubmit(async (values) => {
      try {
        await onSubmit(action, values.text.trim());
      } finally {
        submitting.current = false;
      }
    }, () => { submitting.current = false; })(event);
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
      <DialogHeader>
        <DialogTitle>
          {isReject
            ? t("inventory.confirmations.rejectTitle", { subject: t(`inventory.confirmations.subjects.${subject}`) })
            : t("inventory.confirmations.confirmTitle", { party })}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      <div className="space-y-2">
        <Label htmlFor="inventory-confirmation-text">
          {t(isReject ? "inventory.confirmations.reason" : "inventory.confirmations.notes")}
        </Label>
        <Input
          id="inventory-confirmation-text"
          maxLength={MAX_TEXT}
          autoFocus
          aria-invalid={Boolean(textError)}
          disabled={busy}
          {...form.register("text")}
        />
        {textError ? <p role="alert" className="text-xs text-destructive">{t(textError)}</p> : null}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
          {t("common.actions.close")}
        </Button>
        <Button
          type="submit"
          disabled={busy}
          variant={isReject ? "outline" : "default"}
          className={isReject ? "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive" : undefined}
        >
          {busy
            ? t("inventory.confirmations.saving")
            : t(isReject ? "inventory.confirmations.reject" : "inventory.confirmations.confirm")}
        </Button>
      </DialogFooter>
    </form>
  );
}
