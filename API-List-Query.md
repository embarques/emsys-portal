# API List Query Format

EMSYS list endpoints use a shared query string format.

## Parameters

| Param | Example | Description |
|-------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `40` | Page size |
| `sort` | `name` | Sort field (default direction) |
| `sort` | `name:asc` | Sort field + direction |
| `sort` | `name:asc,createdAt:desc` | Multiple sorts |
| `field` | `createdAt` | Filter field |
| `operator` | `eq` | Filter operator |
| `value` | `2026-06-01` | Filter value |

### Examples

```txt
GET /customers?page=1&limit=40&sort=name
GET /customers?page=1&limit=40&sort=name:asc
GET /customers?page=1&limit=40&sort=name:asc,createdAt:desc
GET /customers?field=createdAt&operator=eq&value=2026-06-01&page=1&limit=40&sort=createdAt:desc
```

## Portal implementation

Shared builder: `src/lib/api/list-query.ts`

```ts
import { buildApiListQuery } from "@/lib/api/list-query";

buildApiListQuery({
  page: 1,
  limit: 40,
  sort: "name:asc",
  // or multiple sorts:
  // sort: [{ field: "name", direction: "asc" }, { field: "createdAt", direction: "desc" }],
  // sort: "name:asc,createdAt:desc",
  filter: { field: "createdAt", operator: "eq", value: "2026-06-01" },
});
```

## Modules using this format

| Module | API file |
|--------|----------|
| Customers | `src/lib/customers/api/customers-api.ts` |
| Employees | `src/lib/employees/api/employees-api.ts` |
| Users | `src/lib/users/api/users-api.ts` |
| Branches | `src/lib/branches/api/branches-api.ts` |
| Orders (pickups) | `src/lib/orders/api/orders-api.ts` |

`ListParams` types use `sort?: ApiListSortInput` only.

Helpers in `list-query.ts`:

- `sortBy("name", "asc")` → `{ field: "name", direction: "asc" }`
- `sortFields(sortBy("name", "asc"), sortBy("createdAt", "desc"))` → multi-sort array
- `formatApiListSort(...)` → query string value

## Removed (legacy)

- `start` offset parameter
- `sortField` + `sortDirection` (replaced by `sort`)
- Duplicate chip params (`branchId`, `active`, etc.) — use `field` / `operator` / `value` instead
