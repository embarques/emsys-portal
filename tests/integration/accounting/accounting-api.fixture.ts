import type { Page, Route } from "@playwright/test";

type Journal = {
  id: string;
  incomeStatementId: number;
  date: string;
  transactionType: string;
  amount: number;
  refNumber: string;
  description: string;
  employee?: { id: number; name: string };
  account?: { id: number; name: string; displayName: string };
  paymentMethod?: { id: number; name: string };
  accounts?: Array<{ id: number; name: string; type: string; debit: number; credit: number }>;
};

type Account = {
  id: number;
  name: string;
  displayName: string;
  type: string;
  description: string;
  branch?: { id: number; code: string; name: string };
  parentAccount?: { id: number; displayName: string };
  systemAccount?: boolean;
  branchAccount?: boolean;
};

const branch = { id: 1, code: "NY", name: "New York", type: "office" };

const employeesPayload = {
  data: [{ id: 1, name: "Hector Mejia", active: true, branch }],
  page: 1,
  resultsPerPage: 200,
  total: 1,
};

export async function installAccountingApi(page: Page) {
  let statementDate = "2026-06-20";
  let journals: Journal[] = [
    {
      id: "journal-1",
      incomeStatementId: 12,
      date: "2026-06-20",
      transactionType: "SALES",
      amount: 350,
      refNumber: "INC-1001",
      description: "Counter income",
      employee: { id: 1, name: "Hector Mejia" },
      account: { id: 101, name: "Sales", displayName: "Sales" },
      paymentMethod: { id: 1, name: "Cash" },
      accounts: [
        { id: 1, name: "CASH ON HAND", type: "ASSET", debit: 350, credit: 0 },
        { id: 101, name: "Sales", type: "REVENUE", debit: 0, credit: 350 },
      ],
    },
    {
      id: "journal-2",
      incomeStatementId: 12,
      date: "2026-06-20",
      transactionType: "EXPENSE",
      amount: 505.5,
      refNumber: "EXP-1001",
      description: "Operating expenses",
      employee: { id: 1, name: "Hector Mejia" },
      accounts: [
        { id: 201, name: "OPERATING EXPENSE", type: "EXPENSE", debit: 505.5, credit: 0 },
        { id: 1, name: "CASH ON HAND", type: "ASSET", debit: 0, credit: 505.5 },
      ],
    },
    {
      id: "journal-3",
      incomeStatementId: 12,
      date: "2026-06-20",
      transactionType: "PAYMENT",
      amount: 170,
      refNumber: "PAY-1001",
      description: "Invoice payment",
      employee: { id: 1, name: "Hector Mejia" },
      paymentMethod: { id: 1, name: "Cash" },
      accounts: [
        { id: 1, name: "CASH ON HAND", type: "ASSET", debit: 170, credit: 0 },
        { id: 2, name: "ACCOUNTS RECEIVABLE", type: "ASSET", debit: 0, credit: 170 },
      ],
    },
  ];

  let accounts: Account[] = [
    {
      id: 101,
      name: "Sales",
      displayName: "Sales",
      type: "REVENUE",
      description: "General sales income",
      branch,
      systemAccount: false,
      branchAccount: true,
    },
    {
      id: 102,
      name: "Cash",
      displayName: "Cash",
      type: "ASSET",
      description: "Cash on hand",
      branch,
      systemAccount: true,
      branchAccount: true,
    },
  ];

  await page.route("**/api/e2e/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/e2e/, "");
    const method = request.method();

    if (path === "/auth/token" && method === "POST") {
      return json(route, {
        data: {
          idToken: "playwright-id-token",
          email: "playwright@emsys.test",
          expiresIn: 3600,
        },
      });
    }

    if (path === "/users/permissions") {
      return json(route, {
        data: {
          role: { id: 1, name: "Administrator" },
          permissions: [
            { name: "canViewIncomeStatement", resourceType: "income_statement" },
            { name: "canViewChartAccount", resourceType: "chart_account" },
          ],
        },
      });
    }

    if (path === "/branches") {
      return json(route, { data: [branch], page: 1, resultsPerPage: 200, total: 1 });
    }

    if (path === "/employees" && method === "GET") {
      return json(route, employeesPayload);
    }

    if (path === "/employees/search" && method === "POST") {
      return json(route, employeesPayload);
    }

    if (path === "/invoices") {
      return json(route, {
        data: [{ id: "invoice-1", number: "INV-1001", date: "2026-06-20", sender: {}, receiver: {} }],
        page: 1,
        resultsPerPage: 200,
        total: 1,
      });
    }

    if (path === "/income-statements/search" && method === "POST") {
      const body = request.postDataJSON() as { filters?: Array<{ field: string; value: unknown }> };
      const requestedDate = String(body.filters?.find((filter) => filter.field === "date")?.value ?? "");
      const matches = requestedDate === statementDate;
      return json(route, {
        data: matches ? [{ id: 12, date: `${statementDate}T00:00:00Z`, status: "OPEN", branch, currency: "USD", rate: 1 }] : [],
        page: 1,
        resultsPerPage: 1,
        total: matches ? 1 : 0,
      });
    }

    if (path === "/income-statements" && method === "POST") {
      const body = request.postDataJSON() as { date: string; branch: typeof branch; currency: string; rate: number };
      statementDate = body.date.slice(0, 10);
      return json(route, { success: true, data: { id: 12, ...body, status: "OPEN" } }, 201);
    }

    if (path === "/journals/search" && method === "POST") {
      return json(route, {
        data: journals,
        page: 1,
        resultsPerPage: 20,
        total: journals.length,
      });
    }

    if (path === "/journals" && method === "POST") {
      const body = request.postDataJSON() as Journal;
      const created = { ...body, id: `journal-${journals.length + 1}` };
      journals = [created, ...journals];
      return json(route, { success: true, data: created }, 201);
    }

    const journalId = path.match(/^\/journals\/(.+)$/)?.[1];
    if (journalId && method === "PUT") {
      const body = request.postDataJSON() as Journal;
      journals = journals.map((journal) => journal.id === journalId ? { ...journal, ...body, id: journalId } : journal);
      return json(route, { success: true, response: [journals.find((journal) => journal.id === journalId)] });
    }
    if (journalId && method === "DELETE") {
      const deleted = journals.find((journal) => journal.id === journalId);
      journals = journals.filter((journal) => journal.id !== journalId);
      return json(route, { success: true, response: [deleted] });
    }

    if (path === "/accounting/accounts" && method === "GET") {
      return json(route, { response: accounts, page: 1, resultsPerPage: 500, total: accounts.length });
    }

    if (path === "/accounting/account" && method === "POST") {
      const body = request.postDataJSON() as Account;
      const created = { ...body, id: Math.max(...accounts.map((account) => account.id)) + 1 };
      accounts = [created, ...accounts];
      return json(route, { success: true, response: [created] });
    }

    const accountId = Number(path.match(/^\/accounting\/account\/(\d+)$/)?.[1]);
    if (accountId && method === "PUT") {
      const body = request.postDataJSON() as Account;
      accounts = accounts.map((account) => account.id === accountId ? { ...account, ...body, id: accountId } : account);
      return json(route, { success: true, response: [accounts.find((account) => account.id === accountId)] });
    }
    if (accountId && method === "DELETE") {
      const deleted = accounts.find((account) => account.id === accountId);
      accounts = accounts.filter((account) => account.id !== accountId);
      return json(route, { success: true, response: [deleted] });
    }

    return json(route, { data: [], page: 1, resultsPerPage: 20, total: 0 });
  });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}
