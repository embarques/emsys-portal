# API Query Usage

This guide shows how Next.js code should query the EMSYS API from this portal.

Use this document when adding list queries, detail queries, CRUD mutations, and advanced search endpoints.

## Core Rules

- All HTTP requests must go through `src/lib/api/client.ts`.
- Do not call `fetch()` directly from pages or components.
- Do not create feature-specific Axios instances.
- Do not manually attach auth headers in feature code.
- Server data belongs in TanStack Query, not Redux Toolkit.
- Feature API calls belong in `src/lib/<feature>/api/`.
- Feature query and mutation hooks belong in `src/lib/<feature>/hooks/`.
- Pages should compose hooks and components only.

The central Axios instance in `src/lib/api/axios.ts` attaches these headers automatically:

```txt
Authorization: Bearer <firebase-jwt-token>
x-company-id: <selected-company-id>
```

Feature code should only call `apiClient`. The token and company context are resolved centrally.

## Request Flow

```txt
Component
  -> feature hook in src/lib/<feature>/hooks/
  -> feature API function in src/lib/<feature>/api/
  -> apiClient from src/lib/api/client.ts
  -> axiosInstance from src/lib/api/axios.ts
  -> EMSYS API
```

## API Client

Use the shared client:

```ts
import { apiClient } from "@/lib/api/client";
```

Available methods:

```ts
apiClient.get<T>(url);
apiClient.post<T>(url, data);
apiClient.put<T>(url, data);
apiClient.patch<T>(url, data);
apiClient.delete<T>(url);
```

Use endpoint constants from `src/lib/api/endpoints.ts`:

```ts
import { API_ENDPOINTS } from "@/lib/api/endpoints";
```

Example:

```ts
apiClient.get(`${API_ENDPOINTS.CUSTOMERS}?${query}`);
```

## Paginated List Queries

List endpoints use query string parameters built with `URLSearchParams`.

Standard list query shape:

```txt
GET /customers?page=1&limit=40&offset=0&sort=name:asc
```

`page` is 1-based. `limit` is the page size. `offset` is the MongoDB skip value.

By default, the frontend calculates `offset` from `page` and `limit`.
If `offset` is provided explicitly, it overrides the calculated value.

Build pagination parameters like this:

```ts
const page = params.page ?? 1;
const limit = params.limit ?? 40;
const offset = params.offset ?? (page - 1) * limit;

const searchParams = new URLSearchParams({
  page: String(page),
  limit: String(limit),
  offset: String(offset),
  sort: params.sort ?? "name:asc",
});
```

Then call the endpoint through `apiClient`:

```ts
export async function fetchCustomers(params: CustomerListParams = {}) {
  const query = buildCustomersQuery(params);

  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}?${query}`);
}
```

## Field Search Queries

Simple list searches use these query string fields:

```txt
field=<api-field>
operator=<operator>
value=<search-value>
```

Example:

```txt
GET /customers?page=1&limit=40&offset=0&sort=name:asc&field=name&operator=startsWith&value=Acme
```

Construct it like this:

```ts
if (params.search?.value.trim()) {
  searchParams.set("field", params.search.field);
  searchParams.set("operator", params.search.operator);
  searchParams.set("value", params.search.value.trim());
}
```

Common operators:

```txt
eq
neq
contains
startsWith
```

Only use operators supported by the field. For example, boolean and numeric ID fields usually use `eq` or `neq`.

## Chip Filters

Chip filters should be represented as standard advanced-search filters when using POST `/search`.

Example customer filters:

```txt
GET /customers?page=1&limit=40&offset=0&sort=name:asc&active=true&branchId=1&customerType=1
```

Example construction:

```ts
if (params.active !== undefined && params.active !== "all") {
  searchParams.set("active", String(params.active));
}

if (params.branch !== undefined && params.branch !== "all") {
  searchParams.set("branchId", String(params.branch));
}

if (params.customerType !== undefined && params.customerType !== "all") {
  searchParams.set("customerType", String(params.customerType));
}
```

## Current List Examples

Customers:

```txt
GET /customers?page=1&limit=40&offset=0&sort=name:asc
GET /customers?page=1&limit=40&offset=0&sort=name:asc&field=name&operator=contains&value=Maria
GET /customers?page=1&limit=40&offset=0&sort=name:asc&active=true&branchId=1
```

Users:

```txt
GET /users?page=1&limit=40&offset=0&sort=userName:asc
GET /users?page=1&limit=40&offset=0&sort=userName:asc&field=userName&operator=startsWith&value=jdoe
GET /users?page=1&limit=40&offset=0&sort=userName:asc&active=true&branchId=1&roleId=1
```

Pickups:

```txt
GET /pickups?page=1&limit=40&offset=0
GET /pickups?page=1&limit=40&offset=0&field=completed&operator=eq&value=false
GET /pickups?page=1&limit=40&offset=0&branchId=1
```

## Advanced Search Endpoints

Use `POST /<resource>/search` when filters must be combined, nested AND/OR groups are needed, or nested fields are not reliable on the plain GET endpoint.

### Pickups — `POST /pickups/search`

Pagination goes in the **JSON body**. The body root is always a filter group with `operator`, `filters`, optional `pagination`, and optional `sort`.

```txt
POST /pickups/search
```

Body (advanced-search filters):

```json
{
  "operator": "and",
  "filters": [
    {
      "field": "sender.name",
      "operator": "contains",
      "value": "Maria"
    },
    {
      "field": "completed",
      "operator": "eq",
      "value": true
    }
  ],
  "pagination": { "page": 1, "offset": 0, "limit": 40 },
  "sort": [{ "field": "date", "direction": "asc" }]
}
```

Pending pickup stats example (purpose contains pickup, not completed):

```json
{
  "operator": "and",
  "filters": [
    { "field": "purpose", "operator": "contains", "value": "pickup" },
    { "field": "completed", "operator": "eq", "value": false }
  ],
  "pagination": { "page": 1, "offset": 0, "limit": 1 }
}
```

Build the body with the shared helper:

```ts
import { buildStripeStyleSearchBody } from "@/lib/api/search-query";

