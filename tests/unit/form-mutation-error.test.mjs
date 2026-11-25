import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

function loader(stubs = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.isAbsolute(relative) ? relative : path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    function localRequire(id) {
      if (stubs[id]) return stubs[id];
      if (id === "axios") {
        return {
          __esModule: true,
          default: { isAxiosError: (error) => Boolean(error?.isAxiosError) },
          isAxiosError: (error) => Boolean(error?.isAxiosError),
        };
      }
      if (id === "@/lib/api/axios") {
        return {
          normalizeApiError: (error) => ({
            status: error?.response?.status ?? error?.status,
            message: error?.response?.data?.error || error?.response?.data?.message || error?.message || "error",
          }),
        };
      }
      if (id === "@/lib/i18n/translate-current") {
        return {
          translateCurrent: (key, params) => {
            if (key === "common.errors.api.requestFailedShortWithStatus") {
              return `Request failed (${params.status}).`;
            }
            if (key === "common.errors.api.requestFailedShort") return "Request failed.";
            if (key === "common.errors.api.requestFailedPlain") return "Request failed";
            return params?.status != null ? `${key}:${params.status}` : key;
          },
        };
      }
      if (id.startsWith("@/") || id.startsWith(".")) {
        const target = id.startsWith("@/")
          ? path.join(root, "src", id.slice(2))
          : path.resolve(path.dirname(filename), id);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        const file = fs.existsSync(`${target}.ts`)
          ? `${target}.ts`
          : fs.existsSync(target)
            ? target
            : path.join(target, "index.ts");
        return load(file);
      }
      return require(id);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

const api = loader()("src/lib/errors/form-mutation-error.ts");
const t = (key) => key;

function axiosError(status, data, message = `Request failed with status code ${status}`) {
  return {
    isAxiosError: true,
    message,
    response: { status, data },
  };
}

test("412/428 stale mutations use common.form.staleUpdate", () => {
  assert.equal(api.formatFormMutationError(axiosError(412, {}), t), "common.form.staleUpdate");
  assert.equal(api.formatFormMutationError(axiosError(428, {}), t), "common.form.staleUpdate");
});

test("opaque 409 uses common.form.conflict", () => {
  assert.equal(
    api.formatFormMutationError(axiosError(409, { message: "Conflict" }), t),
    "common.form.conflict",
  );
  assert.equal(api.formatFormMutationError(axiosError(409, {}), t), "common.form.conflict");
});

test("409 with a meaningful API error keeps the server message", () => {
  assert.equal(
    api.formatFormMutationError(axiosError(409, { error: "Branch code NY already exists." }), t),
    "Branch code NY already exists.",
  );
});

test("formatConflict override wins after stale check", () => {
  assert.equal(
    api.formatFormMutationError(axiosError(409, { error: "ignored" }), t, {
      formatConflict: () => "feature conflict",
    }),
    "feature conflict",
  );
  assert.equal(
    api.formatFormMutationError(axiosError(412, {}), t, {
      formatConflict: () => "should not win",
    }),
    "common.form.staleUpdate",
  );
});

test("400/500 preserve API detail when present", () => {
  assert.equal(
    api.formatFormMutationError(axiosError(400, { error: "Name is required." }), t),
    "Name is required.",
  );
  assert.equal(
    api.formatFormMutationError(axiosError(500, { error: "Database unavailable." }), t),
    "Database unavailable.",
  );
});

test("readApiFieldErrors returns [] when the API has no errors array", () => {
  assert.deepEqual(api.readApiFieldErrors(axiosError(400, { message: "Invalid request" })), []);
  assert.deepEqual(api.readApiFieldErrors(new Error("boom")), []);
});

test("readApiFieldErrors parses errors[] and details[] shapes", () => {
  assert.deepEqual(
    api.readApiFieldErrors(
      axiosError(400, {
        errors: [
          { field: "email", message: "Email already registered" },
          { path: ["phones", 0, "number"], message: "Invalid phone" },
          { field: "skip", message: "" },
        ],
      }),
    ),
    [
      { field: "email", message: "Email already registered" },
      { field: "phones.0.number", message: "Invalid phone" },
    ],
  );
  assert.deepEqual(
    api.readApiFieldErrors(axiosError(400, { details: [{ path: "name", error: "Required" }] })),
    [{ field: "name", message: "Required" }],
  );
});

test("applyApiFieldErrors maps onto RHF setError and returns true when applied", () => {
  const calls = [];
  const form = { setError: (name, error) => calls.push({ name, error }) };
  assert.equal(api.applyApiFieldErrors(form, axiosError(400, { message: "Invalid request" })), false);
  assert.equal(calls.length, 0);
  assert.equal(
    api.applyApiFieldErrors(form, axiosError(400, { errors: [{ field: "email", message: "Taken" }] })),
    true,
  );
  assert.deepEqual(calls, [{ name: "email", error: { type: "server", message: "Taken" } }]);
});
