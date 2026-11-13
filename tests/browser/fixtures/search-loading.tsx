import {createRoot} from "react-dom/client";
import {useDeferredValue, useState} from "react";
import {QueryClient, QueryClientProvider, useQuery} from "@tanstack/react-query";
import {useDebouncedValue} from "@/hooks/use-debounced-value";
import {CatalogTableToolbar, CatalogDataTable} from "@/components/app-shell/catalog-table-toolbar";
import {TableSearchInput} from "@/components/app-shell/table-search-input";
import {useColumnVisibility} from "@/components/app-shell/use-column-visibility";
import {useCatalogTable} from "@/lib/table/hooks/use-catalog-table";
import type {CatalogPageParams} from "@/lib/api/fetch-catalog-page";
import type {PaginatedResult} from "@/lib/api/types";
import type {TableFilterFieldDefinition} from "@/lib/table/filter-builder";

type Row = {id: string; name: string};
const fields: TableFilterFieldDefinition[] = [{field: "name", label: "Name", operators: ["contains"], valueType: "text"}];
const columns = [{id: "name", label: "Name", renderCell: (row: Row) => row.name}];
const requests: {params: CatalogPageParams; resolve: (result: PaginatedResult<Row>) => void; reject: (error: Error) => void}[] = [];
Object.assign(window, {searchRequests: requests, visual: true, spanish: document.documentElement.lang === "es"});
const fetchPage = (params: CatalogPageParams) => new Promise<PaginatedResult<Row>>((resolve, reject) => requests.push({params, resolve, reject}));
function Fixture() {
  const state = useCatalogTable({fields, keyPrefix: "fixture", defaultSort: "name:asc", getRowId: row => row.id, queryKey: params => ["search-loading", params], fetchPage});
  const layout = useColumnVisibility("search-loading-fixture", columns);
  const mobile = document.documentElement.dataset.mobile === "true";
  return <main>
    <button onClick={() => {state.setRows([{id: "name-filter", field: "name", operator: "contains", value: "one", join: "and"}]); state.setOpen(true);}}>Apply advanced filter</button>
    <button onClick={() => requests.at(-1)?.resolve({items: [{id: "1", name: requests.at(-1)?.params.query || "Saved row"}], total: 1, page: 1, resultsPerPage: 50})}>Resolve request</button>
    <button onClick={() => requests.at(-1)?.reject(new Error("Search failed"))}>Reject request</button>
    {mobile ? <TableSearchInput value={state.query} onChange={state.setQuery} isLoading={state.isSearching} placeholder="Search" /> : <CatalogTableToolbar state={state} presetScope="search-loading" searchPlaceholder="Search" />}
    <CatalogDataTable state={state} columns={columns} columnLayout={layout} rowKey={row => row.id} emptyMessage="No rows" />
  </main>;
}
const client = new QueryClient({defaultOptions: {queries: {retry: false, refetchOnWindowFocus: false}}});
const timingRequests: string[] = [];
Object.assign(window, {timingRequests});
function TimingFixture() {
  const [value, setValue] = useState("");
  const deferred = useDeferredValue(value);
  const debounced = useDebouncedValue(value);
  const query = document.documentElement.dataset.timing === "before" ? deferred : debounced;
  useQuery({queryKey: ["timing", query], queryFn: async () => {timingRequests.push(query); return [];}});
  return <input aria-label="Timing search" value={value} onChange={event => setValue(event.target.value)} />;
}
createRoot(document.getElementById("root")!).render(<QueryClientProvider client={client}>{document.documentElement.dataset.timing ? <TimingFixture /> : <Fixture />}</QueryClientProvider>);
