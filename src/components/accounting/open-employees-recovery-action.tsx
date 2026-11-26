"use client";

import { ExternalLink } from "lucide-react";

import { isResponsibilityRequiredErrorMessage } from "@/lib/accounting/daily-income/journal-api-error";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { canUseEmployeeUserLink } from "@/lib/employees/user-link";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const canOpenEmployeesDirectory = canUseEmployeeUserLink;

function openEmployeesDirectory() {
  window.open("/employees", "_blank", "noopener,noreferrer");
}

/** Button + hint that opens Employees so the user can link their account. */
export function OpenEmployeesRecoveryAction() {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={openEmployeesDirectory}
      >
        <ExternalLink className="size-4" />
        {t("accounting.dailyIncome.errors.openEmployees")}
      </Button>
      <p className="text-xs leading-snug text-destructive/80">
        {t("accounting.dailyIncome.errors.openEmployeesHint")}
      </p>
    </div>
  );
}

/** Recovery control when a form error is the responsibility / employee-link failure. */
export function useResponsibilityRequiredRecoveryAction(message: string | null | undefined) {
  const { hasPermission } = useAuth();
  if (!isResponsibilityRequiredErrorMessage(message) || !canOpenEmployeesDirectory(hasPermission)) {
    return null;
  }
  return <OpenEmployeesRecoveryAction />;
}
