"use client";
import { PageHeader } from "@/components/app-shell/page-header";
import { JournalTransactionsTable } from "./journal-transactions-table";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
export function FinancialActivityWorkspace() {
 const {t}=useTranslation();const {companyId,hasPermission}=useAuth();
 if (!hasPermission("canViewJournal","journal")) return <p>{t("common.errors.forbidden")}</p>;
 return <div className="space-y-6"><PageHeader title={t("accounting.journalReconciliation.title")} description={t("accounting.journalReconciliation.description")}/><JournalTransactionsTable key={companyId} pending/></div>;
}
