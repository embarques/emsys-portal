import { createDailyIncomeJournal } from "@/lib/accounting/daily-income/api";
import type {
  DailyIncomeJournal,
  DailyIncomeStatement,
} from "@/lib/accounting/daily-income/types";
import { resolveLineTotal, type InvoiceFormValues } from "@/lib/invoices/types";

type ZeroPaymentEmployee = {
  id: number;
  name: string;
};

/**
 * Registers an unpaid invoice in an open Cuadre as INITIAL-PAYMENT with $0 paid.
 * Invoice cost / balance remain on the statement; payment amount is zero.
 */
export async function registerInvoiceZeroPaymentInCuadre(params: {
  statement: DailyIncomeStatement;
  invoice: InvoiceFormValues;
  employee: ZeroPaymentEmployee;
  description: string;
}): Promise<DailyIncomeJournal> {
  const { statement, invoice, employee, description } = params;

  if (statement.status !== "OPEN") {
    throw new Error("Today's Daily Income must be open to register a skipped payment.");
  }

  const invoiceSubtotal = invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  const invoiceDiscount = Number(invoice.discount) || 0;
  const invoiceCost = Math.max(0, invoiceSubtotal);

  const journal = await createDailyIncomeJournal(statement, {
    transactionType: "INITIAL-PAYMENT",
    amount: 0,
    refNumber: "",
    description,
    employeeId: employee.id,
    employeeName: employee.name,
    invoiceNumber: invoice.invoiceNumber,
    invoiceCost,
    invoiceDiscount,
    includeSender: Boolean(invoice.sender),
    senderId: invoice.sender?.id,
    senderName: invoice.sender?.name,
    includeReceiver: Boolean(invoice.receiver),
    receiverId: invoice.receiver?.id,
    receiverName: invoice.receiver?.name,
  });

  if (!journal) {
    throw new Error("The API did not return the Daily Income registration.");
  }

  return journal;
}
