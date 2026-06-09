# EMSYS PORTAL Frontend Architecture Standards

## Purpose

This document defines the official frontend architecture rules for EMSYS.

These rules are intended for:

- Cursor
- Codex
- ChatGPT
- Claude
- GitHub Copilot
- Human Developers

All agents and developers must follow this file when creating or modifying code.

---

# EMSYS Frontend Technology Stack

## Framework

- **Next.js 16**
  - React framework used for routing, layouts, SSR, SSG, middleware, and application structure.

- **React 19**
  - Core UI library used to build the application.

- **TypeScript**
  - Static typing, safer refactoring, better tooling, and improved maintainability.

---

## UI & Styling

- **Tailwind CSS**
  - Utility-first CSS framework used for styling.

- **shadcn/ui**
  - Primary application component library.

- **Radix UI**
  - Accessible UI primitives used by shadcn/ui.

- **Lucide React**
  - Application icon library.

- **class-variance-authority (CVA)**
  - Standardized component variants.

- **clsx**
  - Conditional class name management.

- **tailwind-merge**
  - Safe Tailwind class merging.

- **next-themes**
  - Theme management for light, dark, and system modes.

---

## State Management

- **TanStack Query**
  - Manages all server state.
  - Handles API requests, caching, pagination, mutations, loading states, retries, invalidation, and refetching.

- **Redux Toolkit**
  - Manages global client-side application state.
  - Stores authenticated user session metadata, selected company, selected branch, tenant context, roles, permissions, layout state, and application settings.

- **React useState**
  - Used only for local component state.

---

## Forms & Validation

- **React Hook Form**
  - Handles all form state and form submission.

- **Zod**
  - Handles all validation schemas.

---

## Authentication

- **Firebase Authentication**
  - Identity provider.
  - Used for login, logout, password reset, user authentication, and Firebase JWT token management.

Firebase answers:

```txt
Who is the user?
```

---

## Authorization

- **EMSYS API**
  - Authorization provider.
  - Source of truth for user access.

EMSYS API owns:

- Roles
- Permissions
- Company access
- Branch access
- Tenant access
- User profile metadata
- Feature access

EMSYS API answers:

```txt
What is the user allowed to do?
```

---

# Required Application Request Model

Every authenticated request sent to EMSYS API must include:

```txt
Authorization: Bearer <firebase-jwt-token>
x-company-id: <selected-company-id>
```

The selected company is stored in Redux Toolkit.

The Firebase JWT token is retrieved from Firebase Authentication.

The EMSYS API uses both headers to determine:

- Authenticated user
- Company context
- Tenant context
- Branch access
- Roles
- Permissions
- Feature access

---

# Core Architecture Rules

## Rule 1

Server state and client state are separate concerns.

## Rule 2

Never store API data in Redux Toolkit.

## Rule 3

Never place business logic inside pages.

## Rule 4

Features own their code.

## Rule 5

Authentication logic belongs inside `src/lib/auth`.

## Rule 6

Authorization data comes from EMSYS API.

## Rule 7

All HTTP communication goes through the central Axios client.

## Rule 8

Every EMSYS API request must include the Firebase JWT token and `x-company-id`.

## Rule 9

Reusable UI belongs in `src/components`.

## Rule 10

Feature-specific code belongs in the feature folder.

---

# Application Folder Structure

```txt
src/

├── app/
├── components/
├── config/
├── constants/
├── hooks/
├── lib/
├── providers/
├── styles/
├── types/
└── middleware.ts
```

---

# App Router Structure

Keep the existing dashboard route layout.

Do not move existing dashboard pages unless explicitly requested.

```txt
src/app/

├── (dashboard)/
│   ├── accounting/
│   ├── analytics/
│   ├── containers/
│   ├── customers/
│   ├── deliveries/
│   ├── employee-groups/
│   ├── employees/
│   ├── inventory/
│   ├── invoices/
│   ├── items/
│   ├── labels/
│   ├── orders/
│   ├── reports/
│   ├── roles/
│   ├── routes/
│   ├── security/
│   ├── settings/
│   ├── trucks/
│   └── users/
│
├── globals.css
└── layout.tsx
```

Pages should compose components and hooks.

Pages should not contain:

- API calls
- Business logic
- Firebase initialization
- Axios configuration
- Authorization logic
- Large form logic

---

# Authentication Architecture

Authentication is a first-class feature.

Location:

```txt
src/lib/auth/
```

Required structure:

```txt
src/lib/auth/

├── firebase/
│   ├── firebaseConfig.ts
│   ├── firebase.ts
│   └── firebaseUserProfile.ts
│
├── api/
├── guards/
├── hooks/
├── store/
├── types/
└── utils/
```

---

## Firebase Files

### firebaseConfig.ts

Responsibilities:

- Initialize Firebase
- Initialize Firebase Auth
- Initialize Firestore only if needed
- Use environment variables
- Use singleton pattern
- Prevent server-side Firebase client initialization