function buildPickupSearchBody(params: OrderListParams) {
  return buildStripeStyleSearchBody({
    page: params.page,
    limit: params.limit,
    offset: params.offset,
    sort: params.sort,
    filterGroups: buildOrderSearchFilterGroups(params),
  });
}
```

Call through `apiClient.post`:

```ts
export async function fetchOrders(params: OrderListParams = {}) {
  if (shouldUsePickupSearch(params)) {
    return apiClient.post(
      `${API_ENDPOINTS.PICKUPS}/search`,
      buildPickupSearchBody(params),
    );
  }

  const query = buildOrdersQuery(params);
  return apiClient.get(`${API_ENDPOINTS.PICKUPS}?${query}`);
}
```

Unfiltered list (no search bar, no filter rows):

```txt
GET /pickups?page=1&offset=0&limit=40
```

Filtered list, stat cards, and advanced filter panel all use `POST /pickups/search`.

Current pickup fields commonly used in search filters:

```txt
sender.name
sender.phone1
sender.oldID
sender.address.city
sender.address.state
sender.address.zipcode
receiver.name
receiver.phone1
receiver.oldID
purpose
sector.id
branch.id
employee.id
user.name
completed
date
createdAt
```

## CRUD Operations

All CRUD operations live in the feature API file.

Example customer CRUD functions:

```ts
export async function fetchCustomerById(customerId: string) {
  return apiClient.get(`${API_ENDPOINTS.CUSTOMERS}/${customerId}`);
}

export async function createCustomer(values: CustomerFormValues) {
  return apiClient.post(API_ENDPOINTS.CUSTOMERS, buildCustomerWritePayload(values));
}

export async function updateCustomer(customerId: string, values: CustomerFormValues) {
  return apiClient.put(
    `${API_ENDPOINTS.CUSTOMERS}/${customerId}`,
    buildCustomerWritePayload(values, { customerId }),
  );
}

export async function deleteCustomer(customerId: string) {
  return apiClient.delete(`${API_ENDPOINTS.CUSTOMERS}/${customerId}`);
}
```

CRUD endpoint shapes:

```txt
GET    /customers/:id
POST   /customers
PUT    /customers/:id
DELETE /customers/:id
```

Use the same shape for other feature endpoints:

```txt
GET    /users/:id
POST   /users
PUT    /users/:id
DELETE /users/:id

GET    /pickups/:id
POST   /pickups
PUT    /pickups/:id
DELETE /pickups/:id
```

## Mutation Envelopes

Mutation responses may include a `success`, `message`, `error`, and `data` envelope.

Check failed responses in the feature API file:

```ts
function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}
```

When a create or update endpoint returns only an ID, fetch the detail record before returning from the API function. Components should receive normalized feature data, not raw API envelopes.

## TanStack Query Hooks

Feature hooks wrap feature API functions.

List query:

```ts
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => fetchCustomers(params),
  });
}
```

Detail query:

```ts
export function useCustomer(customerId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.detail(customerId ?? ""),
    queryFn: () => fetchCustomerById(customerId!),
    enabled: enabled && Boolean(customerId),
  });
}
```

Create mutation:

```ts
export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: CustomerFormValues) => createCustomer(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  });
}
```

Update mutation:

```ts
export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ customerId, values }: { customerId: string; values: CustomerFormValues }) =>
      updateCustomer(customerId, values),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(variables.customerId),
      });
    },
  });
}
```

Delete mutation:

```ts
export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (customerId: string) => deleteCustomer(customerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.customers.all }),
  });
}
```

## Query Keys

Add query keys in `src/lib/query/query-keys.ts`.

Use separate keys for:

- all feature queries
- list queries
- search queries
- stats queries
- detail queries

Example:

```ts
customers: {
  all: ["customers"] as const,
  lists: () => [...queryKeys.customers.all, "list"] as const,
  list: (params: CustomerListParams) => [...queryKeys.customers.lists(), params] as const,
  search: (search: CustomerSearchFilter | undefined, limit: number) =>
    [...queryKeys.customers.all, "search", search, limit] as const,
  detail: (customerId: string) => [...queryKeys.customers.all, "detail", customerId] as const,
}
```

Mutations should invalidate the feature `all` key. Updates should also invalidate the affected detail key.

## Expected File Layout For A Feature

```txt
src/lib/<feature>/
├── api/
│   └── <feature>-api.ts
├── hooks/
│   └── use-<feature>.ts
├── schemas/
├── store/
├── types/
└── utils/
```

## Checklist For New API Work

- Add endpoint constants to `src/lib/api/endpoints.ts`.
- Add feature types in `src/lib/<feature>/types.ts`.
- Add API functions in `src/lib/<feature>/api/<feature>-api.ts`.
- Build query strings with `URLSearchParams`.
- Use `apiClient` for every request.
- Normalize API responses inside the feature API file.
- Add query keys in `src/lib/query/query-keys.ts`.
- Add TanStack Query hooks in `src/lib/<feature>/hooks/use-<feature>.ts`.
- Invalidate the correct query keys after mutations.
- Keep pages and components free of API calls.
