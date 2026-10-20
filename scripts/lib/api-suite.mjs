/**
 * Shared CLI, HTTP and reporting helpers for the `scripts/test-*-api.mjs`
 * smoke suites. Every suite accepts the same flags the orchestrator forwards:
 *
 *   node scripts/test-<x>-api.mjs '<jwt>' [--company <id>] [--base-url <url>] [--bearer] [--skip-crud]
 *
 * Env equivalents: EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL,
 * EMSYS_AUTH_BEARER=1, EMSYS_SKIP_CRUD=1.
 */

export const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
export const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";

/**
 * @param {object} config
 * @param {string} config.title         Banner printed at start.
 * @param {string} config.usage         Extra help text (suite-specific options).
 * @param {Record<string, { env?: string, flag: string, takesValue?: boolean }>} [config.options]
 */
export function createApiSuite({ title, usage = "", options = {} }) {
  const opts = {
    token: (process.env.EMSYS_TOKEN ?? "").trim(),
    companyId: (process.env.EMSYS_COMPANY_ID ?? DEFAULT_COMPANY_ID).trim(),
    baseUrl: (process.env.EMSYS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    useBearer: process.env.EMSYS_AUTH_BEARER === "1",
    skipCrud: process.env.EMSYS_SKIP_CRUD === "1",
  };
  for (const [key, option] of Object.entries(options)) {
    const envValue = option.env ? process.env[option.env] : undefined;
    opts[key] = option.takesValue ? (envValue ?? "").trim() : envValue === "1";
  }

  const printHelp = () =>
    console.log(`Usage:
  node ${process.argv[1]?.split("/").slice(-2).join("/")} '<jwt>'

Options:
  --company <id>     X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>   API base (default: ${DEFAULT_BASE_URL})
  --bearer           Use "Bearer <jwt>" Authorization header
  --skip-crud        Skip create / update / delete
${usage}`);

  const argv = process.argv.slice(2);
  try {
    for (let i = 0; i < argv.length; i += 1) {
      const arg = argv[i];
      const custom = Object.entries(options).find(([, option]) => option.flag === arg);
      if (arg === "-h" || arg === "--help") {
        printHelp();
        process.exit(0);
      } else if (arg === "--company") opts.companyId = String(argv[++i] ?? "").trim();
      else if (arg === "--base-url") opts.baseUrl = String(argv[++i] ?? "").replace(/\/$/, "");
      else if (arg === "--bearer") opts.useBearer = true;
      else if (arg === "--skip-crud") opts.skipCrud = true;
      else if (custom) opts[custom[0]] = custom[1].takesValue ? String(argv[++i] ?? "").trim() : true;
      else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
      else if (!opts.token) opts.token = arg.trim();
      else throw new Error(`Unexpected argument: ${arg}`);
    }
  } catch (error) {
    console.error(String(error?.message ?? error));
    printHelp();
    process.exit(1);
  }

  if (!opts.token) {
    console.error("Pass a temporary JWT as the first argument, or set EMSYS_TOKEN.");
    process.exit(1);
  }

  const headers = {
    accept: "application/json",
    "Content-Type": "application/json",
    "X-Company-ID": opts.companyId,
    Authorization: opts.useBearer
      ? `Bearer ${opts.token.replace(/^Bearer\s+/i, "")}`
      : opts.token.replace(/^Bearer\s+/i, ""),
  };

  const results = { passed: [], failed: [], notes: [] };

  async function request(method, path, body, extraHeaders) {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${opts.baseUrl}${path}`, {
          method,
          headers: extraHeaders ? { ...headers, ...extraHeaders } : headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.status === 429 && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }
        const text = await response.text();
        let json;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = { raw: text.slice(0, 300) };
        }
        return { status: response.status, json };
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }
    return { status: 0, json: { error: String(lastError?.message ?? lastError) } };
  }

  const ok = (res) => res.status >= 200 && res.status < 300 && res.json?.success !== false;
  const errDetail = (res) => String(res.json?.error ?? res.json?.message ?? res.json?.raw ?? "").slice(0, 200);

  function rowsOf(res) {
    const data = res.json?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function summarizeList(res) {
    return `total=${res.json?.total ?? "?"} items=${rowsOf(res).length}`;
  }

  /** Id from a create/update envelope (`data.id`, `data._id`, nested `data.<entity>.id`, or a bare id). */
  function extractId(res) {
    const data = res.json?.data;
    if (typeof data === "number" || typeof data === "string") return data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (data.id != null || data._id != null) return data.id ?? data._id;
      for (const value of Object.values(data)) {
        if (value && typeof value === "object" && (value.id != null || value._id != null)) return value.id ?? value._id;
      }
    }
    if (Array.isArray(data) && data[0]) return data[0].id ?? data[0]._id ?? null;
    return null;
  }

  function pass(label, detail = "") {
    results.passed.push({ label, detail });
    console.log(`  [PASS] ${label}${detail ? ` — ${detail}` : ""}`);
  }

  function fail(label, status, detail = "") {
    results.failed.push({ label, status, detail });
    console.log(`  [FAIL] ${label} — HTTP ${status}${detail ? ` ${detail}` : ""}`);
  }

  function note(message) {
    results.notes.push(message);
    console.log(`  [NOTE] ${message}`);
  }

  /** Records pass/fail for a response and returns whether it succeeded. */
  function check(label, res, detail = "") {
    if (ok(res)) {
      pass(label, typeof detail === "function" ? detail(res) : detail);
      return true;
    }
    fail(label, res.status, errDetail(res));
    return false;
  }

  /** GET list as the auth gate; exits when the token is rejected. */
  async function listOrExit(path, label = `GET ${path.split("?")[0]}`) {
    const res = await request("GET", path);
    if (res.status === 401 || res.status === 403) {
      fail(`${label} (auth check)`, res.status, errDetail(res));
      console.log("\nAuth failed. Refresh the temporary token and try again.");
      process.exit(1);
    }
    check(label, res, summarizeList);
    return res;
  }

  function banner(extra = []) {
    console.log(title);
    console.log(`Base:     ${opts.baseUrl}`);
    console.log(`Company:  ${opts.companyId}`);
    console.log(`Auth:     ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
    console.log(`CRUD:     ${opts.skipCrud ? "skipped" : "enabled"}`);
    for (const line of extra) console.log(line);
    console.log("");
  }

  function finish(successMessage) {
    console.log("\n=== SUMMARY ===");
    console.log(`Passed: ${results.passed.length}`);
    console.log(`Failed: ${results.failed.length}`);
    if (results.notes.length) {
      console.log("Notes:");
      for (const entry of results.notes) console.log(`  - ${entry}`);
    }
    if (results.failed.length) {
      console.log("Failures:");
      for (const entry of results.failed) console.log(`  - ${entry.label}: ${entry.status} ${entry.detail}`);
      process.exit(1);
    }
    console.log(successMessage);
  }

  return {
    opts,
    stamp: Date.now(),
    request,
    ok,
    errDetail,
    rowsOf,
    summarizeList,
    extractId,
    pass,
    fail,
    note,
    check,
    listOrExit,
    banner,
    finish,
  };
}
