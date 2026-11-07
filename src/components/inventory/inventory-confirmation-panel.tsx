"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryDateTime } from "@/lib/inventory/display";
import type { InventoryConfirmationParty, InventoryConfirmationState } from "@/lib/inventory/types/common";
import type { ConfirmationActionOption } from "@/lib/inventory/utils/confirmations";
import { cn } from "@/lib/utils";

type InventoryConfirmationPanelProps = {
  state: InventoryConfirmationState;
  parties: readonly InventoryConfirmationParty[];
  /** Show "Awaiting" for missing parties; false once the record is posted, cancelled or rejected. */
  pending: boolean;
  actions?: ConfirmationActionOption[];
  disabled?: boolean;
  onAction?: (action: ConfirmationActionOption) => void;
};

/** Per-party confirmation status, the last rejection and the confirm / reject buttons. */
export function InventoryConfirmationPanel({
  state,
  parties,
  pending,
  actions = [],
  disabled = false,
  onAction,
}: InventoryConfirmationPanelProps) {
  const { t } = useTranslation();
  const partyLabel = (party: InventoryConfirmationParty) => t(`inventory.confirmations.parties.${party}`);
  const { rejection } = state;

  return (
    <div className="space-y-3 text-sm">
      <dl className="space-y-3">
        {parties.map((party) => {
          const confirmation = party === "WAREHOUSE" ? state.confirmations.warehouse : state.confirmations.custodian;
          if (!confirmation && !pending) return null;
          return (
            <div key={party} className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  confirmation
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {confirmation ? <CheckCircle2 className="size-4" /> : <Clock className="size-4" />}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <dt className="font-medium leading-snug">{partyLabel(party)}</dt>
                {confirmation ? (
                  <>
                    <dd className="leading-snug text-foreground/90 [overflow-wrap:anywhere]">
                      {confirmation.confirmedBy || t("common.empty.dash")}
                    </dd>
                    <dd className="text-xs text-muted-foreground">{formatInventoryDateTime(confirmation.confirmedAt)}</dd>
                    {confirmation.notes ? (
                      <dd className="mt-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs">
                        <span className="block font-medium text-muted-foreground">{t("inventory.form.fields.notes")}</span>
                        <span className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{confirmation.notes}</span>
                      </dd>
                    ) : null}
                  </>
                ) : (
                  <dd className="text-muted-foreground">{t("inventory.confirmations.awaiting")}</dd>
                )}
              </div>
            </div>
          );
        })}
      </dl>
      {rejection ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{t("inventory.confirmations.lastRejection")}</p>
            <p className="text-muted-foreground [overflow-wrap:anywhere]">
              {t("inventory.confirmations.rejectedBy", {
                party: rejection.party ? partyLabel(rejection.party) : t("common.empty.dash"),
                name: rejection.rejectedBy || t("common.empty.dash"),
                date: formatInventoryDateTime(rejection.rejectedAt),
              })}
            </p>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{rejection.reason}</p>
          </div>
        </div>
      ) : null}
      {actions.length && onAction ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => action.kind === "confirm" ? (
            <Button key={`confirm-${action.party}`} size="sm" disabled={disabled} onClick={() => onAction(action)}>
              <CheckCircle2 className="h-4 w-4" />
              {t("inventory.confirmations.confirmAs", { party: partyLabel(action.party) })}
            </Button>
          ) : (
            <Button
              key="reject"
              size="sm"
              variant="outline"
              disabled={disabled}
              className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onAction(action)}
            >
              <XCircle className="h-4 w-4" />
              {t("inventory.confirmations.reject")}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