This file owns:

```txt
initializeApp()
getApps()
getAuth()
getFirestore()
```

Rules:

- Firebase client initialization must be browser-safe.
- Do not initialize Firebase client SDK on the server.
- Do not duplicate Firebase app instances.
- Do not place Firebase config in components or pages.

---

### firebase.ts

Responsibilities:

- Login
- Logout
- Password reset
- Current Firebase user
- Firebase JWT token retrieval
- Firebase token refresh

Examples:

```txt
signIn()
signOut()
resetPassword()
getCurrentUser()
getToken()
refreshToken()
```

Rules:

- This file only handles Firebase Authentication behavior.
- This file does not own EMSYS roles or permissions.
- This file does not own company or branch authorization.

---

### firebaseUserProfile.ts

Responsibilities:

- Current Firebase user identity
- Firebase UID
- Email
- Display name
- Photo URL if used

Not responsible for:

- Roles
- Permissions
- Company access
- Branch access
- Tenant access
- Feature access

Those values come from EMSYS API.

---

# Firestore Rule

Firestore is not the source of truth for authorization.

Firestore may only be used for minimal Firebase-related user profile data if needed.

Firestore must not own:

- Roles
- Permissions
- Company
- Branch
- Tenant
- Feature access

Authorization belongs to EMSYS API.

---

# Authentication and Authorization Flow

```txt
User Login
     │
     ▼
Firebase Authentication
     │
     ▼
Get Firebase JWT Token
     │
     ▼
Select Company
     │
     ▼
Store Selected Company In Redux Toolkit
     │
     ▼
Send Request To EMSYS API
     │
     ├── Authorization: Bearer <firebase-jwt-token>
     │
     └── x-company-id: <selected-company-id>
     │
     ▼
EMSYS API Validates Firebase Token
     │
     ▼
EMSYS API Loads User Profile
     │
     ▼
EMSYS API Loads Roles
     │
     ▼
EMSYS API Loads Permissions
     │
     ▼
EMSYS API Loads Company Access
     │
     ▼
Frontend Stores Session Metadata
     │
     ▼
Redux Toolkit
```

---

# Route Guards

Location:

```txt
src/lib/auth/guards/
```

Required files:

```txt
auth-guard.tsx
role-guard.tsx
permission-guard.tsx
```

Responsibilities:

- Protect pages
- Protect layouts
- Protect components
- Protect feature access
- Redirect unauthenticated users
- Hide or block unauthorized features

Rules:

- Do not implement authorization logic inside pages.
- Do not duplicate permission checks across components.
- Use shared guard components or shared permission utilities.

---

# API Architecture

All HTTP requests must go through:

```txt
src/lib/api/
```

Required structure:

```txt
src/lib/api/

├── axios.ts
├── client.ts
└── endpoints.ts
```

---

## axios.ts

Responsibilities:

- Create the central Axios instance
- Attach Firebase JWT token
- Attach `x-company-id`
- Handle 401 responses
- Handle 403 responses
- Normalize errors
- Support token refresh
- Keep request behavior consistent

Required headers for EMSYS API:

```txt
Authorization: Bearer <firebase-jwt-token>
x-company-id: <selected-company-id>
```

Rules:

- No component may call `fetch()` directly.
- No component may create its own Axios instance.
- No feature may create its own Axios instance.
- No page may manually attach auth headers.
- Headers must be added centrally.

---

## client.ts

Responsibilities:

- Export reusable API helper methods if needed.
- Wrap Axios if a clean API client abstraction is desired.
- Keep feature API files simple.

---

## endpoints.ts

Responsibilities:

- Centralize API endpoint constants.
- Prevent hardcoded endpoint strings across the application.

Example:

```txt
CUSTOMERS
ORDERS
INVOICES
REPORTS
AUTH_PROFILE
```

---

# State Management Rules

## TanStack Query

Use TanStack Query for all server state and API data.

Examples:

- Customers
- Orders
- Invoices
- Employees
- Containers
- Routes
- Trucks
- Reports
- Dashboard data
- Analytics data
- Roles from EMSYS API
- Permissions from EMSYS API
- Company access from EMSYS API
- Inventory
- Labels

TanStack Query owns:

- Queries
- Mutations
- Caching
- Pagination
- Infinite scroll
- Optimistic updates
- Loading states
- Error states
- Background refetching
- Cache invalidation

Rules:

- Never store API response data in Redux Toolkit.
- Never duplicate TanStack Query server data in Redux Toolkit.
- Every server request must use a feature hook backed by TanStack Query.
- Mutations must invalidate the correct query keys.

---

## Redux Toolkit

Use Redux Toolkit for global client-side application state.

Allowed in Redux:

