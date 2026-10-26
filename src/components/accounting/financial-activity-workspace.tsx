"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { activityFormSchema, type ActivityFormValues } from "@/lib/accounting/financial-activity/schemas";
import Link from "next/link";
import { CloseoutBranchSettings } from "@/components/accounting/closeout-branch-settings";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { RouteEmployeeRef } from "@/lib/route-manager/types";
import { canReverseFinancialActivity, pendingHandovers, reconciliationActions } from "@/lib/accounting/financial-activity/workflow";
import { clearingAction, type FinancialActivity, type ActivityFilters, type AutomationSettings } from "@/lib/accounting/financial-activity/api";
import { useClearFinancialPayment, useFinancialActivity, useActivityHistory, useRecordActivity, useReverseActivity, useAutomationSettings, useSaveAutomation } from "@/lib/accounting/financial-activity/hooks";
const initialFilters: ActivityFilters = { employee: "", method: "", branch: "", from: "", through: "", minimum: "", age: "" };
function money(amount: number, currency?: string) { return new Intl.NumberFormat(undefined,currency ? {style:"currency",currency} : {maximumFractionDigits:2}).format(amount); }
export function FinancialActivityWorkspace() {
    const { t } = useTranslation();
    const { companyId, hasPermission } = useAuth();
    const [filters, setFilters] = useState(initialFilters);
    const [page, setPage] = useState(1);
    const [selection,setSelection]=useState<{companyId:string|null;row:FinancialActivity}|null>(null);
 const selected=selection?.companyId===companyId?selection.row:null;
 function setSelected(row:FinancialActivity|null){setSelection(row?{companyId,row}:null);}

    const debounced = useDebouncedValue(filters, 300);
    const query = useFinancialActivity(debounced, page);
    const settings = useAutomationSettings();
    const text = (key: string) => t(`accounting.financialActivity.${key}`);
    function filter(name: keyof ActivityFilters, value: string) { setPage(1); setFilters(current => ({ ...current, [name]: value })); }
    const canView = hasPermission("canViewFinancialActivity", "financial_activity");
    if (!canView)
        return <p>{t("common.errors.forbidden")}</p>;
    return <div className="space-y-6"><PageHeader title={text("title")} description={text("description")}/>
 <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
 {(["employee", "branch", "from", "through", "minimum", "age"] as const).map(name => <Label key={name} className="space-y-2">{text(name)}<Input type={name === "from" || name === "through" ? "date" : name === "minimum" || name === "age" ? "number" : "text"} min={name === "minimum" || name === "age" ? 0 : undefined} value={filters[name]} onChange={event => filter(name, event.target.value)}/></Label>)}
 <Label className="space-y-2">{text("method")}<select className="h-10 w-full rounded-md border bg-background px-3" value={filters.method} onChange={event => filter("method", event.target.value)}><option value="">{text("all")}</option>{["CASH", "CHECK", "ZELLE", "DEPOSIT", "CREDIT-CARD"].map(method => <option key={method} value={method}>{method}</option>)}</select></Label>
 <Button variant="outline" onClick={() => { setFilters(initialFilters); setPage(1); }}>{text("reset")}</Button></div>
 {query.isError ? <p role="alert" className="text-destructive">{normalizeApiError(query.error).message}</p> : null}
 <div className="overflow-x-auto rounded-xl border"><table className="w-full text-left text-sm"><thead><tr>{["date", "employee", "branch", "method", "currency", "amount", "outstanding", "age", "actions"].map(key => <th scope="col" className="p-3" key={key}>{text(key)}</th>)}</tr></thead><tbody>
 {query.data?.items.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td><td className="p-3">{row.employee?.name ?? "—"}</td><td className="p-3">{row.branch?.name ?? "—"}</td><td className="p-3">{row.paymentMethod?.name ?? "—"}</td><td className="p-3">{row.currency||text("unknownCurrency")}</td><td className="p-3">{money(row.transactionAmount, row.currency)}</td><td className="p-3">{money(row.outstandingAmount, row.currency)}</td><td className="p-3">{row.ageDays}</td><td className="p-3"><Button variant="outline" onClick={() => setSelected(row)}>{text("activity")}</Button></td></tr>)}
 {!query.isFetching && !query.data?.items.length ? <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{text("empty")}</td></tr> : null}
 </tbody></table></div>
 {query.isFetching ? <p role="status">{text("loading")}</p> : null}
 <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>{text("previous")}</Button><span>{page}</span><Button variant="outline" disabled={page * 40 >= (query.data?.total ?? 0) || query.isFetching} onClick={() => setPage(value => value + 1)}>{text("next")}</Button></div>
 <p className="text-sm text-muted-foreground">{text("clearingHelp")} <Link className="underline" href="/accounting/checks">{text("checks")}</Link> · <Link className="underline" href="/accounting/zelle">Zelle</Link> · <Link className="underline" href="/accounting/deposits">{text("deposits")}</Link> · <Link className="underline" href="/accounting/credit-cards">{text("cards")}</Link></p>
 {settings.data && hasPermission("canUpdateSettings", "settings") ? <AutomationForm key={`${companyId}:${JSON.stringify(settings.data)}`} initial={settings.data}/> : null}
 <Dialog open={!!selected} onOpenChange={open => { if (!open)
        setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{text("activity")}</DialogTitle><DialogDescription>{text("historyHelp")}</DialogDescription></DialogHeader>{selected ? <ActivityDetails key={`${companyId}:${selected.id}`} row={selected}/> : null}</DialogContent></Dialog></div>;
}
function AutomationForm({ initial }: {
    initial: AutomationSettings;
}) {
    const { t } = useTranslation();
    const [settings, setSettings] = useState(initial);
    const save = useSaveAutomation();
    const text = (key: string) => t(`accounting.financialActivity.${key}`);
    return <form className="space-y-4 rounded-xl border p-4" onSubmit={event => { event.preventDefault(); save.mutate(settings); }}><h3 className="text-lg font-semibold">{text("automation")}</h3><p className="text-sm text-muted-foreground">{text("automationHelp")}</p>
 <Label className="flex items-center gap-2"><input type="checkbox" checked={settings.enabled} onChange={event => setSettings(current => ({ ...current, enabled: event.target.checked }))}/>{text("enabled")}</Label>
 <div className="grid gap-3 sm:grid-cols-3"><Label>{text("timezone")}<Input required value={settings.timezone} onChange={event => setSettings(current => ({ ...current, timezone: event.target.value }))}/></Label><Label>{text("currency")}<select className="h-10 w-full rounded-md border bg-background px-3" value={settings.currency} onChange={event => setSettings(current => ({ ...current, currency: event.target.value }))}><option>USD</option><option>DOP</option></select></Label><Label>{text("rate")}<Input type="number" required min="0.000001" step="any" value={settings.rate} onChange={event => setSettings(current => ({ ...current, rate: Number(event.target.value) }))}/></Label></div>
 <CloseoutBranchSettings settings={settings} onChange={setSettings}/>
 {save.isError ? <p role="alert" className="text-destructive">{normalizeApiError(save.error).message}</p> : null}{save.isSuccess ? <p role="status">{text("saved")}</p> : null}<Button type="submit" disabled={save.isPending || JSON.stringify(initial) === JSON.stringify(settings)}>{text("save")}</Button></form>;
}
function ActivityDetails({ row }: {
    row: FinancialActivity;
}) {
    const { t } = useTranslation();
    const { hasPermission } = useAuth();
    const history = useActivityHistory(row.journalId ?? row.paymentId ?? row.id,!row.journalId);
    const clear = useClearFinancialPayment();
    const clearing = clearingAction(row);
    const record = useRecordActivity();
    const reverse = useReverseActivity();
    const form = useForm<ActivityFormValues>({
      resolver: zodResolver(activityFormSchema),
      defaultValues: {
        type: reconciliationActions(row, [])[0] ?? "REVERSED",
        amount: String(row.outstandingAmount),
        from: row.employee ? [row.employee] : [], to: [], reference: "", handover: "",
      },
    });
    const { type, amount, from, to, reference, handover } = form.watch();
    const setType = (value: string) => { form.setValue("type", value); form.setValue("handover", ""); };
    const setAmount = (value: string) => form.setValue("amount", value);
    const setFrom = (value: RouteEmployeeRef[]) => form.setValue("from", value);
    const setTo = (value: RouteEmployeeRef[]) => form.setValue("to", value);
    const setReference = (value: string) => form.setValue("reference", value);
    const setHandover = (value: string) => form.setValue("handover", value);
    const [requestId, setRequestId] = useState(() => crypto.randomUUID());
    const text = (key: string) => t(`accounting.financialActivity.${key}`);
    const canUpdate = !!row.journalId && hasPermission("canUpdateFinancialActivity", "financial_activity");
    const canReverse = canUpdate && canReverseFinancialActivity(row) && hasPermission("canCreateJournal", "journal") && hasPermission("canCreateFinancialAdjustment","financial_adjustment") && !(history.data ?? []).some(event => event.type === "REVERSED");
    const pending = pendingHandovers(history.data ?? []);
    const actions = [...reconciliationActions(row, history.data ?? []), ...(canReverse ? ["REVERSED"] : [])];
    const selectedType = actions.includes(type) ? type : (actions[0] ?? "");
    return <div className="space-y-4">{clearing && hasPermission(clearing.name, clearing.resource) ? <Button disabled={clear.isPending} onClick={() => clear.mutate(row)}>{text("events.CLEARED")}</Button> : null}{clear.isError ? <p role="alert" className="text-destructive">{normalizeApiError(clear.error).message}</p> : null}{history.isError ? <p role="alert">{normalizeApiError(history.error).message}</p> : null}<ol className="space-y-2">{history.data?.map(event => <li key={event.id} className="rounded-md border p-3"><strong>{text(`events.${event.type}`)}</strong> · {money(event.amount, row.currency)}<div className="text-sm text-muted-foreground">{event.performedBy?.name} · {new Date(event.recordedAt).toLocaleString()}</div>{event.reference ? <p>{event.reference}</p> : null}</li>)}</ol>
 {canUpdate && actions.length > 0 && history.isSuccess ? <form className="space-y-3 border-t pt-4" onSubmit={form.handleSubmit(async () => { if (record.isPending || reverse.isPending || !row.journalId || !actions.includes(selectedType)) return; try {
            if (selectedType === "REVERSED") {
                await reverse.mutateAsync({ id: row.journalId, requestId, reason: reference });
            }
            else {
                const transfer = selectedType === "VERIFIED" || selectedType === "REJECTED" ? pending.find(event => event.id === handover) : undefined;
                await record.mutateAsync({ id: row.journalId, input: { requestId, type: selectedType, amount: transfer ? transfer.amount : Number(amount), fromEmployeeId: transfer?.fromEmployeeId ?? from[0]?.id, toEmployeeId: transfer?.toEmployeeId ?? to[0]?.id, handoverId: transfer?.id, reference } });
            }
            setRequestId(crypto.randomUUID());
            setReference("");
        }
        catch { /* Mutation error stays visible and requestId is retained for retries. */ } })}>
 <Label>{text("action")}<select className="h-10 w-full rounded-md border bg-background px-3" value={selectedType} onChange={event => setType(event.target.value)}>{actions.map(value => <option value={value} key={value}>{text(`events.${value}`)}</option>)}</select></Label>
 {selectedType !== "REVERSED" ? <Label>{text("amount")}<Input required type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)}/></Label> : null}
 {selectedType === "HANDED_OVER" ? <><Label>{text("fromEmployee")}</Label><RouteEmployeeSelect value={from} onChange={value => setFrom(value.slice(-1))}/><Label>{text("toEmployee")}</Label><RouteEmployeeSelect value={to} onChange={value => setTo(value.slice(-1))}/></> : null}
 {(selectedType === "VERIFIED" || selectedType === "REJECTED") && pending.length ? <Label>{text("handover")}<select className="h-10 w-full rounded-md border bg-background px-3" required value={handover} onChange={event => { setHandover(event.target.value); const selected = pending.find(item => item.id === event.target.value); if (selected)
            setAmount(String(selected.amount)); }}><option value="">{text("choose")}</option>{pending.map(event => <option key={event.id} value={event.id}>{money(event.amount, row.currency)} · {new Date(event.recordedAt).toLocaleString()}</option>)}</select></Label> : null}
 <Label>{text("reference")}<Input required={selectedType === "REVERSED"} maxLength={1000} value={reference} onChange={event => setReference(event.target.value)}/></Label>
 {Object.values(form.formState.errors).map((error, index) => <p key={index} role="alert" className="text-destructive">{error.message}</p>)}
 {record.isError || reverse.isError ? <p role="alert" className="text-destructive">{normalizeApiError(record.error ?? reverse.error).message}</p> : null}<Button type="submit" disabled={form.formState.isSubmitting || record.isPending || reverse.isPending}>{text("save")}</Button></form> : null}</div>;
}
