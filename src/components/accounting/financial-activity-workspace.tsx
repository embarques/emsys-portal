"use client";
import { PageHeader } from "@/components/app-shell/page-header";
import { JournalTransactionsTable } from "./journal-transactions-table";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
export function FinancialActivityWorkspace() {
 return <JournalQueueWorkspace />;
}
export function PendingClearanceWorkspace() {
 return <JournalQueueWorkspace clearance />;
}
function JournalQueueWorkspace({clearance = false}: {clearance?: boolean}) {
 const {t}=useTranslation();const {companyId,hasPermission}=useAuth();
 const prefix = clearance ? "accounting.journalClearance" : "accounting.journalReconciliation";
 if (!hasPermission("canViewJournal","journal")) return <p>{t("common.errors.forbidden")}</p>;
 return <div className="space-y-6"><PageHeader title={t(`${prefix}.title`)} description={t(`${prefix}.description`)}/><JournalTransactionsTable key={companyId} pending={!clearance} clearance={clearance}/></div>;
}
