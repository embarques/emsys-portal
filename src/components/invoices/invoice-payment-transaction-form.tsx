"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm, type FieldErrors } from "react-hook-form";

import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import {
  useAccountingPaymentMethods,
  useCreateDailyIncomeJournal,
} from "@/lib/accounting/daily-income/hooks";
import { createDailyIncomeJournalSchema } from "@/lib/accounting/daily-income/schemas";
import {
  findCashPaymentMethod,
  isCheckPaymentMethod,
  withDefaultCashPaymentMethod,
  type AccountingLookup,
  type DailyIncomeJournal,
  type DailyIncomeJournalValues,
  type DailyIncomeStatement,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { buildInvoiceDailyIncomeAssigneeDefaults } from "@/lib/invoices/schemas/invoice-daily-income.schema";
import { resolveLineTotal, type InvoiceFormValues } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

const EMPTY_PAYMENT_METHODS: AccountingLookup[] = [];
const EMPTY_BANK_ACCOUNTS: ChartAccount[] = [];
const EMPTY_DAILY_ROUTES: ActiveRoute[] = [];

type Props = {
  statement: DailyIncomeStatement;
  invoice: InvoiceFormValues;
  onRegistered: (journal: DailyIncomeJournal) => void | Promise<void>;
};

function buildInitialValues(
  invoice: InvoiceFormValues,
  routeNameById?: Map<string, string>,
): DailyIncomeJournalValues {
  const invoiceSubtotal = invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  const discount = Number(invoice.discount) || 0;

  return {
    transactionType: "INITIAL-PAYMENT",
    amount: 0,
    refNumber: "",
    description: "",
    invoiceNumber: invoice.invoiceNumber,
    invoiceCost: Math.max(0, invoiceSubtotal),
    invoiceDiscount: discount,
    includeSender: Boolean(invoice.sender),
    senderId: invoice.sender?.id || undefined,
    senderName: invoice.sender?.name || undefined,
    includeReceiver: Boolean(invoice.receiver),
    receiverId: invoice.receiver?.id || undefined,
    receiverName: invoice.receiver?.name || undefined,
    ...buildInvoiceDailyIncomeAssigneeDefaults(invoice, routeNameById),
  };
}

function resolveEmployeeForCurrentUser(
  user: { id: number; email: string; name: string },
  employees: Array<{ id: number; name: string; email: string; user?: { id: number } | null }>,
) {
  const normalizedEmail = user.email.trim().toLowerCase();
  return (
    employees.find((item) => item.user?.id === user.id) ??
    employees.find((item) => item.email.trim().toLowerCase() === normalizedEmail) ??
    employees.find((item) => item.name.trim().toLowerCase() === user.name.trim().toLowerCase()) ??
    null
  );
}

function getFirstValidationMessage(errors: FieldErrors<DailyIncomeJournalValues>): string | null {
  for (const error of Object.values(errors)) {
    if (!error) continue;
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }
  }

  return null;
}

function hasJournalAssignee(values: Pick<DailyIncomeJournalValues, "employeeId" | "routeId">) {
  return Boolean(values.employeeId) || Boolean(values.routeId?.trim());
}

