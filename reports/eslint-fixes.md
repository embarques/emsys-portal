# ESLint report triage: emsys-portal

## Completion status — 2026-11-04

Implemented the actionable fixes in sections 1 and 2. Kept the intentional
patterns in section 3, with explanatory suppressions for customer-form resets,
table auto-fit dependencies, the wizard reset, and local photo previews.
`set-state-in-effect` remains a warning. Underscore-prefixed unused arguments and
variables are explicitly ignored. ESLint now also ignores `.next-playwright`, the
generated build directory configured in `playwright.config.ts`.

- Source warnings: **161 → 87**, with **0 errors**. No remaining source
  `exhaustive-deps`, unused-variable, or missing combobox-attribute warnings.
- Full `npm run lint`: **0 errors, 94 warnings** (87 source warnings and seven
  existing warnings in configuration, probe scripts, and a browser fixture).
- `npx tsc --noEmit`, `npm run build`, and `git diff --check`: passed.
- `npm run test:unit`: **432 passed**.
- Browser fixtures: **91 cases exercised** across form Enter navigation,
  searchable selects, appointment forms, and invoice forms. **90 distinct cases
  passed after focused reruns**. The remaining `take/pickup items ask only for
  quantity and Enter saves` case also fails against the original source in a
  temporary baseline copy, timing out while waiting for `Box × 3`.
- New regressions passed: desktop/mobile select triggers reference the actual
  cmdk listbox ID, and payment-method refetches preserve the wizard step and
  typed amount. Browser and build checks required execution outside the sandbox
  for Chromium launch and Turbopack's local worker, respectively.

Appointment mutation failures now show error feedback. Empty query-list fallbacks
retain their identity, and profile helpers have stable component identities.
Render-time ref writes now run after commit; immediate comment-handler writes
remain intact. API requests, permission contracts, and payloads were not changed.
No runtime performance benchmark or speedup is claimed.

Current source snapshots are [eslint-src.txt](eslint-src.txt) and
[eslint-src.json](eslint-src.json). See [README.md](README.md) for validation
commands, retained-warning counts, and the open browser failure.

The triage below describes the original findings; its line numbers and example
code are historical. Sections 1 and 2 are implemented; section 3 records the
retained patterns and targeted explanatory suppressions.

---

**Result: 0 errors, 0 fatal. Warnings only.**
Nearly all warnings come from the `react-hooks` rules that ship with React Compiler support (`set-state-in-effect`, `refs`, `static-components`, etc.). Most are style/perf hints, not bugs. A few are real.

---

## 1. FIX FIRST (real bugs or likely bugs)

### 1.1 `auth-provider.tsx` (line 131): new `[]` every render
```ts
const permissions = permissionsQuery.data?.permissions ?? [];
```
When there is no data, `[]` is a new array on every render, so `permissionSet`, `hasPermission` and the context `value` all change every render. That re-renders every `useAuth()` consumer in the app.
**Fix:** module-level constant.
```ts
const EMPTY_PERMISSIONS: Permission[] = [];
const permissions = permissionsQuery.data?.permissions ?? EMPTY_PERMISSIONS;
```

### 1.2 `sidebar-profile-menu.tsx` (`static-components`): components defined inside render
`ProfileAvatar` and `ProfileMeta` are declared inside `SidebarProfileMenu`. They get a new identity every render, so React unmounts and remounts them each time.
**Fix:** move both outside the component and pass `initials`, `profileName`, etc. as props (or just inline the JSX).

### 1.3 `daily-income-workspace.tsx` (line 280): function call inside a deps array
```ts
}, [branchCode, branches, requestedBranchId, branches.find(...)?.code, currentUser.isLoading]);
```
Also missing `currentUser.data?.branch.id`.
**Fix:** compute `const userBranchCode = branches.find(b => b.id === currentUser.data?.branch.id)?.code;` above the effect and use `userBranchCode` plus `currentUser.data?.branch.id` in the deps.

### 1.4 `orders-workspace.tsx`: `formError` is set but never read
`setFormError(...)` is called in save, delete and so on, but the value is never displayed. Save and delete errors are silently swallowed in the mobile dialog flow.
**Fix:** show it (e.g. pass to a notice in the dialog) or call `notifyError(message)` where you currently `setFormError`. Also remove the unused `routeLabel` prop from `MobileOrderRow`.

