"use client";
import { Fragment, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { activityFormSchema, type ActivityFormValues } from "@/lib/accounting/financial-activity/schemas";
import { PageHeader } from "@/components/app-shell/page-header";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { TableTagText } from "@/components/app-shell/table-tag-text";
import { getEmployeeBadgeClass, getPaymentMethodBadgeClass } from "@/lib/accounting/financial-activity/display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollText, SlidersHorizontal } from "lucide-react";
import { DirectoryTableLoader } from "@/components/app-shell/directory-table-loader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { resolveUserBranchRef } from "@/lib/branches/user-branch";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { useTranslation } from "@/lib/i18n";
import { normalizeApiError } from "@/lib/api/axios";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { RouteEmployeeRef } from "@/lib/route-manager/types";
import { canReverseFinancialActivity, pendingHandovers, reconciliationActions } from "@/lib/accounting/financial-activity/workflow";
import { clearingAction, type FinancialActivity, type ActivityFilters } from "@/lib/accounting/financial-activity/api";
import { useClearFinancialPayment, useFinancialActivity, useActivityHistory, useRecordActivity, useReverseActivity } from "@/lib/accounting/financial-activity/hooks";
const initialFilters: ActivityFilters = { employee: "", method: "", branch: "", from: "", through: "", minimum: "", age: "" };
const ALL_VALUE = "all";
const PAYMENT_METHODS = ["CASH", "CHECK", "ZELLE", "DEPOSIT", "CREDIT-CARD"];
const ADDITIONAL_FILTERS = ["from", "through", "minimum", "age"] as const;
function money(amount: number, currency?: string) { return new Intl.NumberFormat(undefined,currency ? {style:"currency",currency} : {maximumFractionDigits:2}).format(amount); }
/** Accounting transactions awaiting reconciliation. */
export function FinancialActivityWorkspace() {
    const { t } = useTranslation();
    const { hasPermission } = useAuth();
    if (!hasPermission(PERMISSIONS.financialActivityView.name, PERMISSIONS.financialActivityView.resourceType))
        return <p>{t("common.errors.forbidden")}</p>;
    return <div className="space-y-6">
        <PageHeader title={t("accounting.financialActivity.title")} description={t("accounting.financialActivity.description")} />
        <FinancialActivityPanel />
    </div>;
}
function FinancialActivityPanel() {
    const { t } = useTranslation();
    const { companyId, hasPermission } = useAuth();
    const [filters, setFilters] = useState(initialFilters);
    const [page, setPage] = useState(1);
    const [selection,setSelection]=useState<{companyId:string|null;row:FinancialActivity}|null>(null);
 const selected=selection?.companyId===companyId?selection.row:null;
 function setSelected(row:FinancialActivity|null){setSelection(row?{companyId,row}:null);}

    const [branchChoice, setBranchChoice] = useState<{ companyId: string | null; value: string } | null>(null);
    const currentUserQuery = useCurrentUser();
    const branchesQuery = useBranchPicker(200);
    const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
    const userBranch = currentUserQuery.data?.branch;
    const userBranchRef = useMemo(() => resolveUserBranchRef(userBranch, branches), [userBranch, branches]);
    const userSettled = Boolean(currentUserQuery.data) || currentUserQuery.isFetched || currentUserQuery.isError;
    // A name-only user branch needs the directory to resolve its id before the first search.
    const branchReady = userSettled && !(userBranch && !userBranchRef && branchesQuery.isPending);
    const branchValue = branchChoice?.companyId === companyId ? branchChoice.value : (userBranchRef?.id ? String(userBranchRef.id) : "");
    const employeeBranch = branches.find(branch => String(branch.id) === branchValue) ?? (String(userBranchRef?.id) === branchValue ? userBranchRef : undefined);
    const employeesQuery = useEmployees(
        { page: 1, limit: 200, sort: "name:asc", branch: employeeBranch?.code || "all" },
        { enabled: branchReady && (!branchValue || Boolean(employeeBranch?.code)) },
    );
    const debounced = useDebouncedValue(filters, 300);
    const activeFilters = useMemo(() => ({ ...debounced, employee: filters.employee, method: filters.method, branch: branchValue }), [debounced, filters.employee, filters.method, branchValue]);
    const query = useFinancialActivity(activeFilters, page, { enabled: branchReady });
    const text = (key: string) => t(`accounting.financialActivity.${key}`);
    const employeeOptions = useMemo(() => [
        { value: ALL_VALUE, label: t("accounting.financialActivity.allEmployees") },
        ...(employeesQuery.isPlaceholderData || !branchReady || (branchValue && !employeeBranch?.code) ? [] : employeesQuery.data?.items ?? []).map(employee => ({ value: String(employee.id), label: employee.name, keywords: [employee.name, employee.title, employee.branch?.code].filter(Boolean) as string[] })),
    ], [employeesQuery.data?.items, employeesQuery.isPlaceholderData, branchReady, branchValue, employeeBranch?.code, t]);
    const branchOptions = useMemo(() => {
        const extra = userBranchRef && !branches.some(branch => branch.id === userBranchRef.id) ? [userBranchRef] : [];
        return [
            { value: ALL_VALUE, label: t("accounting.financialActivity.allBranches") },
            ...[...extra, ...branches].map(branch => ({ value: String(branch.id), label: formatBranchFilterLabel(branch), keywords: [branch.code, branch.name] })),
        ];
    }, [branches, userBranchRef, t]);
    const methodOptions = useMemo(() => [
        { value: ALL_VALUE, label: t("accounting.financialActivity.all") },
        ...PAYMENT_METHODS.map(method => ({ value: method, label: method })),
    ], [t]);
    function filter(name: keyof ActivityFilters, value: string) { setPage(1); setFilters(current => ({ ...current, [name]: value })); }
    const additionalCount = ADDITIONAL_FILTERS.filter(name => filters[name] !== "").length;
    function chooseBranch(value: string) { setFilters(current => ({ ...current, employee: "" })); setPage(1); setBranchChoice({ companyId, value: value === ALL_VALUE ? "" : value }); }
    const canView = hasPermission("canViewFinancialActivity", "financial_activity");
    if (!canView)
        return <p>{t("common.errors.forbidden")}</p>;
    return <div className="space-y-6">
 <div className="grid items-end gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto]">
 <div className="space-y-2"><Label htmlFor="financial-activity-branch">{text("branch")}</Label><SearchableSelect id="financial-activity-branch" value={branchReady ? (branchValue || ALL_VALUE) : ""} onValueChange={chooseBranch} options={branchOptions} loading={!branchReady || branchesQuery.isLoading} placeholder={text("selectBranch")} searchPlaceholder={text("searchBranches")} emptyMessage={text("noBranchesFound")} mobileSheet/></div>
 <div className="space-y-2"><Label htmlFor="financial-activity-employee">{text("employee")}</Label><SearchableSelect id="financial-activity-employee" value={filters.employee || ALL_VALUE} onValueChange={value => filter("employee", value === ALL_VALUE ? "" : value)} options={employeeOptions} loading={employeesQuery.isLoading} placeholder={text("selectEmployee")} searchPlaceholder={text("searchEmployees")} emptyMessage={text("noEmployeesFound")} mobileSheet/></div>
 <div className="space-y-2"><Label htmlFor="financial-activity-method">{text("method")}</Label><SearchableSelect id="financial-activity-method" value={filters.method || ALL_VALUE} onValueChange={value => filter("method", value === ALL_VALUE ? "" : value)} options={methodOptions} placeholder={text("all")} searchPlaceholder={text("searchMethods")} emptyMessage={text("noMethodsFound")} mobileSheet/></div>
 <Popover><PopoverTrigger asChild><Button type="button" variant="outline"><SlidersHorizontal className="size-4"/>{text("additionalFilters")}{additionalCount ? ` (${additionalCount})` : ""}</Button></PopoverTrigger>
 <PopoverContent align="end" className="grid w-[30rem] max-w-[calc(100vw-2rem)] grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-4">{ADDITIONAL_FILTERS.map(name => <Fragment key={name}><Label htmlFor={`financial-activity-${name}`} className="whitespace-nowrap">{text(name)}</Label><Input id={`financial-activity-${name}`} className="w-full" type={name === "from" || name === "through" ? "date" : "number"} min={name === "minimum" || name === "age" ? 0 : undefined} value={filters[name]} onChange={event => filter(name, event.target.value)}/></Fragment>)}</PopoverContent></Popover>
 <Button variant="outline" onClick={() => { setFilters(initialFilters); setBranchChoice(null); setPage(1); }}>{text("reset")}</Button>
 </div>
 {query.isError ? <p role="alert" className="text-destructive">{normalizeApiError(query.error).message}</p> : null}
 {query.isPending || !branchReady ? <DirectoryTableLoader icon={ScrollText} title={text("loading")} description={text("loadingDescription")} columns={["date", "employee", "dailyRoute", "branch", "method", "amount", "outstanding"].map(text)}/> : !query.isError ? <>
 <div className="overflow-x-auto rounded-xl border" aria-busy={query.isFetching}><table className="w-full text-left text-sm"><thead><tr>{["date", "employee", "dailyRoute", "branch", "method", "currency", "amount", "outstanding", "age", "actions"].map(key => <th scope="col" className="p-3" key={key}>{text(key)}</th>)}</tr></thead><tbody>
 {query.data?.items.map(row => <tr key={row.id} className="border-t"><td className="p-3">{row.date ? new Date(row.date).toLocaleDateString() : "—"}</td><td className="p-3">{row.employee?.name ? <TableTagText className={getEmployeeBadgeClass(row.employee.id)}>{row.employee.name}</TableTagText> : "—"}</td><td className="p-3">{row.dailyRoute?.name || "—"}</td><td className="p-3">{row.branch?.name ?? "—"}</td><td className="p-3">{row.paymentMethod?.name ? <TableTagText className={getPaymentMethodBadgeClass(row.paymentMethod.name)}>{row.paymentMethod.name}</TableTagText> : "—"}</td><td className="p-3">{row.currency||text("unknownCurrency")}</td><td className="p-3">{money(row.transactionAmount, row.currency)}</td><td className="p-3">{money(row.outstandingAmount, row.currency)}</td><td className="p-3">{row.ageDays}</td><td className="p-3"><Button variant="outline" onClick={() => setSelected(row)}>{text("activity")}</Button></td></tr>)}
 {!query.isFetching && !query.data?.items.length ? <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">{text("empty")}</td></tr> : null}
 </tbody></table></div>
 {query.isFetching ? <p role="status" className="text-sm text-muted-foreground">{text("loading")}</p> : null}
 <div className="flex items-center justify-end gap-3"><Button variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => value - 1)}>{text("previous")}</Button><span>{page}</span><Button variant="outline" disabled={page * 40 >= (query.data?.total ?? 0) || query.isFetching} onClick={() => setPage(value => value + 1)}>{text("next")}</Button></div>
 </> : null}
 <Dialog open={!!selected} onOpenChange={open => { if (!open)
        setSelected(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{text("activity")}</DialogTitle><DialogDescription>{text("historyHelp")}</DialogDescription></DialogHeader>{selected ? <ActivityDetails key={`${companyId}:${selected.id}`} row={selected}/> : null}</DialogContent></Dialog></div>;
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
