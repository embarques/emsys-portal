"use client";
import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
const initial = { transactionType: "PAYMENT" as const, refNumber: "", description: "", paymentMethodId: 1, paymentMethodName: "CASH" };
const banks = [{ id: 1, name: "Wells Fargo", displayName: "Wells Fargo", type: "BANK", active: true }];
const methods = [{id:1,name:"CASH"},{id:2,name:"DEPOSIT"},{id:3,name:"ZELLE"}];
export default function Probe() { return <Dialog open><DialogContent><DialogTitle>Payment loop probe</DialogTitle><DailyIncomeTransactionForm transactionType="PAYMENT" initialValues={initial} employees={[]} accounts={[]} bankAccounts={banks} invoices={[]} paymentMethods={methods} formId="probe" onSubmit={()=>{}} /></DialogContent></Dialog>; }
