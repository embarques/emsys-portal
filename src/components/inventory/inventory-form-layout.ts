import {
  compactActionDialogContentClassName,
  compactActionDialogFormClassName,
} from "@/components/forms/compact-action-dialog";
import { cn } from "@/lib/utils";

/** Shared viewport-bounded sizing for inventory add/edit dialogs, including nested forms. */
export const INVENTORY_FORM_DIALOG_CLASS_NAME = cn(
  compactActionDialogFormClassName,
  compactActionDialogContentClassName,
  "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-7xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl",
);