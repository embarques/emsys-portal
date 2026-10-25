"use client";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { useCurrentIncomeStatement } from "@/lib/accounting/daily-income/hooks";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";

type LoanCloseoutPanelProps = {branchId?:number;branchCode?:string;branchName?:string;date:string;onDateChange?:(date:string)=>void;onReadyChange?:(ready:boolean)=>void};
export function LoanCloseoutPanel({branchId=0,branchCode="",branchName="",date,onDateChange,onReadyChange}:LoanCloseoutPanelProps){
 const {t}=useTranslation();const query=useCurrentIncomeStatement(branchId);const statement=query.data;const ready=Boolean(statement?.status==="OPEN"&&branchId&&date);
 useEffect(()=>{onReadyChange?.(ready);},[ready,onReadyChange]);
 return <section className="space-y-3 rounded-xl border p-4"><h3 className="font-semibold">{t("accounting.dailyIncome.title")}</h3><p className="text-sm text-muted-foreground">{branchName||branchCode}</p>
 {query.isError?<p role="alert" className="text-destructive">{normalizeApiError(query.error).message}</p>:null}
 {query.isFetching?<p role="status">{t("accounting.financialActivity.loading")}</p>:statement?<p>{t("accounting.dailyIncome.status.open")} · {statement.businessDate||statement.date}</p>:<p>{t("accounting.financialActivity.noCurrentCloseout")}</p>}
 {onDateChange?<Label htmlFor="loan-occurrence-date">{t("accounting.financialActivity.occurrenceDate")}<DateInput id="loan-occurrence-date" value={date} onChange={event=>onDateChange(event.target.value)}/></Label>:null}
 <div className="flex gap-3"><Button type="button" variant="outline" onClick={()=>query.refetch()}>{t("accounting.financialActivity.refresh")}</Button><Link className="self-center text-sm underline" href="/accounting/daily-income">{t("accounting.dailyIncome.title")}</Link></div></section>;
}
