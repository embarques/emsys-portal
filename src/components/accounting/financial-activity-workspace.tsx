"use client";
import {useState} from "react";
import {PageHeader} from "@/components/app-shell/page-header";
import {JournalTransactionsTable} from "./journal-transactions-table";
import {CloseoutBranchSettings} from "./closeout-branch-settings";
import {Button} from "@/components/ui/button";
import {Label} from "@/components/ui/label";
import {Input} from "@/components/ui/input";
import {useAuth} from "@/lib/auth/hooks/use-auth";
import {useTranslation} from "@/lib/i18n";
import {normalizeApiError} from "@/lib/api/axios";
import type {AutomationSettings} from "@/lib/accounting/financial-activity/api";
import {useAutomationSettings, useSaveAutomation} from "@/lib/accounting/financial-activity/hooks";

export function FinancialActivityWorkspace() {
 const {t} = useTranslation();
 const {companyId, hasPermission} = useAuth();
 const settings = useAutomationSettings();
 if (!hasPermission("canViewJournal", "journal")) return <p>{t("common.errors.forbidden")}</p>;
 return <div className="space-y-6">
  <PageHeader title={t("accounting.journalReconciliation.title")} description={t("accounting.journalReconciliation.description")}/>
  <JournalTransactionsTable pending/>
  {settings.data && hasPermission("canUpdateSettings", "settings") ? <AutomationForm key={`${companyId}:${JSON.stringify(settings.data)}`} initial={settings.data}/> : null}
 </div>;
}
function AutomationForm({ initial }: {
    initial: AutomationSettings;
}) {
    const { t } = useTranslation();
    const [settings, setSettings] = useState(initial);
    const save = useSaveAutomation();
    const text = (key: string) => t(`accounting.financialActivity.${key}`);
    return <form className="space-y-4 rounded-xl border p-4" onSubmit={event => { event.preventDefault(); save.mutate({...settings,enabled:false}); }}><h3 className="text-lg font-semibold">{text("automation")}</h3><p className="text-sm text-muted-foreground">{text("automationHelp")}</p>

 <div className="grid gap-3 sm:grid-cols-3"><Label>{text("timezone")}<Input required value={settings.timezone} onChange={event => setSettings(current => ({ ...current, timezone: event.target.value }))}/></Label><Label>{text("currency")}<select className="h-10 w-full rounded-md border bg-background px-3" value={settings.currency} onChange={event => setSettings(current => ({ ...current, currency: event.target.value }))}><option>USD</option><option>DOP</option></select></Label><Label>{text("rate")}<Input type="number" required min="0.000001" step="any" value={settings.rate} onChange={event => setSettings(current => ({ ...current, rate: Number(event.target.value) }))}/></Label></div>
 <CloseoutBranchSettings settings={settings} onChange={setSettings}/>
 {save.isError ? <p role="alert" className="text-destructive">{normalizeApiError(save.error).message}</p> : null}{save.isSuccess ? <p role="status">{text("saved")}</p> : null}<Button type="submit" disabled={save.isPending || JSON.stringify(initial) === JSON.stringify(settings)}>{text("save")}</Button></form>;
}
