import {apiClient} from "@/lib/api/client";
import {API_ENDPOINTS} from "@/lib/api/endpoints";
import type {buildJournalSearchBody} from "./journal-search";
export type JournalCurrencySummary = {currency: string; income: number; expenses: number; net: number; count: number};
export type JournalSummaryInput = {ids: string[]} | {filters: ReturnType<typeof buildJournalSearchBody>["filters"]};
const endpoint = API_ENDPOINTS.ACCOUNTING_JOURNALS;
export async function fetchJournalSummary(input: JournalSummaryInput, signal?: AbortSignal) {
  const response = await apiClient.post<{data: JournalCurrencySummary[]}>(`${endpoint}/summary`, input, {signal});
  return response.data;
}
export async function reconcileJournals(input: {requestId: string; ids: string[]}) {
  return apiClient.post<{data: {reconciled: string[]; reconciledAt: string}}>(`${endpoint}/reconcile`, input);
}

export async function fetchOutstandingJournalCount(signal?: AbortSignal): Promise<number> {
 const response = await apiClient.post<{total: number}>(`${endpoint}/search`, {
  filters: [{field:"reconciliationStatus", operator:"eq", value:"OUTSTANDING"}],
  pagination: {page:1, limit:1}, sort:[{field:"createdAt",direction:"desc"}]
 }, {signal});
 return response.total;
}
