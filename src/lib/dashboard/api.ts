import type { PaginatedResult } from "@/lib/api/types";
import { fetchCustomers } from "@/lib/customers/api/customers-api";
import { DEFAULT_CUSTOMER_LIST_PARAMS } from "@/lib/customers/types";
import { countByMonth, countByWeekday } from "@/lib/dashboard/histogram";
import type {
  AppointmentDashboardMetrics,
  ClientDashboardMetrics,
  InvoiceDashboardMetrics,
} from "@/lib/dashboard/types";
import { fetchInvoices } from "@/lib/invoices/api/invoices-api";
import { DEFAULT_INVOICE_LIST_PARAMS } from "@/lib/invoices/types";
import { fetchOrders } from "@/lib/orders/api/orders-api";
import { DEFAULT_ORDER_LIST_PARAMS } from "@/lib/orders/types";

/**
 * The EMSYS API has no weekday/month histogram endpoint, so all-time charts
 * page through list APIs and bucket dates in the portal.
 */
const PAGE_LIMIT = 200;
const MAX_PAGES = 100;
const PAGE_CONCURRENCY = 4;
const PAGE_RETRY_ATTEMPTS = 3;

type ScanResult = {
  scanned: number;
  total: number;
  truncated: boolean;
};

async function wait(ms: number) {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchPageWithRetry<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResult<T>>,
  page: number,
  limit: number,
): Promise<PaginatedResult<T>> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PAGE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchPage(page, limit);
    } catch (error) {
      lastError = error;
      if (attempt === PAGE_RETRY_ATTEMPTS) break;
      await wait(400 * attempt);
    }
  }

  throw lastError;
}

async function scanAllPages<T>(
  fetchPage: (page: number, limit: number) => Promise<PaginatedResult<T>>,
  visit: (item: T) => void,
): Promise<ScanResult> {
  const first = await fetchPageWithRetry(fetchPage, 1, PAGE_LIMIT);
  let scanned = 0;

  for (const item of first.items) {
    visit(item);
    scanned += 1;
  }

  const total = first.total;
  if (first.items.length === 0 || total <= scanned) {
    return { scanned, total, truncated: false };
  }

  const neededPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const pagesToFetch = Math.min(MAX_PAGES, neededPages);
  const remainingPages = Array.from({ length: pagesToFetch - 1 }, (_, index) => index + 2);

  for (let index = 0; index < remainingPages.length; index += PAGE_CONCURRENCY) {
    const batch = remainingPages.slice(index, index + PAGE_CONCURRENCY);
    const pages = await Promise.all(
      batch.map((page) => fetchPageWithRetry(fetchPage, page, PAGE_LIMIT)),
    );

    for (const page of pages) {
      for (const item of page.items) {
        visit(item);
        scanned += 1;
      }
    }
  }

  return {
    scanned,
    total,
    truncated: neededPages > MAX_PAGES,
  };
}

export async function fetchAppointmentDashboardMetrics(): Promise<AppointmentDashboardMetrics> {
  const createdAt: string[] = [];
  const scheduledDate: string[] = [];

  const scan = await scanAllPages(
    (page, limit) =>
      fetchOrders({
        page,
        limit,
        sort: DEFAULT_ORDER_LIST_PARAMS.sort,
      }),
    (order) => {
      createdAt.push(order.createdAt);
      scheduledDate.push(order.date);
    },
  );

  return {
    createdByWeekday: countByWeekday(createdAt),
    scheduledByWeekday: countByWeekday(scheduledDate),
    scheduledByMonth: countByMonth(scheduledDate),
    ...scan,
  };
}

export async function fetchClientDashboardMetrics(): Promise<ClientDashboardMetrics> {
  const createdAt: string[] = [];

  const scan = await scanAllPages(
    (page, limit) =>
      fetchCustomers({
        page,
        limit,
        sort: DEFAULT_CUSTOMER_LIST_PARAMS.sort,
      }),
    (customer) => {
      createdAt.push(customer.createdAt);
    },
  );

  return {
    createdByWeekday: countByWeekday(createdAt),
    createdByMonth: countByMonth(createdAt),
    ...scan,
  };
}

export async function fetchInvoiceDashboardMetrics(): Promise<InvoiceDashboardMetrics> {
  const createdAt: string[] = [];

  const scan = await scanAllPages(
    (page, limit) =>
      fetchInvoices({
        page,
        limit,
        sort: DEFAULT_INVOICE_LIST_PARAMS.sort,
      }),
    (invoice) => {
      createdAt.push(invoice.createdAt);
    },
  );

  return {
    createdByWeekday: countByWeekday(createdAt),
    createdByMonth: countByMonth(createdAt),
    ...scan,
  };
}