### 1.5 `daily-income-workspace.tsx` (line 334): `statementOpen` unused
Computed and never used. Either it was meant to gate something (check intent) or delete it.

### 1.6 `add-transaction-wizard.tsx` (lines 169, 196)
- Line 169: `props.onEntryActiveChange` used but `props` flagged. Do what you already did on the next effect: `const { onEntryActiveChange, open } = props;` and depend on those.
- Line 196: `[props.open, isEdit, isEdit ? props.initialValues : null]` is a conditional in the deps array. Extract `const editInitialValues = isEdit ? props.initialValues : null;` and use that.
- **Do NOT** accept ESLint's suggestion to add `props.paymentMethods`. It would reset the wizard step and form every time payment methods refetch. Keep the intentional reset behavior and add an `eslint-disable-next-line react-hooks/exhaustive-deps` with a comment.

---

## 2. FIX (easy, safe, mechanical)

### 2.1 `?? []` / `?? EMPTY` recreated each render (`exhaustive-deps` "logical expression")
Same pattern as 1.1, lower impact. Fix with a module-level `const EMPTY: T[] = []` or by moving the expression inside the `useMemo`.

| File | Variable |
|---|---|
| `check-form.tsx` | `invoiceResults` |
| `loans-workspace.tsx` | `loans` |
| `register-invoice-transaction-fields.tsx` | `customers` (4 memos) |
| `barcode-form.tsx`, `barcodes-workspace.tsx` | `containers` |
| `assign-barcode-route-dialog.tsx` | `dailyRoutes` |
| `invoice-form-preview-step.tsx` | `containers`, `orders`, `pickupRoutes` |
| `invoice-form.tsx` | `defaultOrders`, `branches`, `pickupSearchResults` |
| `label-updater-workspace.tsx` | `containers`, `routes` |
| `assign-route-crew-dialog.tsx` | `containers` |
| `pickup-delivery-route-section.tsx` | `containers`, `vehicles`, `previousRoutes` |
| `reports-workspace.tsx` | `reports`, `items` (x2) |
| `user-form.tsx` | `branches` |
| `vehicles-workspace.tsx`, `use-vehicle-labels.ts` | `branches` |

### 2.2 Unused variables (`@typescript-eslint/no-unused-vars`)
- Remove unused `Trash2` import in: `containers-workspace.tsx`, `items-workspace.tsx`, `roles-workspace.tsx`, `vehicles-workspace.tsx`
- `item-form.tsx`: `isEditing`, `updatedAt` destructured but unused (drop from destructuring, or from the props type if no caller needs them)
- `order-form.tsx`: `updatedAt` unused
- `chart-accounts-api.ts`, `use-route-manager.ts`: remove unused `hasListTextSearch` import
- `_routeType` params (`pickup-delivery-routes-api.ts` x2, `use-pickup-delivery-routes.ts` x2): the underscore prefix is not being ignored by your config. Add to eslint config:
  ```js
  "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }]
  ```
  That clears all four at once.

### 2.3 Misc
- `pickup-delivery-routes-directory-workspace.tsx` (line 352): remove unnecessary dep `variant.id`.
- `assign-route-crew-dialog.tsx` (line 169): effect uses `defaultContainer` but only `defaultContainer?.id` is in deps. Use `const defaultContainerId = defaultContainer?.id;` and depend on it.

### 2.4 Accessibility (quick wins)
- `daily-income-statement-form.tsx` (line 89): `aria-disabled` is not valid on `<form>`. Remove it (the fieldset `disabled` already handles it).
- `data-table.tsx` (line 376): `aria-sort` belongs on the `<th>`, not the sort `<button>`. Move it up.
- `customer-party-select.tsx` (line 655, mobile trigger): add `aria-controls={open ? listboxId : undefined}`.
- `searchable-select.tsx` (lines 597, 685): `role="combobox"` buttons need `aria-controls`. Add the list id.

