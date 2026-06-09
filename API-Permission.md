# API Permissions & Route Access

This guide explains how to add a new route to the portal so it is **visible in the sidebar** and **allowed when the user has the correct permission**.

---

## Overview

```txt
EMSYS API (role has permission)
        │
        ▼
permissions.ts          ← permission constant (name + resourceType)
        │
        ├── page-permissions.ts   ← route → permission (access control)
        └── navigation.ts         ← sidebar item (visibility)
        │
        ▼
app/(dashboard)/.../page.tsx      ← the page
```

| Layer | File | Purpose |
|-------|------|---------|
| API | EMSYS backend | Permission exists and is assigned to roles |
| Permission constant | `src/lib/auth/permissions.ts` | Portal permission definition |
| Route gate | `src/lib/auth/page-permissions.ts` | Block or allow route access |
| Sidebar | `src/config/navigation.ts` | Show or hide navigation link |
| Page | `src/app/(dashboard)/<route>/page.tsx` | Route UI |

**How enforcement works today**

- All `(dashboard)` routes go through `DashboardGuard` in the dashboard layout.
- Unauthenticated users are redirected to `/login`.
- Authenticated users without the required permission see **Access denied**.
- The sidebar filters links using the same permission checks.
- Protection is **client-side** (layout guard), not middleware.

---

## Step 1 — Confirm the API permission exists

Permissions are loaded from:

```txt
GET /users/permissions
```

The API must return entries like:

```json
{
  "name": "canViewWarehouse",
  "resourceType": "warehouse"
}
```

If this is a **new** permission:

1. Add it to the **EMSYS API** permission seed.
2. Assign it to the appropriate **roles** in the API or admin UI.

Until the API returns that permission for the user's role, the route will show **Access denied** even if the portal is wired correctly.

---

## Step 2 — Add the permission constant

**File:** `src/lib/auth/permissions.ts`

```ts
export const PERMISSIONS = {
  // ...existing
  warehousesView: { name: "canViewWarehouse", resourceType: "warehouse" },
} satisfies Record<string, Permission>;
```

Use the **exact** `name` and `resourceType` the API returns.

### Legacy / alternate API names

If the API uses a different permission name, add an alias in `PERMISSION_GRANT_ALIASES` in the same file:

```ts
const PERMISSION_GRANT_ALIASES: Record<string, readonly string[]> = {
  "warehouse:canviewwarehouse": ["warehouses:canviewwarehouses"],
};
```

See existing aliases in `permissions.ts` for examples (e.g. `canViewClient` → `canViewCustomer`).

---

## Step 3 — Map the route to the permission

**File:** `src/lib/auth/page-permissions.ts`

```ts
export const PAGE_PERMISSIONS: Record<string, Permission> = {
  // ...existing
  "/warehouses": PERMISSIONS.warehousesView,
};
```

`DashboardGuard` calls `permissionForPath(pathname)` on every dashboard navigation.

**Important:** If a route is **not** listed in `PAGE_PERMISSIONS`, it is **allowed by default** for any authenticated user. Always add new protected routes here.

Use the **exact path** (no query strings):

| URL | Key in `PAGE_PERMISSIONS` |
|-----|---------------------------|
| `/warehouses` | `"/warehouses"` |

---

## Step 4 — Add the sidebar link (visibility)

**File:** `src/config/navigation.ts`

```ts
{
  label: "Warehouses",
  href: "/warehouses",
  icon: Warehouse, // from lucide-react
  permission: PERMISSIONS.warehousesView,
},
```

`SidebarNav` hides items when `hasPermission()` returns false.

If you omit the `permission` field, the link is visible to **everyone** — avoid that for protected features.

---

## Step 5 — Create the page

**File:** `src/app/(dashboard)/warehouses/page.tsx`

```tsx
import { WarehousesWorkspace } from "@/components/warehouses/warehouses-workspace";

export default function WarehousesPage() {
  return <WarehousesWorkspace />;
}
```

Pages should stay thin. Do **not** put auth or permission logic in the page — the layout guard handles route access.

---

## Step 6 — Restart and verify

1. Restart the dev server if env or config changed.
2. Sign in as a user **with** the permission:
   - Sidebar link is visible.
   - Page loads normally.
3. Sign in as a user **without** the permission:
   - Sidebar link is hidden.
   - Direct URL shows **Access denied**.

---

## Checklist

| Step | File / system | Action |
|------|---------------|--------|
| 1 | EMSYS API | Permission exists and is on the role |
| 2 | `src/lib/auth/permissions.ts` | Add `PERMISSIONS.*` constant |
| 3 | `src/lib/auth/page-permissions.ts` | Map route path → permission |
| 4 | `src/config/navigation.ts` | Add nav item with `permission` |
| 5 | `src/app/(dashboard)/<route>/page.tsx` | Create the page |

---

## Reusing an existing permission

If the new route should use an permission that already exists in the API (e.g. trucks gated by pickup view), reuse an existing `PERMISSIONS.*` entry:

```ts
// page-permissions.ts
"/my-new-route": PERMISSIONS.trucksView,

// navigation.ts
permission: PERMISSIONS.trucksView,
```

No API changes needed if the role already has that permission.

---

## Optional — Guard part of a page or a button

Route-level protection is handled by `DashboardGuard`. For **in-page** controls (e.g. a Create button), use `PermissionGuard`:

```tsx
import { PermissionGuard } from "@/lib/auth/guards/permission-guard";
import { PERMISSIONS } from "@/lib/auth/permissions";

<PermissionGuard permission={PERMISSIONS.warehousesView}>
  <Button>Create warehouse</Button>
</PermissionGuard>
```

Or check in code:

```tsx
const { hasPermission } = useAuth();

if (hasPermission("canViewWarehouse", "warehouse")) {
  // show action
}
```

---

## Current route → permission map

| Route | Permission name | Resource type |
|-------|-----------------|---------------|
| `/` | `canViewSettings` | `settings` |
| `/customers` | `canViewCustomer` | `customer` |
| `/orders` | `canViewPickup` | `pickup` |
| `/invoices` | `canViewInvoice` | `invoice` |
| `/labels`, `/label-updater` | `canViewLabels` | `labels` |
| `/inventory` | `canViewDelivery` | `delivery` |
| `/items` | `canViewInvoice` | `invoice` |
| `/containers` | `canViewContainer` | `container` |
| `/routes`, `/trucks`, `/route-assignments` | `canViewPickup` | `pickup` |
| `/deliveries` | `canViewDelivery` | `delivery` |
| `/accounting` | `canViewIncomeStatement` | `income_statement` |
| `/reports`, `/analytics` | `canViewReport` | `report` |
| `/users`, `/roles`, `/security` | `canViewUser` | `user` |
| `/employees`, `/employee-groups` | `canViewEmployee` | `employee` |
| `/settings` | `canViewSettings` | `settings` |

Source of truth in code: `src/lib/auth/page-permissions.ts`.

---

## Common gotchas

1. **Permission name mismatch** — Portal `name` / `resourceType` must match the API. Inspect `GET /users/permissions` in the Network tab.
2. **Route missing from `PAGE_PERMISSIONS`** — Page is open to any logged-in user.
3. **Nav item missing `permission`** — Link visible to everyone.
4. **New permission, API not seeded** — Page always denied until the API grants it.
5. **Client-side only** — Direct API calls are still enforced by the backend; the portal guard is a UX layer.

---

## Short reference

```txt
API grants permission
  → permissions.ts
  → page-permissions.ts
  → navigation.ts
  → (dashboard)/<route>/page.tsx
```

That covers **visibility** (sidebar) and **access** (route guard).
