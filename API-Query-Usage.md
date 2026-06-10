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
GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc
```

Use `page` and `limit` to compute `start`:

```ts
const page = params.page ?? 1;
const limit = params.limit ?? 40;

const searchParams = new URLSearchParams({
  page: String(page),
  start: String((page - 1) * limit),
  limit: String(limit),
  sortField: params.sortField ?? "name",
  sortDirection: params.sortDirection ?? "asc",
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
GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc&field=name&operator=startsWith&value=Acme
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

Chip filters can be represented as explicit query params and, when needed by the API, as a field/operator/value triplet.

Example customer filters:

```txt
GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc&active=true&branchId=1&customerType=1
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
GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc
GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc&field=name&operator=contains&value=Maria
GET /customers?page=1&start=0&limit=40&sortField=name&sortDirection=asc&active=true&branchId=1
```

Users:

```txt
GET /users?page=1&start=0&limit=40&sortField=userName&sortDirection=asc
GET /users?page=1&start=0&limit=40&sortField=userName&sortDirection=asc&field=userName&operator=startsWith&value=jdoe
GET /users?page=1&start=0&limit=40&sortField=userName&sortDirection=asc&active=true&branchId=1&roleId=1
```

Pickups:

```txt
GET /pickups?page=1&start=0&limit=40
GET /pickups?page=1&start=0&limit=40&field=completed&operator=eq&value=false
GET /pickups?page=1&start=0&limit=40&branchId=1
```

## Advanced Search Endpoints

Use advanced search endpoints when the API requires a request body, when multiple filters need to be combined, or when searching nested fields that are not reliable on the plain GET endpoint.

Advanced search shape:

```txt
POST /pickups/search
```

Body:

```json
{
  "page": 1,
  "start": 0,
  "limit": 40,
  "sortField": "date",
  "sortDirection": "asc",
  "query": {
    "and": [
      {
        "field": "sender.name",
        "operator": "contains",
        "value": "Maria"
      },
      {
        "field": "completed",
        "operator": "eq",
        "value": "false"
      },
      {
        "field": "branch.id",
        "operator": "eq",
        "value": "1"
      }
    ]
  }
}
```

Build the body in the feature API file:

```ts
function buildSearchBody(params: OrderListParams) {
  const page = params.page ?? 1;
  const limit = params.limit ?? 40;

  const body = {
    page,
    start: (page - 1) * limit,
    limit,
    sortField: params.sortField ?? "date",
    sortDirection: params.sortDirection ?? "asc",
  };

  const filters = buildSearchFilters(params);

  if (filters.length > 0) {
    return {
      ...body,
      query: { and: filters },
    };
  }

  return body;
}
```

Call the advanced endpoint through `apiClient.post`:

```ts
export async function fetchOrders(params: OrderListParams = {}) {
  if (shouldUsePickupSearch(params)) {
    return apiClient.post(`${API_ENDPOINTS.PICKUPS}/search`, buildSearchBody(params));
  }

  const query = buildOrdersQuery(params);
  return apiClient.get(`${API_ENDPOINTS.PICKUPS}?${query}`);
}
```

Current pickup fields that use `POST /pickups/search`:

```txt
sender.name
sender.phone1
sender.oldID
receiver.name
receiver.phone1
receiver.oldID
purpose
sector.id
branch.id
employee.id
user.id
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
