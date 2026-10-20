/**
 * Loads real portal feature modules from `src/` inside node scripts (TS is
 * transpiled on the fly) with only the central HTTP boundary replaced, so API
 * suites exercise exactly the payload builders, headers and normalizers the
 * UI uses.
 *
 *   const load = createPortalLoader({ apiClient });
 *   const api = load("src/lib/inventory/api/inventory-api.ts");
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const PORTAL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

let ts;
function typescript() {
  if (!ts) {
    try {
      ts = require("typescript");
    } catch {
      console.error("The `typescript` dev dependency is required (npm ci).");
      process.exit(1);
    }
  }
  return ts;
}

/** Permissive stand-in for browser-only dependencies list/write code never calls. */
export function stubModule() {
  const fn = (...args) => args[0];
  return new Proxy(fn, {
    get: (_target, key) => (key === "__esModule" ? true : stubModule()),
    apply: (_target, _this, args) => args[0],
  });
}

/** Mirrors `normalizeApiError` closely enough for scripts (message + status). */
function normalizeApiErrorStub(error) {
  const data = error?.response?.data;
  return {
    message: String(data?.error ?? data?.message ?? error?.message ?? error ?? "Request failed"),
    status: error?.response?.status,
  };
}

export function createPortalLoader({ apiClient }) {
  const cache = new Map();

  function load(file) {
    const filename = path.isAbsolute(file) ? file : path.join(PORTAL_ROOT, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    if (filename.endsWith(".json")) {
      loaded.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      return loaded.exports;
    }
    const tsc = typescript();
    const source = tsc.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: tsc.ModuleKind.CommonJS,
        target: tsc.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: tsc.JsxEmit.ReactJSX,
      },
      fileName: filename,
    }).outputText;

    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier === "@/lib/api/axios") return { normalizeApiError: normalizeApiErrorStub, axiosInstance: stubModule() };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const base = specifier.startsWith("@/")
          ? path.join(PORTAL_ROOT, "src", specifier.slice(2))
          : path.resolve(path.dirname(filename), specifier);
        const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
        const target = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
        if (!target) throw new Error(`Cannot resolve ${specifier} from ${path.relative(PORTAL_ROOT, filename)}`);
        return load(target);
      }
      try {
        return require(specifier);
      } catch {
        return stubModule();
      }
    }

    new Function("require", "module", "exports", source)(localRequire, loaded, loaded.exports);
    return loaded.exports;
  }

  return load;
}

/**
 * `apiClient` stand-in that records every call and returns an empty success
 * envelope — for capturing the exact request the portal would send.
 */
export function createRecordingApiClient() {
  const calls = [];
  const apiClient = Object.fromEntries(
    ["get", "post", "put", "patch", "delete"].map((method) => [
      method,
      async (url, body, config) => {
        calls.push({ method, url, body, config });
        return { success: true, data: [], total: 0 };
      },
    ]),
  );
  return { apiClient, calls };
}

/**
 * `apiClient` stand-in backed by a real HTTP `request(method, path, body, headers)`.
 * Non-2xx responses throw an axios-shaped error (`error.response.{status,data}`).
 */
export function createHttpApiClient(request) {
  async function send(method, url, body, config) {
    const res = await request(method.toUpperCase(), url, body, config?.headers);
    if (res.status < 200 || res.status >= 300) {
      const error = new Error(String(res.json?.error ?? res.json?.message ?? `HTTP ${res.status}`));
      error.response = { status: res.status, data: res.json };
      throw error;
    }
    return res.json;
  }
  return {
    get: (url, config) => send("get", url, undefined, config),
    post: (url, body, config) => send("post", url, body, config),
    put: (url, body, config) => send("put", url, body, config),
    patch: (url, body, config) => send("patch", url, body, config),
    delete: (url, body, config) => send("delete", url, body, config),
  };
}
