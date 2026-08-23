import { z } from "zod";

export const createLoanSchema = z.object({
  employeeId: z.number().positive("Employee is required."),
  employeeName: z.string().optional(),
  loanAccountId: z.number().positive("Loan account is required."),
  loanAccountName: z.string().optional(),
  loanAccountType: z.string().optional(),
  sourceAccountId: z.number().positive("Source asset account is required."),
  sourceAccountName: z.string().optional(),
  sourceAccountType: z.string().optional(),
  principalAmount: z.number({ error: "Principal amount is required." }).positive("Principal amount must be greater than zero."),
  transactionDate: z.string().min(1, "Date is required."),
  referenceNumber: z.string().trim().max(40, "Reference number is too long."),
  description: z.string().trim().max(500, "Description is too long."),
});

export const loanPaymentSchema = z
  .object({
    employeeId: z.number().positive("Employee is required."),
    employeeName: z.string().optional(),
    allocationMode: z.enum(["oldest-first", "specific-loan"]),
    loanId: z.string().optional(),
    receivedAccountId: z.number().positive("Payment received account is required."),
    receivedAccountName: z.string().optional(),
    receivedAccountType: z.string().optional(),
    amount: z.number({ error: "Payment amount is required." }).positive("Payment amount must be greater than zero."),
    transactionDate: z.string().min(1, "Date is required."),
    referenceNumber: z.string().trim().max(40, "Reference number is too long."),
    description: z.string().trim().max(500, "Description is too long."),
  })
  .superRefine((values, context) => {
    if (values.allocationMode === "specific-loan" && !values.loanId) {
      context.addIssue({
        code: "custom",
        path: ["loanId"],
        message: "Select a loan.",
      });
    }
  });
