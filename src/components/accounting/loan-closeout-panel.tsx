"use client";

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useCreateIncomeStatement,
  useIncomeStatement,
  useSetIncomeStatementStatus,
} from "@/lib/accounting/daily-income/hooks";
import type { DailyIncomeStatement } from "@/lib/accounting/daily-income/types";
import { parseSingleOpenIncomeStatement } from "@/lib/accounting/daily-income/open-statement-error";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";

type LoanCloseoutPanelProps = {
  branchId?: number;
  branchCode?: string;
  branchName?: string;
  date: string;
  onReadyChange?: (ready: boolean) => void;
};

export function LoanCloseoutPanel({
  branchId = 0,
  branchCode = "",
  branchName = "",
  date,
  onReadyChange,
}: LoanCloseoutPanelProps) {
  const { t } = useTranslation();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [rate, setRate] = useState(1);
  const [localStatement, setLocalStatement] = useState<DailyIncomeStatement | null>(null);
  const [singleOpenStatement, setSingleOpenStatement] = useState<{ id: number; date: string } | null>(
    null,
  );
  const statementQuery = useIncomeStatement(branchId, date);
  const createStatement = useCreateIncomeStatement();
  const statusMutation = useSetIncomeStatementStatus();

  const statement = localStatement ?? statementQuery.data ?? null;
  const statementOpen = statement?.status === "OPEN";
  const ready = Boolean(branchId > 0 && date && statementOpen);
  const branchLabel =
    [branchCode, branchName].map((part) => part?.trim()).filter(Boolean).join(" — ") ||
    (branchId > 0 ? `#${branchId}` : t("accounting.loans.closeout.unknownBranch"));
  const showExchangeRate = currency.trim().toUpperCase() === "DOP";

  useEffect(() => {
    onReadyChange?.(ready);
  }, [onReadyChange, ready]);

  useEffect(() => {
    setStatusError(null);
    setSingleOpenStatement(null);
    setLocalStatement(null);
    setCurrency("USD");
    setRate(1);
  }, [branchId, date]);

  async function refreshStatus() {
    setStatusError(null);
    setLocalStatement(null);
    await statementQuery.refetch();
  }

  async function handleCreate() {
    if (!branchId || !date) return;
    try {
      setStatusError(null);
      setSingleOpenStatement(null);
      const created = await createStatement.mutateAsync({
        date: date.slice(0, 10),
        branchId,
        branchCode,
        branchName,
        currency,
        rate: showExchangeRate ? rate : 1,
      });
      setLocalStatement(created);
      await statementQuery.refetch();
    } catch (error) {
      const message = normalizeApiError(error).message;
      setStatusError(message);
      setSingleOpenStatement(parseSingleOpenIncomeStatement(message));
    }
  }

  async function reopenCloseout() {
    if (!statement) return;
    try {
      setStatusError(null);
      const reopened = await statusMutation.mutateAsync({ statement, open: true });
      setLocalStatement(reopened ?? { ...statement, status: "OPEN" });
      await statementQuery.refetch();
    } catch (error) {
      setStatusError(normalizeApiError(error).message);
    }
  }

  async function closeBlockingStatement() {
    if (!singleOpenStatement) return;
    try {
      setStatusError(null);
      await statusMutation.mutateAsync({
        statement: {
          id: singleOpenStatement.id,
          date: singleOpenStatement.date,
          status: "OPEN",
          branch: branchId
            ? { id: branchId, code: branchCode, name: branchName }
            : undefined,
          currency: "USD",
          rate: 1,
        },
        open: false,
      });
      setSingleOpenStatement(null);
    } catch (error) {
      const message = normalizeApiError(error).message;
      setStatusError(message);
      setSingleOpenStatement(parseSingleOpenIncomeStatement(message));
    }
  }

  if (!branchId || !date) {
    return (
      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground sm:col-span-2">
        {t("accounting.loans.closeout.selectAccountFirst")}
      </div>
    );
  }

  if (statementQuery.isLoading && !localStatement) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground sm:col-span-2">
        <Loader2 className="size-4 animate-spin" />
        {t("accounting.loans.closeout.checking")}
      </div>
    );
  }

  if (statementQuery.isError && !localStatement) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 sm:col-span-2">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-destructive">
              {t("accounting.loans.closeout.unableToCheck")}
            </p>
            <p className="text-sm text-muted-foreground">
              {normalizeApiError(statementQuery.error).message}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={refreshStatus}>
          <RefreshCw className="size-4" />
          {t("accounting.loans.closeout.refresh")}
        </Button>
      </div>
    );
  }

  if (statementOpen && statement) {
    return (
      <div className="rounded-lg border bg-card p-3 sm:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t("accounting.loans.closeout.openTitle")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("accounting.loans.closeout.openHint", {
                  id: statement.id,
                  branch: branchLabel,
                  date: statement.date || date,
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("accounting.loans.closeout.incomeStatement", { id: statement.id })}
                {" · "}
                {statement.date || date}
                {" · "}
                {branchLabel}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
            <RefreshCw className="size-4" />
            {t("accounting.loans.closeout.refresh")}
          </Button>
        </div>
      </div>
    );
  }

  if (statement?.status === "CLOSED") {
    return (
      <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30 sm:col-span-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {t("accounting.loans.closeout.noOpenTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("accounting.loans.closeout.closedStatement", {
                id: statement.id,
                branch: branchLabel,
                date: statement.date || date,
              })}
            </p>
            {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={reopenCloseout}
          disabled={statusMutation.isPending}
        >
          {statusMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          {t("accounting.loans.closeout.reopen")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/30 sm:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
            {t("accounting.loans.closeout.noOpenTitle")}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("accounting.loans.closeout.noStatement", { branch: branchLabel, date })}
          </p>
          <p className="text-sm text-muted-foreground">{t("accounting.loans.closeout.createHint")}</p>
          {statusError ? <p className="text-sm text-destructive">{statusError}</p> : null}
          {singleOpenStatement ? (
            <div className="space-y-2 pt-1">
              <p className="text-sm text-muted-foreground">
                {t("accounting.loans.closeout.singleOpenBlocking", {
                  id: singleOpenStatement.id,
                  date: singleOpenStatement.date,
                })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeBlockingStatement}
                disabled={statusMutation.isPending}
              >
                {statusMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("accounting.loans.closeout.closeOther")}
              </Button>
            </div>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={refreshStatus}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("accounting.dailyIncome.statement.fields.branch")}</Label>
          <Input value={branchLabel} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label>{t("accounting.dailyIncome.statement.fields.date")}</Label>
          <Input value={date} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label>{t("accounting.dailyIncome.statement.fields.currency")}</Label>
          <SearchableSelect
            value={currency}
            onValueChange={(next) => {
              setCurrency(next);
              if (next.trim().toUpperCase() !== "DOP") setRate(1);
            }}
            options={[
              { value: "USD", label: t("accounting.dailyIncome.currency.usd") },
              { value: "DOP", label: t("accounting.dailyIncome.currency.dop") },
            ]}
            searchable={false}
            mobileSheet
          />
        </div>
        {showExchangeRate ? (
          <div className="space-y-2">
            <Label htmlFor="loan-closeout-rate">
              {t("accounting.dailyIncome.statement.fields.exchangeRate")}
            </Label>
            <Input
              id="loan-closeout-rate"
              type="number"
              min={0}
              step="0.01"
              value={Number.isFinite(rate) ? rate : 0}
              onChange={(event) => setRate(Number(event.target.value))}
            />
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        size="sm"
        onClick={handleCreate}
        disabled={createStatement.isPending}
      >
        {createStatement.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {t("accounting.loans.closeout.create")}
      </Button>
    </div>
  );
}