### 2.5 Render-time ref writes (`react-hooks/refs`)
Writing `ref.current = x` during render. Move into an effect:
```ts
useEffect(() => { invoiceRef.current = invoice; });
```
Files: `invoice-payment-transaction-form.tsx` (3 refs), `order-comments-editor.tsx` (`commentsRef`), `use-apply-customer-on-tab-return.ts` (`applyRef`).
Caveat: in `order-comments-editor.tsx` the code also assigns `commentsRef.current` in handlers for immediate reads, so keep those writes and test after changing.

---

## 3. LEAVE (noise, false positives, or intentional)

### 3.1 `react-hooks/set-state-in-effect`, about 70 occurrences
This is the biggest category. The common patterns here are:
- `useEffect(() => setValues(initialValues ?? empty), [initialValues])` in form components
- reset state when a dialog closes (`if (!open) setX("")`)
- `useEffect(() => setMounted(true), [])`
- localStorage hydration (`dashboard-shell.tsx`, `theme-toggle.tsx`)

These work correctly today. Rewriting them is a large refactor with regression risk for little gain. **Leave them**, then do one of:
- Downgrade the rule: `"react-hooks/set-state-in-effect": "off"` (or keep "warn" and accept the noise), **or**
- Fix opportunistically when touching a file. The usual clean fix is remounting with `key={initialValues.id}` from the parent. Many of your callers already pass `key`, so the effect is often redundant.

Slightly worth a look when you are in the file anyway: `sidebar-nav.tsx`, `invoice-form-wizard.tsx` (line 213 clamps step in an effect), `use-address-autocomplete.ts`, `label-updater-workspace.tsx` (default-selection effects could be derived values).

### 3.2 `react-hooks/incompatible-library` (react-hook-form `watch()`)
Files: `chart-account-form`, `daily-income-statement-form`, `daily-income-transaction-form`, `record-loan-payment-dialog`, `transaction-closeout-setup`, `invoice-daily-income-step`.
It only means React Compiler skips those components. The behavior is fine. Optionally switch `watch("x")` to `useWatch({ control, name: "x" })` later. Not worth doing now.

### 3.3 Intentionally-missing deps. Add `// eslint-disable-next-line react-hooks/exhaustive-deps` with a reason
- `customer-form.tsx` (line 451): deliberately keyed on `initialValues.id/updatedAt` so typing is not wiped.
- `data-table.tsx` (line 224): `autoFitAllVisibleColumns` is a per-render function; adding it causes re-fit loops.
- `orders-workspace.tsx` (line 451): `setPage` is stable (state setter via hook). Safe to add to deps or ignore.

### 3.4 `data-table.tsx` `react-hooks/immutability` (`document.body.style.cursor`)
False positive. It is inside an event handler for drag-resize. Leave.

### 3.5 `workspace-tab-panels.tsx` `static-components`
`resolveWorkspaceComponent(...)` returns stable component references from a registry, so nothing is recreated. Leave, or add a disable comment.

### 3.6 `dev-session-banner.tsx` `react-hooks/purity` (`Date.now()`)
Dev-only banner. Leave.

### 3.7 `preserve-manual-memoization`
`assign-appointment-route-dialog.tsx`, `searchable-select.tsx`, `use-floating-memo-pad.ts`. Compiler just opts out of optimizing them. Leave.

### 3.8 `use-table-page-size.ts` reads `knownTotalRef.current` in render
Intentional "remember last total" trick for "all" page size. Works. Leave unless you want to refactor it to state.

### 3.9 `delivery-photo-picker.tsx` `@next/next/no-img-element`
Source is a blob/object URL, which `next/image` cannot optimize. Add `// eslint-disable-next-line @next/next/no-img-element`.

### 3.10 `searchable-select.tsx` line 825 `aria-expanded` on `textbox`
Artifact of `asChild` + cmdk input. The real element has `role="combobox"`. Leave.

---

## Suggested order of work
1. Section 1 (6 items, about 30-45 min). Real impact.
2. Config tweak: `argsIgnorePattern: "^_"` and decide on `set-state-in-effect` severity.
3. Section 2.1 + 2.2 (mechanical, one pass).
4. Section 2.4 / 2.5 (a11y + refs).
5. Everything in section 3: leave, or add disable comments with reasons.
