import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

const require = createRequire(import.meta.url);
const filename = "src/components/accounting/daily-income-transaction-form-workspace.tsx";
const source = ts.transpileModule(readFileSync(filename, "utf8"), {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

function fixture({ updateError } = {}) {
  const calls = [], closed = [], notices = [];
  const journal = {
    id: "journal-1", incomeStatementId: 42, version: 7,
    transactionType: "EXPENSE", transactionAmount: 25, description: "Original",
    reconciliationStatus: "OUTSTANDING", clearanceStatus: "NOT_REQUIRED",
    allowedActions: { edit: true },
  };
  const statement = { id: 42, status: "OPEN", currency: "USD", rate: 1, branch: { id: 2 } };
  const query = data => ({ data, isLoading: false, isError: false });
  const loadFeature = createPortalLoader({ apiClient: { put: async (url, body) => {
    calls.push({ url, body });
    if (updateError) throw updateError;
    return { success: true, data: journal };
  } } });
  const form = loadFeature("src/lib/accounting/daily-income/journal-form.ts");
  const api = loadFeature("src/lib/accounting/daily-income/api.ts");
  let wizard;
  const container = ({ children }) => children;
  const hooks = {
    useDailyIncomeJournal: () => query(journal),
    useIncomeStatementById: () => query(statement),
    useCurrentIncomeStatement: () => query(statement),
    useSessionDailyIncomeTransactions: () => [],
    useChartAccounts: () => query({ items: [] }),
    useAccountingPaymentMethods: () => query([]),
    useCreateDailyIncomeJournal: () => ({ isPending: false }),
    useUpdateDailyIncomeJournal: () => ({ isPending: false, mutateAsync: ({ id, statement, values, options }) => api.updateDailyIncomeJournal(id, statement, values, options) }),
  };
  const mocks = {
    "@/components/accounting/session-transactions-panel": { SessionTransactionsLayout: container },
    "@/components/accounting/add-transaction-wizard": { AddTransactionWizard: props => { wizard = props; return null; } },
    "@/components/forms/form-tab-shell": { FormTabShell: container },
    "@/components/app-shell/feedback-provider": { useFeedback: () => ({ notifySuccess: message => notices.push(message), notifyError: () => {} }) },
    "@/components/ui/button": { Button: container },
    "@/lib/accounting/daily-income/hooks": hooks,
    "@/lib/accounting/daily-income/journal-form": form,
    "@/lib/auth/hooks/use-auth": { useAuth: () => ({ hasPermission: () => true }) },
    "@/lib/employees/hooks/use-employees": { useEmployees: () => query({ items: [] }) },
    "@/lib/invoices/hooks/use-invoices": { useInvoices: () => query({ items: [] }) },
    "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes": { useDailyRoutePicker: () => query({ items: [] }) },
    "@/lib/layout/hooks/use-workspace-tabs": { useWorkspaceTabs: () => ({ closeFormTabAndReturn: id => closed.push(id) }), useUpdateWorkspaceTabLabel: () => () => {} },
    "@/lib/i18n": { useTranslation: () => ({ t: key => key }) },
  };
  const loaded = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) return loadFeature(`src/${name.slice(2)}.ts`);
    return require(name);
  }, loaded, loaded.exports);
  renderToStaticMarkup(React.createElement(loaded.exports.DailyIncomeTransactionFormWorkspace, { tabId: "edit-tab", mode: "edit", entityId: journal.id }));
  assert.ok(wizard, "eligible journal renders the existing editor");
  return { wizard, values: form.journalToFormValues(journal), calls, closed, notices };
}

test("desktop journal edits send the loaded version and retain explicit duplicate-payment consent", async () => {
  const { wizard, values, calls, closed } = fixture();
  await wizard.onSubmit({ ...values, description: "Corrected" }, { allowDuplicatePayment: true, expectedVersion: 99 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/journals/journal-1");
  assert.equal(calls[0].body.expectedVersion, 7);
  assert.equal(calls[0].body.description, "Corrected");
  assert.equal(calls[0].body.allowDuplicatePayment, true);
  assert.deepEqual(closed, ["edit-tab"]);
});

test("unchanged desktop journal saves close without sending an update", async () => {
  const { wizard, values, calls, closed, notices } = fixture();
  await wizard.onSubmit(values);
  assert.deepEqual(calls, []);
  assert.deepEqual(closed, ["edit-tab"]);
  assert.deepEqual(notices, ["common.form.noChanges"]);
});

test("a stale-version rejection preserves the editor and does not report a successful save", async () => {
  const conflict = Object.assign(new Error("Journal version changed"), { response: { status: 409, data: { message: "Journal version changed" } } });
  const { wizard, values, calls, closed, notices } = fixture({ updateError: conflict });
  await assert.rejects(wizard.onSubmit({ ...values, description: "Corrected" }), /Journal version changed/);
  assert.equal(calls[0].body.expectedVersion, 7);
  assert.deepEqual(closed, []);
  assert.deepEqual(notices, []);
});
