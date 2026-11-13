import ts from "typescript";

export default function transpile(source) {
  return ts.transpileModule(source, {
    fileName: this.resourcePath,
    compilerOptions: {
      // Fixtures are injected as one inline script; keep dynamic imports in that bundle.
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}
