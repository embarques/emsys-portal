"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { formatInventoryDateTime } from "@/lib/inventory/display";
import type { InventoryConfirmationParty, InventoryConfirmationState } from "@/lib/inventory/types/common";
import type { ConfirmationActionOption } from "@/lib/inventory/utils/confirmations";

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
      <dl className="space-y-2">
        {parties.map((party) => {
          const confirmation = party === "WAREHOUSE" ? state.confirmations.warehouse : state.confirmations.custodian;
          if (!confirmation && !pending) return null;
          return (
            <div key={party} className="flex items-start gap-2">
              {confirmation ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0">
                <dt className="font-medium">{partyLabel(party)}</dt>
                <dd className="text-muted-foreground">
                  {confirmation
                    ? t("inventory.confirmations.confirmedBy", {
                        name: confirmation.confirmedBy || t("common.empty.dash"),
                        date: formatInventoryDateTime(confirmation.confirmedAt),
                      })
                    : t("inventory.confirmations.awaiting")}
                </dd>
                {confirmation?.notes ? <dd className="text-muted-foreground">{confirmation.notes}</dd> : null}
              </div>
            </div>
          );
        })}
      </dl>
      {rejection ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">{t("inventory.confirmations.lastRejection")}</p>
            <p className="text-muted-foreground">
              {t("inventory.confirmations.rejectedBy", {
                party: rejection.party ? partyLabel(rejection.party) : t("common.empty.dash"),
                name: rejection.rejectedBy || t("common.empty.dash"),
                date: formatInventoryDateTime(rejection.rejectedAt),
              })}
            </p>
            <p>{rejection.reason}</p>
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
