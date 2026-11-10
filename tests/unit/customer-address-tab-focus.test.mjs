import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function fixture(intent) {
  const existing = { id: "edit-client", href: "/customers", number: 2,
    form: { feature: "customers", mode: "edit", entityId: "client", customerFormIntent: intent } };
  const state = { layoutTabs: { tabs: [existing], activeTabId: "edit-client" } };
  const actions = [], navigations = [];
  const dependencies = {
    react: { useCallback: callback => callback },
    "next/navigation": { useRouter: () => ({ push: href => navigations.push(href) }) },
    "@/components/app-shell/feedback-provider": { useFeedback: () => ({}) },
    "@/hooks/use-is-mobile-viewport": { useIsDesktopWorkspaceTabs: () => true },
    "@/lib/configuration/use-configuration": { useConfigurationStore: () => ({ language: "en" }) },
    "@/lib/store/hooks": {
      useAppDispatch: () => action => actions.push(action),
      useAppSelector: selector => selector(state),
    },
    "@/lib/store/store": { store: { getState: () => state } },
    "@/lib/store/layout/tabs-slice": {
      findFormTab: () => existing,
      patchWorkspaceTabForm: payload => ({ type: "patch", payload }),
      setActiveWorkspaceTab: payload => ({ type: "activate", payload }),
    },
    "@/lib/layout/workspace-tab-url": { buildWorkspaceTabUrl: href => href },
    "@/lib/customers/customer-form-navigation": {},
    "@/lib/i18n": {},
    "@/lib/layout/workspace-registry": {},
    "@/lib/layout/workspace-tab-limits": {},
  };
  const source = ts.transpileModule(readFileSync("src/lib/layout/hooks/use-workspace-tabs.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loadedModule = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, loadedModule, loadedModule.exports);
  return { tabs: loadedModule.exports.useWorkspaceTabs(), actions, navigations };
}

for (const intent of ["address", "phone"]) {
  test(`focusing an existing address clears an earlier add-${intent} intent when reusing the edit tab`, () => {
    const f = fixture(intent);
    f.tabs.openFormTab({ feature: "customers", baseHref: "/customers", mode: "edit", entityId: "client", label: "Edit client", focusAddressIndex: 0 });
    assert.equal(f.actions.length, 2);
    const patch = f.actions[0].payload;
    assert.equal(patch.id, "edit-client");
    assert.equal(patch.form.focusAddressIndex, 0);
    assert.ok(Object.hasOwn(patch.form, "customerFormIntent"));
    assert.equal(patch.form.customerFormIntent, undefined);
    assert.equal(typeof patch.form.formNonce, "number");
    assert.deepEqual(f.navigations, ["/customers"]);
  });
}
