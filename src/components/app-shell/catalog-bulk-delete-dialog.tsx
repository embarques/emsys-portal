"use client";

import { ConfirmDeleteButton } from "@/components/app-shell/confirm-delete-button";
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
import type { CatalogBulkDeleteState } from "@/lib/table/hooks/use-catalog-bulk-delete";

type CatalogBulkDeleteDialogProps<T> = {
  state: CatalogBulkDeleteState<T>;
  entity: string;
  entities: string;
  getName: (row: T) => string;
};

export function CatalogBulkDeleteDialog<T>({ state, entity, entities, getName }: CatalogBulkDeleteDialogProps<T>) {
  const { t } = useTranslation();
  const targets = state.targets ?? [];
  const many = targets.length > 1;
  const cannotBeUndone = t("common.dialogs.cannotBeUndone");

  return (
    <Dialog open={targets.length > 0} onOpenChange={(open) => !open && state.cancel()}>
      <DialogContent className="z-[60]">
        <DialogHeader>
          <DialogTitle>
            {many
              ? t("common.dialogs.deleteManyTitle", { entities })
              : t("common.dialogs.deleteOneTitle", { entity })}
          </DialogTitle>
          <DialogDescription>
            {many
              ? t("common.dialogs.deleteManyDescription", { count: targets.length, entities, cannotBeUndone })
              : t("common.dialogs.deleteOneDescription", {
                  name: targets[0] ? getName(targets[0]) : entity,
                  cannotBeUndone,
                })}
          </DialogDescription>
        </DialogHeader>
        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        <DialogFooter>
          <Button variant="outline" onClick={state.cancel} disabled={state.isPending}>
            {t("common.actions.cancel")}
          </Button>
          <ConfirmDeleteButton isPending={state.isPending} onClick={() => void state.confirm()} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
