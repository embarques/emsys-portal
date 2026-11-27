"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { useResponsibilityAccess } from "@/lib/accounting/daily-income/use-responsibility-access";
import { canSelectResponsibleRoute, selfResponsibility } from "@/lib/accounting/daily-income/responsibility";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { buildInvoiceResponsibilityInput } from "@/lib/invoices/responsibility";
import type { InvoicePaymentDraft } from "@/lib/invoices/invoice-daily-income-context";

import { RegisterInvoiceTransactionFields } from "@/components/accounting/register-invoice-transaction-fields";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import type { ChartAccount } from "@/lib/accounting/chart-accounts/types";
import { isPaymentAccountsEnabled } from "@/lib/accounting/daily-income/payment-accounts";
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
import { normalizeDailyIncomeJournalError } from "@/lib/accounting/daily-income/journal-api-error";
import {
  canOpenEmployeesDirectory,
  useResponsibilityRequiredRecoveryAction,
} from "@/components/accounting/open-employees-recovery-action";
import { formatInvoiceMoney } from "@/lib/invoices/display";
import { resolveDailyRouteSupervisor } from "@/lib/accounting/daily-income/assignee";
import { buildInvoiceDailyIncomeAssigneeDefaults } from "@/lib/invoices/schemas/invoice-daily-income.schema";
import { resolveLineTotal, type InvoiceFormValues } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import { useActiveRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

const EMPTY_PAYMENT_METHODS: AccountingLookup[] = [];
const EMPTY_BANK_ACCOUNTS: ChartAccount[] = [];
const EMPTY_DAILY_ROUTES: ActiveRoute[] = [];

type Props = {
  draftRef: MutableRefObject<InvoicePaymentDraft | null>;
  statement: DailyIncomeStatement;
  invoice: InvoiceFormValues;
  onRegistered: (journal: DailyIncomeJournal) => void | Promise<void>;
  /** Amount is $0 or payment skipped: continue without posting a Daily Income payment. */
  onSkip: () => void;
  /** Lets the wizard Next button post the payment (or skip it when the amount is $0). */
  submitRef: MutableRefObject<(() => Promise<void>) | null>;
  /** Hide the payment fields and continue without posting a payment. */
  skipPayment?: boolean;
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
    refNumberMode: "system",
    description: "",
    invoiceNumber: invoice.invoiceNumber,
    invoiceReservation: invoice.reservation,
    autoGenerateInvoiceNumber: Boolean(invoice.autoGenerateNumber && !invoice.generatedInvoiceNumber),
    invoiceCost: Math.max(0, invoiceSubtotal),
    invoiceDiscount: discount,
    invoiceResponsibility: buildInvoiceResponsibilityInput(invoice),
    includeSender: Boolean(invoice.sender),
    senderId: invoice.sender?.id || undefined,
    senderName: invoice.sender?.name || undefined,
    includeReceiver: Boolean(invoice.receiver),
    receiverId: invoice.receiver?.id || undefined,
    receiverName: invoice.receiver?.name || undefined,
    ...buildInvoiceDailyIncomeAssigneeDefaults(invoice, routeNameById),
  };
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

export function InvoicePaymentTransactionForm({
  draftRef,
  statement,
  invoice,
  onRegistered,
  onSkip,
  submitRef,
  skipPayment = false,
}: Props) {
  const { t } = useTranslation();
  const { notifySuccess, notifyError } = useFeedback();
  const navigateOnEnter = useFormEnterNavigation({ advanceTextareas: true });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const responsibilityAction = useResponsibilityRequiredRecoveryAction(submitError);
  const responsibility = useResponsibilityAccess("INITIAL-PAYMENT");
  const { hasPermission } = useAuth();
  const employeesQuery = useEmployees({ page: 1, limit: 200, active: true, sort: "name:asc" }, {
    enabled: responsibility.canAssign && hasPermission(PERMISSIONS.employeesView.name, PERMISSIONS.employeesView.resourceType),
  });
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, isPaymentAccountsEnabled());
  const createJournal = useCreateDailyIncomeJournal();
  const paymentMethods = paymentMethodsQuery.data ?? EMPTY_PAYMENT_METHODS;
  const bankAccounts = bankAccountsQuery.data?.items ?? EMPTY_BANK_ACCOUNTS;
  const accounts = accountsQuery.data?.items ?? EMPTY_BANK_ACCOUNTS;
  const step1AssigneeSeed = useMemo(
    () => buildInvoiceDailyIncomeAssigneeDefaults(invoice),
    [invoice],
  );
  // The invoice party is a default; the collector remains independently editable.
  const pickupRoutesQuery = useActiveRoutePicker("pickup", 200, {
    enabled: responsibility.canAssign || Boolean(step1AssigneeSeed.routeId || responsibility.ownEmployee?.id),
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
        refNumberRequired: t("accounting.dailyIncome.form.validation.refNumberRequired"),
        descriptionTooLong: t("accounting.dailyIncome.form.validation.descriptionTooLong"),
        costPositive: t("accounting.dailyIncome.form.validation.costPositive"),
        discountNonNegative: t("accounting.dailyIncome.form.validation.discountNonNegative"),
        discountExceedsTotal: t("accounting.dailyIncome.form.validation.discountExceedsTotal"),
        discountExceedsBalance: t("accounting.dailyIncome.form.validation.discountExceedsBalance"),
        checkNumberRequired: t("accounting.dailyIncome.form.validation.checkNumberRequired"),
        bankAccountRequired: t("accounting.dailyIncome.form.validation.bankAccountRequired"),
        employeeRequired: t("accounting.dailyIncome.form.validation.employeeRequired"),
        invoiceRequired: t("accounting.dailyIncome.form.validation.invoiceRequired"),
        paymentMethodRequired: t("accounting.dailyIncome.form.validation.paymentMethodRequired"),
        amountExceedsCost: t("accounting.dailyIncome.form.validation.amountExceedsCost"),
        senderRequired: t("accounting.dailyIncome.form.validation.senderRequired"),
        receiverRequired: t("accounting.dailyIncome.form.validation.receiverRequired"),
        amountExceedsBalance: t("accounting.dailyIncome.form.validation.amountExceedsBalance"),
        invoicePaidOff: t("accounting.dailyIncome.form.validation.invoicePaidOff"),
        accountRequired: t("accounting.dailyIncome.form.validation.accountRequired"),
        sourceAccountRequired: t("accounting.dailyIncome.form.validation.sourceAccountRequired"),
        inventoryRequired: t("accounting.dailyIncome.form.validation.inventoryRequired"),
        inventoryItemRequired: t("accounting.dailyIncome.form.validation.inventoryItemRequired"),
        inventoryQuantityRequired: t("accounting.dailyIncome.form.validation.inventoryQuantityRequired"),
        inventoryPriceRequired: t("accounting.dailyIncome.form.validation.inventoryPriceRequired"),
        supplierRequired: t("accounting.dailyIncome.form.validation.supplierRequired"),
        supervisorRequired: t("accounting.dailyIncome.form.validation.supervisorRequired"),
        inventoryHoldersRequired: t("accounting.dailyIncome.form.validation.inventoryHoldersRequired"),
      }),
    [t],
  );

  const invoiceLineItemsTotal = useMemo(
    () => Math.max(0, invoice.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0)),
    [invoice.lineItems],
  );
  const invoiceDiscount = Number(invoice.discount) || 0;
  const invoiceRef = useRef(invoice);
  useEffect(() => {
    invoiceRef.current = invoice;
  }, [invoice]);

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
    subscribe,
    watch,
  } = useForm<DailyIncomeJournalValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValues,
  });
  const paymentAssigneeEdited = useRef(false);

  // Full reset only when the Cuadre statement changes — never wipe payment fields when
  // routes/payment methods finish loading or when translation identity changes.
  const paymentMethodsRef = useRef(paymentMethods);
  useEffect(() => {
    paymentMethodsRef.current = paymentMethods;
  }, [paymentMethods]);
  const routeNameByIdRef = useRef(routeNameById);
  useEffect(() => {
    routeNameByIdRef.current = routeNameById;
  }, [routeNameById]);

  useEffect(() => {
    const draft = draftRef.current;
    if (draft?.statementId === statement.id) {
      paymentAssigneeEdited.current = draft.assigneeEdited;
      reset(draft.values);
      return;
    }
    paymentAssigneeEdited.current = false;
    reset(
      withDefaultCashPaymentMethod(
        buildInitialValues(invoiceRef.current, routeNameByIdRef.current),
        paymentMethodsRef.current,
      ),
    );
  }, [draftRef, reset, statement.id]);

  useEffect(() => {
    const saveDraft = () => { draftRef.current = { statementId: statement.id, values: getValues(), assigneeEdited: paymentAssigneeEdited.current }; };
    const unsubscribe = subscribe({ formState: { values: true }, callback: saveDraft });
    return () => { saveDraft(); unsubscribe(); };
  }, [draftRef, getValues, statement.id, subscribe]);

  // Seed from the invoice once authorized; async directory results must not replace a chosen collector.
  useEffect(() => {
    if (!responsibility.ready || responsibility.canAssign && paymentAssigneeEdited.current) return;
    if (!responsibility.canAssign && paymentAssigneeEdited.current) {
      const selected = dailyRoutes.find((route) => route.id === getValues("routeId"));
      if (selected && canSelectResponsibleRoute(selected, false, responsibility.ownEmployee?.id)) return;
    }
    const assignee = responsibility.canAssign
      ? buildInvoiceDailyIncomeAssigneeDefaults(invoiceRef.current, routeNameById)
      : selfResponsibility();
    const sameRoute = Boolean(assignee.routeId) && getValues("routeId") === assignee.routeId;
    const chosenSupervisorId = sameRoute ? getValues("supervisorId") : undefined;
    const route = assignee.routeId ? dailyRoutes.find((item) => item.id === assignee.routeId) : undefined;
    // Payments on a route invoice are registered under the route supervisor, not the whole crew.
    const supervisor = !assignee.routeId
      ? null
      : route
        ? resolveDailyRouteSupervisor(route)
        : chosenSupervisorId
          ? { id: chosenSupervisorId, name: getValues("supervisorName") ?? "" }
          : null;
    setValue("assigneeSource", assignee.assigneeSource, { shouldValidate: false });
    setValue("employeeId", assignee.employeeId, { shouldValidate: false });
    setValue("employeeName", assignee.employeeName ?? "", { shouldValidate: false });
    setValue("routeId", assignee.routeId, { shouldValidate: false });
    setValue("routeName", assignee.routeName ?? "", { shouldValidate: false });
    setValue("routeCrewId", assignee.routeCrewId, { shouldValidate: false });
    setValue("routeCrewName", assignee.routeCrewName ?? "", { shouldValidate: false });
    setValue("supervisorId", supervisor?.id, { shouldValidate: false });
    setValue("supervisorName", supervisor?.name ?? "", { shouldValidate: false });
  }, [
    dailyRoutes,
    getValues,
    invoice.pickupEmployeeId,
    invoice.pickupEmployeeName,
    invoice.pickupSource,
    invoice.routeCrewId,
    invoice.routeCrewName,
    invoice.routeId,
    routeNameById,
    setValue,
    responsibility.ready,
    responsibility.canAssign,
    responsibility.ownEmployee?.id,
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
    setValue("autoGenerateInvoiceNumber", Boolean(invoice.autoGenerateNumber && !invoice.generatedInvoiceNumber));
  }, [invoice.invoiceNumber, invoice.autoGenerateNumber, invoice.generatedInvoiceNumber, invoiceDiscount, invoiceLineItemsTotal, setValue]);

  // Enrich route label once daily routes finish loading.
  useEffect(() => {
    const selectedRouteId = getValues("routeId")?.trim();
    if (!selectedRouteId) return;
    const route = dailyRoutes.find((item) => item.id === selectedRouteId);
    const nextName = route?.name.trim();
    if (!nextName || getValues("routeName")?.trim() === nextName) return;
    setValue("routeName", nextName, { shouldValidate: false });
  }, [dailyRoutes, getValues, setValue]);

  useEffect(() => {
    const description = t("invoices.wizard.dailyIncome.dialog.initialRegistrationDescription");
    if (getValues("description") === description) return;
    setValue("description", description, { shouldValidate: false });
  }, [getValues, setValue, t]);

  async function submit(values: DailyIncomeJournalValues) {
    try {
      setSubmitError(null);

      const assignedToRoute = Boolean(values.routeId?.trim());
      const amount = Number.isFinite(values.amount) ? Number(values.amount) : 0;
      const paymentDetailsRequired = amount > 0;
      const cash = findCashPaymentMethod(paymentMethods);
      // API requires paymentMethod.name for INITIAL-PAYMENT even when amount is $0.
      const paymentMethodId = paymentDetailsRequired
        ? values.paymentMethodId
        : cash?.id ?? values.paymentMethodId;
      const paymentMethodName = paymentDetailsRequired
        ? values.paymentMethodName
        : cash?.name ?? values.paymentMethodName ?? "CASH";

      const journal = await createJournal.mutateAsync({
        statement,
        values: {
          ...values,
          transactionType: "INITIAL-PAYMENT",
          amount,
          assigneeSource: assignedToRoute ? "route" : values.employeeId ? "employee" : "creator",
          employeeId: assignedToRoute ? undefined : values.employeeId,
          employeeName: assignedToRoute ? undefined : values.employeeName,
          routeId: assignedToRoute ? values.routeId : undefined,
          routeName: assignedToRoute ? values.routeName : undefined,
          routeCrewId: assignedToRoute ? values.routeCrewId : undefined,
          routeCrewName: assignedToRoute ? values.routeCrewName : undefined,
          supervisorId: assignedToRoute ? values.supervisorId : undefined,
          supervisorName: assignedToRoute ? values.supervisorName : undefined,
          invoiceNumber: invoice.invoiceNumber,
          invoiceReservation: invoice.reservation,
          autoGenerateInvoiceNumber: Boolean(invoice.autoGenerateNumber && !invoice.generatedInvoiceNumber),
          invoiceCost: invoiceLineItemsTotal,
          invoiceDiscount,
          invoiceResponsibility: buildInvoiceResponsibilityInput(invoice),
          includeSender: Boolean(invoice.sender),
          senderId: invoice.sender?.id,
          senderName: invoice.sender?.name,
          includeReceiver: Boolean(invoice.receiver),
          receiverId: invoice.receiver?.id,
          receiverName: invoice.receiver?.name,
          paymentMethodId,
          paymentMethodName,
          paymentAccountId: paymentDetailsRequired ? values.paymentAccountId : undefined,
          paymentAccountName: paymentDetailsRequired ? values.paymentAccountName : undefined,
          paymentAccountType: paymentDetailsRequired ? values.paymentAccountType : undefined,
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
              invoiceNumber: journal.invoice?.number || invoice.invoiceNumber,
              checkNumber: values.checkNumber?.trim() || "—",
            })
          : t("invoices.wizard.dailyIncome.paymentRecordedToast", {
              amount: formatInvoiceMoney(journal.amount),
              invoiceNumber: journal.invoice?.number || invoice.invoiceNumber,
            }),
      );
      await onRegistered(journal);
    } catch (error) {
      const message = normalizeDailyIncomeJournalError(error, {
        canManageEmployees: canOpenEmployeesDirectory(hasPermission),
      });
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

  const submittingRef = useRef(false);

  async function postPaymentOrSkip() {
    if (submittingRef.current || statement.status !== "OPEN" || !responsibility.ready) return;
    const amount = Number(getValues("amount"));
    if (skipPayment || !Number.isFinite(amount) || amount <= 0) {
      setSubmitError(null);
      onSkip();
      return;
    }
    submittingRef.current = true;
    try {
      await handleSubmit(submit, handleInvalid)();
    } finally {
      submittingRef.current = false;
    }
  }

  useEffect(() => {
    submitRef.current = postPaymentOrSkip;
  });

  useEffect(() => () => {
    submitRef.current = null;
  }, [submitRef]);

  return (
    <form
      className="space-y-3"
      onKeyDown={navigateOnEnter}
      onSubmit={(event) => {
        event.preventDefault();
        void postPaymentOrSkip();
      }}
    >
      {skipPayment ? null : (
        <>
          <p className="text-sm text-muted-foreground">{t("accounting.dailyIncome.form.hints.initialCollectorDefaults")}</p>
          <RegisterInvoiceTransactionFields
            grouped
            employees={employeesQuery.data?.items ?? []}
            dailyRoutes={dailyRoutes}
            statementBranchId={statement.branch?.id}
            accounts={accounts}
            bankAccounts={bankAccounts}
            paymentMethods={paymentMethods}
            errors={errors}
            register={register}
            setValue={(name, value, options) => {
              if (["assigneeSource", "employeeId", "routeId"].includes(name) && options?.shouldValidate) paymentAssigneeEdited.current = true;
              setValue(name, value, options);
            }}
            watch={watch}
            showEmployee
            allowDailyRoute
            showInvoiceNumber={false}
            showParties={false}
            invoiceCostReadOnly
            paymentSectionFirst
          />
        </>
      )}

      {createJournal.isPending ? (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("invoices.wizard.dailyIncome.dialog.registering")}
        </p>
      ) : submitError && !skipPayment ? (
        <FormFooterNoticeMessage tone="error" message={submitError} action={responsibilityAction} />
      ) : null}
    </form>
  );
}