export function InvoicePaymentTransactionForm({ statement, invoice, onRegistered }: Props) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const isMobileLayout = useIsMobileViewport();
  const formId = useId();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const currentUserQuery = useCurrentUser();
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc", active: true });
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const createJournal = useCreateDailyIncomeJournal();
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const paymentMethods = paymentMethodsQuery.data ?? EMPTY_PAYMENT_METHODS;
  const bankAccounts = bankAccountsQuery.data?.items ?? EMPTY_BANK_ACCOUNTS;
  const step1AssigneeSeed = useMemo(
    () => buildInvoiceDailyIncomeAssigneeDefaults(invoice),
    [invoice],
  );
  const hasStep1Assignee = hasJournalAssignee(step1AssigneeSeed);
  // Desktop hides assignee when step 1 already chose one; load routes when the picker is shown.
  const showAssignee = isMobileLayout || !hasStep1Assignee;
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, {
    enabled:
      showAssignee || (invoice.pickupSource === "route" && Boolean(invoice.routeId.trim())),
  });
  const dailyRoutes = pickupRoutesQuery.data?.items ?? EMPTY_DAILY_ROUTES;
  const routeNameById = useMemo(
    () => new Map(dailyRoutes.map((route) => [route.id, route.name] as const)),
    [dailyRoutes],
  );

  const schema = useMemo(
    () =>
      createDailyIncomeJournalSchema({
        amountRequired: t("accounting.dailyIncome.form.validation.amountRequired"),
        amountNonNegative: t("accounting.dailyIncome.form.validation.amountNonNegative"),
        amountPositive: t("accounting.dailyIncome.form.validation.amountPositive"),
        refNumberTooLong: t("accounting.dailyIncome.form.validation.refNumberTooLong"),
        descriptionTooLong: t("accounting.dailyIncome.form.validation.descriptionTooLong"),
        costPositive: t("accounting.dailyIncome.form.validation.costPositive"),
        discountNonNegative: t("accounting.dailyIncome.form.validation.discountNonNegative"),
        zelleDateRequired: t("accounting.dailyIncome.form.validation.zelleDateRequired"),
        zelleNameRequired: t("accounting.dailyIncome.form.validation.zelleNameRequired"),
        checkNumberRequired: t("accounting.dailyIncome.form.validation.checkNumberRequired"),
        bankAccountRequired: t("accounting.dailyIncome.form.validation.bankAccountRequired"),
        employeeRequired: t("accounting.dailyIncome.form.validation.employeeRequired"),
        invoiceRequired: t("accounting.dailyIncome.form.validation.invoiceRequired"),
        paymentMethodRequired: t("accounting.dailyIncome.form.validation.paymentMethodRequired"),
        amountExceedsCost: t("accounting.dailyIncome.form.validation.amountExceedsCost"),
        senderRequired: t("accounting.dailyIncome.form.validation.senderRequired"),
        receiverRequired: t("accounting.dailyIncome.form.validation.receiverRequired"),
        amountExceedsBalance: t("accounting.dailyIncome.form.validation.amountExceedsBalance"),
        accountRequired: t("accounting.dailyIncome.form.validation.accountRequired"),
        sourceAccountRequired: t("accounting.dailyIncome.form.validation.sourceAccountRequired"),
        inventoryRequired: t("accounting.dailyIncome.form.validation.inventoryRequired"),
        inventoryItemRequired: t("accounting.dailyIncome.form.validation.inventoryItemRequired"),
        inventoryQuantityRequired: t("accounting.dailyIncome.form.validation.inventoryQuantityRequired"),
        inventoryPriceRequired: t("accounting.dailyIncome.form.validation.inventoryPriceRequired"),
        supplierRequired: t("accounting.dailyIncome.form.validation.supplierRequired"),
      }),
    [t],
  );

  const invoiceLineItemsTotal = useMemo(
    () => Math.max(0, invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0)),
    [invoice.lineItems],
  );
  const invoiceDiscount = Number(invoice.discount) || 0;
  const invoiceRef = useRef(invoice);
  invoiceRef.current = invoice;

  const initialValues = useMemo(
    () =>
      withDefaultCashPaymentMethod(
        buildInitialValues(invoice, routeNameById),
        paymentMethods,
      ),
    [invoice, paymentMethods, routeNameById],
  );

  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    watch,
  } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });

  // Full reset only when the Cuadre statement changes — never wipe payment fields when
  // routes/payment methods finish loading or when translation identity changes.
  const paymentMethodsRef = useRef(paymentMethods);
  paymentMethodsRef.current = paymentMethods;
  const routeNameByIdRef = useRef(routeNameById);
  routeNameByIdRef.current = routeNameById;

  useEffect(() => {
    reset(
      withDefaultCashPaymentMethod(
        buildInitialValues(invoiceRef.current, routeNameByIdRef.current),
        paymentMethodsRef.current,
      ),
    );
  }, [reset, statement.id]);

  // Keep assignee in sync with invoice step 1 without resetting amount / payment method.
  useEffect(() => {
    const assignee = buildInvoiceDailyIncomeAssigneeDefaults(invoiceRef.current, routeNameById);
    setValue("assigneeSource", assignee.assigneeSource, { shouldValidate: false });
    setValue("employeeId", assignee.employeeId, { shouldValidate: false });
    setValue("employeeName", assignee.employeeName ?? "", { shouldValidate: false });
    setValue("routeId", assignee.routeId, { shouldValidate: false });
    setValue("routeName", assignee.routeName ?? "", { shouldValidate: false });
    setValue("routeCrewId", assignee.routeCrewId, { shouldValidate: false });
    setValue("routeCrewName", assignee.routeCrewName ?? "", { shouldValidate: false });
  }, [
    invoice.pickupEmployeeId,
    invoice.pickupEmployeeName,
    invoice.pickupSource,
    invoice.routeCrewId,
    invoice.routeCrewName,
    invoice.routeId,
    routeNameById,
    setValue,
  ]);

  // Default Cash once methods load, only if the user has not chosen a method yet.
  useEffect(() => {
    if (getValues("paymentMethodId") || paymentMethods.length === 0) return;
    const cash = findCashPaymentMethod(paymentMethods);
    if (!cash) return;
    setValue("paymentMethodId", cash.id, { shouldValidate: false });
    setValue("paymentMethodName", cash.name, { shouldValidate: false });
  }, [getValues, paymentMethods, setValue]);

  useEffect(() => {
    setValue("invoiceCost", invoiceLineItemsTotal, { shouldValidate: true });
    setValue("invoiceDiscount", invoiceDiscount, { shouldValidate: true });
    setValue("invoiceNumber", invoice.invoiceNumber);
  }, [invoice.invoiceNumber, invoiceDiscount, invoiceLineItemsTotal, setValue]);

  // Enrich route label once daily routes finish loading.
  useEffect(() => {
    const selectedRouteId = getValues("routeId")?.trim();
    if (!selectedRouteId) return;
    const route = dailyRoutes.find((item) => item.id === selectedRouteId);
    const nextName = route?.name.trim();
    if (!nextName || getValues("routeName")?.trim() === nextName) return;
    setValue("routeName", nextName, { shouldValidate: false });
  }, [dailyRoutes, getValues, setValue]);

  // Fallback only when step 1 left assignee empty.
  useEffect(() => {
    const user = currentUserQuery.data;
    if (!user || employees.length === 0) return;
    if (getValues("employeeId") || getValues("routeId")?.trim()) return;
    if (getValues("assigneeSource") === "route") return;
    const employee = resolveEmployeeForCurrentUser(user, employees);
    if (!employee) return;
    setValue("assigneeSource", "employee", { shouldValidate: true });
    setValue("employeeId", employee.id, { shouldValidate: true });
    setValue("employeeName", employee.name, { shouldValidate: true });
  }, [currentUserQuery.data, employees, getValues, setValue]);

  useEffect(() => {
    const description = t("invoices.wizard.dailyIncome.dialog.initialRegistrationDescription");
    if (getValues("description") === description) return;
    setValue("description", description, { shouldValidate: false });
  }, [getValues, setValue, t]);

  async function submit(values: DailyIncomeJournalValues) {
    try {
      setSubmitError(null);

      const assignedToRoute = Boolean(values.routeId?.trim());
      const user = currentUserQuery.data;
      const employee =
        (!assignedToRoute && values.employeeId
          ? employees.find((item) => item.id === values.employeeId)
          : null) ??
        (!assignedToRoute && user ? resolveEmployeeForCurrentUser(user, employees) : null);

      if (!assignedToRoute && !employee) {
        const message = t("invoices.wizard.dailyIncome.dialog.employeeUnavailable");
        setSubmitError(message);
        notifyError(message);
        return;
      }

      const amount = Number.isFinite(values.amount) ? Number(values.amount) : 0;
      const paymentDetailsRequired = amount > 0;

      const journal = await createJournal.mutateAsync({
        statement,
        values: {
          ...values,
          transactionType: "INITIAL-PAYMENT",
          amount,
          assigneeSource: assignedToRoute ? "route" : "employee",
          employeeId: assignedToRoute ? undefined : employee?.id,
          employeeName: assignedToRoute ? undefined : employee?.name,
          routeId: assignedToRoute ? values.routeId : undefined,
          routeName: assignedToRoute ? values.routeName : undefined,
          routeCrewId: assignedToRoute ? values.routeCrewId : undefined,
          routeCrewName: assignedToRoute ? values.routeCrewName : undefined,
          invoiceNumber: invoice.invoiceNumber,
          invoiceCost: invoiceLineItemsTotal,
          invoiceDiscount,
          includeSender: Boolean(invoice.sender),
          senderId: invoice.sender?.id,
          senderName: invoice.sender?.name,
          includeReceiver: Boolean(invoice.receiver),
          receiverId: invoice.receiver?.id,
          receiverName: invoice.receiver?.name,
          paymentMethodId: paymentDetailsRequired ? values.paymentMethodId : undefined,
          paymentMethodName: paymentDetailsRequired ? values.paymentMethodName : undefined,
          paymentAccountId: paymentDetailsRequired ? values.paymentAccountId : undefined,
          paymentAccountName: paymentDetailsRequired ? values.paymentAccountName : undefined,
          paymentAccountType: paymentDetailsRequired ? values.paymentAccountType : undefined,
          zelleTransactionDate: paymentDetailsRequired ? values.zelleTransactionDate : undefined,
          zelleTransactionName: paymentDetailsRequired ? values.zelleTransactionName : undefined,
          checkNumber: paymentDetailsRequired ? values.checkNumber : undefined,
        },
      });
      if (!journal) {
        throw new Error(t("invoices.wizard.dailyIncome.dialog.registrationMissing"));
      }
      notifySuccess(
        isCheckPaymentMethod(values.paymentMethodName) && amount > 0
          ? t("invoices.wizard.dailyIncome.checkPaymentRecordedToast", {
              amount: formatInvoiceMoney(journal.amount),
              invoiceNumber: invoice.invoiceNumber,
              checkNumber: values.checkNumber?.trim() || "—",
            })
          : t("invoices.wizard.dailyIncome.paymentRecordedToast", {
              amount: formatInvoiceMoney(journal.amount),
              invoiceNumber: invoice.invoiceNumber,
            }),
      );
      await onRegistered(journal);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setSubmitError(message);
      notifyError(message);
    }
  }

  function handleInvalid(nextErrors: FieldErrors<DailyIncomeJournalValues>) {
    const message = getFirstValidationMessage(nextErrors);
    if (!message) return;
    setSubmitError(message);
    notifyError(message);
  }

  return (
    <div className="space-y-4">
      <form id={formId} className="space-y-4" onSubmit={handleSubmit(submit, handleInvalid)}>
        <RegisterInvoiceTransactionFields
          employees={employees}
          dailyRoutes={dailyRoutes}
          bankAccounts={bankAccounts}
          paymentMethods={paymentMethods}
          errors={errors}
          register={register}
          setValue={setValue}
          watch={watch}
          showEmployee={showAssignee}
          allowDailyRoute={showAssignee}
          showInvoiceNumber={false}
          showParties={false}
          invoiceCostReadOnly
        />

        {submitError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="submit"
            className="max-md:w-full"
            disabled={createJournal.isPending || statement.status !== "OPEN"}
          >
            {createJournal.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {createJournal.isPending
              ? t("invoices.wizard.dailyIncome.dialog.registering")
              : t("invoices.wizard.dailyIncome.recordPaymentNow")}
          </Button>
        </div>
      </form>
    </div>
  );
}