- Firebase user identity
- User session metadata
- Selected company
- Selected branch
- Tenant context
- Current roles after loading from EMSYS API
- Current permissions after loading from EMSYS API
- Sidebar state
- Navigation state
- Theme
- Language
- Application settings
- Persistent filters when needed across pages

Never store in Redux:

- Customer lists
- Order lists
- Invoice lists
- Employee lists
- Report data
- Dashboard data
- API response collections
- Pagination results from API
- Mutation response payloads unless they are true session metadata

Rules:

- Redux is for global client state.
- TanStack Query is for server state.
- Do not use Redux as an API cache.
- Do not introduce RTK Query if TanStack Query is being used.

---

## React Hook Form

Use React Hook Form for all form state.

Examples:

- Customer form
- Order form
- Invoice form
- User form
- Role form
- Settings form

Rules:

- Never store form state in Redux.
- Do not manage large forms with useState.
- Use Zod for validation.

---

## Zod

Use Zod for validation.

Examples:

- Form validation
- Request validation
- Business rule validation
- Data shape validation where needed

Schema location:

```txt
src/lib/<feature>/schemas/
```

Example:

```txt
src/lib/customers/schemas/customer.schema.ts
```

---

## useState

Use React `useState` only for local component state.

Allowed examples:

- Modal open or closed
- Active tab
- Dropdown open or closed
- Accordion state
- Tooltip state
- Local UI selection that does not need to survive navigation

Rules:

- Do not use Redux for component-only state.
- Do not use Context API as a global state management solution.

---

# Query Layer

Location:

```txt
src/lib/query/
```

Required structure:

```txt
src/lib/query/

├── query-client.ts
├── query-provider.tsx
└── query-keys.ts
```

---

# Redux Layer

Location:

```txt
src/lib/store/
```

Required structure:

```txt
src/lib/store/

├── store.ts
├── hooks.ts
├── root-reducer.ts
│
├── auth/
├── company/
├── branch/
├── permissions/
├── layout/
└── settings/
```

---

# Providers

Location:

```txt
src/providers/
```

Required structure:

```txt
src/providers/

├── app-provider.tsx
├── auth-provider.tsx
├── query-provider.tsx
├── redux-provider.tsx
└── theme-provider.tsx
```

Recommended provider order:

```tsx
<QueryProvider>
  <ReduxProvider>
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  </ReduxProvider>
</QueryProvider>
```

---

# Business Feature Architecture

Every business module belongs under:

```txt
src/lib/<feature>/
```

Examples:

```txt
src/lib/customers/
src/lib/orders/
src/lib/invoices/
src/lib/routes/
src/lib/trucks/
src/lib/users/
src/lib/employees/
src/lib/reports/
src/lib/accounting/
```

---

## Standard Feature Structure

Every feature should follow this structure:

```txt
src/lib/<feature>/

├── api/
├── hooks/
├── schemas/
├── store/
├── types/
└── utils/
```

---

# Components

Location:

```txt
src/components/
```

Contains reusable UI only.

Rules:

- No API calls.
- No business logic.
- No direct Firebase usage.
- Components should be reusable.

---

# Naming Standards

## Files

Use kebab-case.

Examples:

```txt
customer-form.tsx
customer-table.tsx
use-customers.ts
customer.schema.ts
```

## Components

Use PascalCase.

Examples:

```txt
CustomerForm
CustomerTable
InvoiceSummary
```

## Hooks

Use `use-` file names and `useXxx` function names.

Examples:

```txt
use-customers.ts
useCustomers()
```

---

# Golden Rule

Before creating state, ask:

```txt
Does this come from an API?
```

If yes:

```txt
TanStack Query
```

If no, ask:

```txt
Does multiple pages or many components need it?
```

If yes:

```txt
Redux Toolkit
```

If no:

```txt
useState
```

---

# Final Summary

```txt
Firebase Authentication
  = Identity Provider

EMSYS API
  = Authorization Provider

Authorization Header
  = Firebase JWT Token

x-company-id Header
  = Active Company Context

TanStack Query
  = Server State

Redux Toolkit
  = Global Client State

React Hook Form
  = Form State

Zod
  = Validation

Axios
  = HTTP Client

shadcn/ui + Radix UI
  = UI Components

Tailwind CSS
  = Styling
```

---

# AI Agent Rules

When modifying the project:

1. Follow this architecture.
2. Do not introduce new state management libraries.
3. Do not use RTK Query.
4. Do not use SWR.
5. Do not use Context API as global state management.
6. Do not put API data in Redux.
7. Do not put API calls in components.
8. Do not put Firebase logic in pages.
9. Do not put authorization logic in pages.
10. Do not create feature logic outside the feature folder.
11. Always use the central Axios client.
12. Always include Firebase JWT token for EMSYS API requests.
13. Always include `x-company-id` for EMSYS API requests.
14. Keep dashboard routes as they are unless explicitly requested.
15. Preserve the existing application layout and UI behavior unless explicitly asked to change it.
