import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider, useMutationState } from "@tanstack/react-query";
import ts from "typescript";

const output = ts.transpileModule(fs.readFileSync("src/lib/accounting/daily-income/hooks.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("require", "exports", output)((name) => {
 if (name === "@tanstack/react-query") return { useMutationState };
 if (name === "@/lib/auth/hooks/use-auth") return { useAuth: () => ({ companyId: "company-a", user: { uid: "user-a" } }) };
 return {};
}, module.exports);

test("session panel includes only successful entries for this user, company and closeout", async () => {
 const client = new QueryClient();
 const cache = client.getMutationCache();
 async function save(company, user, statementId, id, failed = false, sessionId) {
  const mutation = cache.build(client, { mutationKey: ["daily-income-created", company, user, ...(sessionId ? [sessionId] : [])], gcTime: Infinity, retry: false, mutationFn: async () => { if (failed) throw new Error("Rejected save"); return { id }; } });
  await mutation.execute({ statement: { id: statementId }, values: { transactionType: "INITIAL-PAYMENT" } }).catch(() => {});
 }
 await save("company-a", "user-a", 1, "saved");
 await save("company-a", "user-a", 1, "failed", true);
 await save("company-a", "user-b", 1, "other-user");
 await save("company-b", "user-a", 1, "other-company");
 await save("company-a", "user-a", 2, "other-closeout");
 await save("company-a", "user-a", 1, "old-wizard", false, "wizard-a");
 await save("company-a", "user-a", 1, "new-wizard", false, "wizard-b");
 let result;
 let sessionId;
 function Probe() { result = module.exports.useSessionDailyIncomeTransactions(1, sessionId); return null; }
 renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
 assert.deepEqual(result.map(entry => entry.journal.id), ["saved"]);
 sessionId = "wizard-b";
 renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
 assert.deepEqual(result.map(entry => entry.journal.id), ["new-wizard"]);
 sessionId = "fresh-wizard";
 renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(Probe)));
 assert.deepEqual(result, []);
 client.clear();
});
