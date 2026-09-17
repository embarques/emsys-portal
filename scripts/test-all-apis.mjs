#!/usr/bin/env node
/**
 * Orchestrator for all EMSYS API smoke scripts.
 *
 * Runs the token-only endpoint suites in a bounded worker pool so we stay
 * efficient without hammering the API (rate limits / 429s).
 *
 * Usage:
 *   node scripts/test-all-apis.mjs '<jwt>'
 *   EMSYS_TOKEN='<jwt>' node scripts/test-all-apis.mjs
 *   npm run test:api -- '<jwt>'
 *
 * Shared flags are forwarded to every child:
 *   --company <id>
 *   --base-url <url>
 *   --bearer
 *   --skip-crud
 *
 * Orchestrator-only options:
 *   --concurrency <n>     parallel suites (default: 3)
 *   --stagger-ms <n>      delay between starting new suites (default: 400)
 *   --retries <n>         retry a suite on exit≠0 or rate-limit (default: 1)
 *   --retry-delay-ms <n>  base backoff before retry (default: 2000)
 *   --fail-fast           stop queueing remaining suites after first failure
 *   --only a,b,c          run only these suite ids
 *   --skip a,b,c          exclude these suite ids
 *   --list                print suite ids and exit
 *   --quiet               suppress child stdout (keep stderr + summary)
 *
 * Env equivalents:
 *   EMSYS_TOKEN, EMSYS_COMPANY_ID, EMSYS_API_BASE_URL, EMSYS_AUTH_BEARER=1
 *   EMSYS_SKIP_CRUD=1
 *   EMSYS_API_CONCURRENCY, EMSYS_API_STAGGER_MS, EMSYS_API_RETRIES
 *   EMSYS_API_RETRY_DELAY_MS, EMSYS_API_FAIL_FAST=1, EMSYS_API_QUIET=1
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_COMPANY_ID = "64d5c0b0d1eab2aaf30b1819";
const DEFAULT_BASE_URL = "https://api.embarqueros.com/v1";
const DEFAULT_CONCURRENCY = 3;
const DEFAULT_STAGGER_MS = 400;
const DEFAULT_RETRIES = 1;
const DEFAULT_RETRY_DELAY_MS = 2000;

/** Registry of smoke suites created for the portal API surface. */
const SUITES = [
  { id: "branches", script: "test-branches-api.mjs", label: "Branches" },
  { id: "roles", script: "test-roles-api.mjs", label: "Roles" },
  { id: "customers", script: "test-customers-api.mjs", label: "Customers" },
  { id: "employees", script: "test-employees-api.mjs", label: "Employees" },
  { id: "vehicles", script: "test-vehicles-api.mjs", label: "Vehicles" },
  { id: "items", script: "test-items-api.mjs", label: "Items" },
  { id: "inventory", script: "test-inventory-api.mjs", label: "Inventory" },
  { id: "containers", script: "test-containers-api.mjs", label: "Containers" },
  { id: "pickups", script: "test-pickups-api.mjs", label: "Pickups" },
  { id: "invoices", script: "test-invoices-api.mjs", label: "Invoices" },
  { id: "barcodes", script: "test-barcodes-api.mjs", label: "Barcodes" },
  { id: "routes", script: "test-routes-api.mjs", label: "Routes" },
  { id: "user-activities", script: "test-user-activities-api.mjs", label: "User activities" },
];

const RATE_LIMIT_RE = /\b(429|rate.?limit|too many requests|throttl)/i;

function printHelp() {
  const ids = SUITES.map((s) => s.id).join(", ");
  console.log(`Usage:
  node scripts/test-all-apis.mjs '<jwt>'
  EMSYS_TOKEN='<jwt>' node scripts/test-all-apis.mjs
  npm run test:api -- '<jwt>'

Shared (forwarded to every suite):
  --company <id>            X-Company-ID (default: ${DEFAULT_COMPANY_ID})
  --base-url <url>          API base (default: ${DEFAULT_BASE_URL})
  --bearer                  Use "Bearer <jwt>" Authorization header
  --skip-crud               Skip create / update / delete in children

Orchestrator:
  --concurrency <n>         Parallel suites (default: ${DEFAULT_CONCURRENCY})
  --stagger-ms <n>          Delay between suite starts (default: ${DEFAULT_STAGGER_MS})
  --retries <n>             Retries per suite on failure/rate-limit (default: ${DEFAULT_RETRIES})
  --retry-delay-ms <n>      Base backoff before retry (default: ${DEFAULT_RETRY_DELAY_MS})
  --fail-fast               Stop queueing after the first failed suite
  --only <ids>              Comma-separated suite ids to run
  --skip <ids>              Comma-separated suite ids to exclude
  --list                    Print suite ids and exit
  --quiet                   Hide child stdout (summary still printed)
  -h, --help                Show this help

Suites:
  ${ids}
`);
}

function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.floor(n);
}

function parseArgs(argv) {
  const opts = {
    token: (process.env.EMSYS_TOKEN ?? "").trim(),
    companyId: (process.env.EMSYS_COMPANY_ID ?? DEFAULT_COMPANY_ID).trim(),
    baseUrl: (process.env.EMSYS_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, ""),
    useBearer: process.env.EMSYS_AUTH_BEARER === "1",
    skipCrud: process.env.EMSYS_SKIP_CRUD === "1",
    concurrency: parsePositiveInt(process.env.EMSYS_API_CONCURRENCY, DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY,
    staggerMs: parsePositiveInt(process.env.EMSYS_API_STAGGER_MS, DEFAULT_STAGGER_MS),
    retries: parsePositiveInt(process.env.EMSYS_API_RETRIES, DEFAULT_RETRIES),
    retryDelayMs: parsePositiveInt(process.env.EMSYS_API_RETRY_DELAY_MS, DEFAULT_RETRY_DELAY_MS),
    failFast: process.env.EMSYS_API_FAIL_FAST === "1",
    quiet: process.env.EMSYS_API_QUIET === "1",
    only: [],
    skip: [],
    list: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--list") {
      opts.list = true;
    } else if (arg === "--company") {
      opts.companyId = String(argv[++i] ?? "").trim();
    } else if (arg === "--base-url") {
      opts.baseUrl = String(argv[++i] ?? "").replace(/\/$/, "");
    } else if (arg === "--bearer") {
      opts.useBearer = true;
    } else if (arg === "--skip-crud") {
      opts.skipCrud = true;
    } else if (arg === "--concurrency") {
      opts.concurrency = Math.max(1, parsePositiveInt(argv[++i], DEFAULT_CONCURRENCY) || DEFAULT_CONCURRENCY);
    } else if (arg === "--stagger-ms") {
      opts.staggerMs = parsePositiveInt(argv[++i], DEFAULT_STAGGER_MS);
    } else if (arg === "--retries") {
      opts.retries = parsePositiveInt(argv[++i], DEFAULT_RETRIES);
    } else if (arg === "--retry-delay-ms") {
      opts.retryDelayMs = parsePositiveInt(argv[++i], DEFAULT_RETRY_DELAY_MS);
    } else if (arg === "--fail-fast") {
      opts.failFast = true;
    } else if (arg === "--quiet") {
      opts.quiet = true;
    } else if (arg === "--only") {
      opts.only = parseCsv(argv[++i]);
    } else if (arg === "--skip") {
      opts.skip = parseCsv(argv[++i]);
    } else if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!opts.token) {
      opts.token = arg.trim();
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  return opts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildChildArgs(opts) {
  const args = [opts.token];
  if (opts.companyId) {
    args.push("--company", opts.companyId);
  }
  if (opts.baseUrl) {
    args.push("--base-url", opts.baseUrl);
  }
  if (opts.useBearer) args.push("--bearer");
  if (opts.skipCrud) args.push("--skip-crud");
  return args;
}

function selectSuites(opts) {
  const known = new Set(SUITES.map((s) => s.id));
  for (const id of [...opts.only, ...opts.skip]) {
    if (!known.has(id)) {
      throw new Error(`Unknown suite id: ${id}. Use --list to see valid ids.`);
    }
  }

  let selected = SUITES;
  if (opts.only.length) {
    const only = new Set(opts.only);
    selected = SUITES.filter((s) => only.has(s.id));
  }
  if (opts.skip.length) {
    const skip = new Set(opts.skip);
    selected = selected.filter((s) => !skip.has(s.id));
  }
  return selected;
}

function prefixLine(suiteId, stream, chunk, state) {
  const text = chunk.toString("utf8");
  state.buffer += text;
  const parts = state.buffer.split(/\r?\n/);
  state.buffer = parts.pop() ?? "";
  for (const line of parts) {
    const tagged = `[${suiteId}] ${line}`;
    if (stream === "stdout") process.stdout.write(`${tagged}\n`);
    else process.stderr.write(`${tagged}\n`);
  }
}

function flushPrefix(suiteId, stream, state) {
  if (!state.buffer) return;
  const tagged = `[${suiteId}] ${state.buffer}`;
  if (stream === "stdout") process.stdout.write(`${tagged}\n`);
  else process.stderr.write(`${tagged}\n`);
  state.buffer = "";
}

function runSuiteOnce(suite, childArgs, quiet) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, suite.script);
    const child = spawn(process.execPath, [scriptPath, ...childArgs], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    const outState = { buffer: "" };
    const errState = { buffer: "" };

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (!quiet) prefixLine(suite.id, "stdout", chunk, outState);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
      prefixLine(suite.id, "stderr", chunk, errState);
    });

    child.on("error", (error) => {
      resolve({
        code: 1,
        stdout,
        stderr: `${stderr}\n${error.message}`,
        rateLimited: false,
      });
    });

    child.on("close", (code) => {
      if (!quiet) flushPrefix(suite.id, "stdout", outState);
      flushPrefix(suite.id, "stderr", errState);
      const combined = `${stdout}\n${stderr}`;
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
        rateLimited: RATE_LIMIT_RE.test(combined),
      });
    });
  });
}

async function runSuiteWithRetries(suite, opts, childArgs) {
  const startedAt = Date.now();
  let attempt = 0;
  let last = null;

  while (attempt <= opts.retries) {
    if (attempt > 0) {
      const delay = opts.retryDelayMs * attempt;
      console.log(
        `  ↻ retry ${suite.id} (attempt ${attempt + 1}/${opts.retries + 1}) after ${formatDuration(delay)}`,
      );
      await sleep(delay);
    }

    last = await runSuiteOnce(suite, childArgs, opts.quiet);
    if (last.code === 0) {
      return {
        id: suite.id,
        label: suite.label,
        ok: true,
        code: 0,
        attempts: attempt + 1,
        durationMs: Date.now() - startedAt,
        rateLimited: false,
      };
    }

    // Retry on rate-limit signals, or any failure if retries remain.
    if (attempt >= opts.retries) break;
    if (!last.rateLimited && last.code !== 0) {
      // Still retry generic failures once by default — helps flaky auth/network.
    }
    attempt += 1;
  }

  return {
    id: suite.id,
    label: suite.label,
    ok: false,
    code: last?.code ?? 1,
    attempts: attempt + 1,
    durationMs: Date.now() - startedAt,
    rateLimited: Boolean(last?.rateLimited),
  };
}

/**
 * Bounded async pool: at most `concurrency` suites in flight.
 * Staggers starts to avoid a thundering herd on the API.
 */
async function runPool(suites, opts, childArgs) {
  const results = [];
  let nextIndex = 0;
  let active = 0;
  let stopQueueing = false;
  let lastStartAt = 0;

  return new Promise((resolve) => {
    const maybeDone = () => {
      if (active === 0 && (stopQueueing || nextIndex >= suites.length)) {
        resolve(results);
      }
    };

    const launchNext = async () => {
      while (!stopQueueing && active < opts.concurrency && nextIndex < suites.length) {
        const suite = suites[nextIndex];
        nextIndex += 1;
        active += 1;

        const sinceLast = Date.now() - lastStartAt;
        if (lastStartAt > 0 && opts.staggerMs > 0 && sinceLast < opts.staggerMs) {
          await sleep(opts.staggerMs - sinceLast);
        }
        lastStartAt = Date.now();

        console.log(`→ start ${suite.id} (${suite.label})`);
        runSuiteWithRetries(suite, opts, childArgs)
          .then((result) => {
            results.push(result);
            const status = result.ok ? "PASS" : "FAIL";
            const rateNote = result.rateLimited ? " [rate-limited]" : "";
            console.log(
              `← ${status} ${result.id} in ${formatDuration(result.durationMs)} (attempts=${result.attempts})${rateNote}`,
            );
            if (!result.ok && opts.failFast) {
              stopQueueing = true;
              console.log("  fail-fast: not starting remaining suites");
            }
          })
          .finally(() => {
            active -= 1;
            void launchNext();
            maybeDone();
          });
      }
      maybeDone();
    };

    void launchNext();
  });
}

const opts = (() => {
  try {
    return parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(String(error?.message ?? error));
    printHelp();
    process.exit(1);
  }
})();

if (opts.help) {
  printHelp();
  process.exit(0);
}

if (opts.list) {
  for (const suite of SUITES) {
    console.log(`${suite.id.padEnd(18)} ${suite.script}  (${suite.label})`);
  }
  process.exit(0);
}

if (!opts.token) {
  console.error("Pass a temporary JWT as the first argument, or set EMSYS_TOKEN.");
  printHelp();
  process.exit(1);
}

if (!opts.companyId) {
  console.error("Company ID is empty. Pass --company <id> or set EMSYS_COMPANY_ID.");
  process.exit(1);
}

let suites;
try {
  suites = selectSuites(opts);
} catch (error) {
  console.error(String(error?.message ?? error));
  process.exit(1);
}

if (!suites.length) {
  console.error("No suites selected.");
  process.exit(1);
}

const childArgs = buildChildArgs(opts);
const wallStarted = Date.now();

console.log("EMSYS API smoke orchestrator");
console.log(`Suites:       ${suites.map((s) => s.id).join(", ")}`);
console.log(`Concurrency:  ${opts.concurrency}`);
console.log(`Stagger:      ${opts.staggerMs}ms`);
console.log(`Retries:      ${opts.retries} (backoff base ${opts.retryDelayMs}ms)`);
console.log(`Company:      ${opts.companyId}`);
console.log(`Base:         ${opts.baseUrl}`);
console.log(`Auth:         ${opts.useBearer ? "Bearer JWT" : "raw JWT"}`);
console.log(`CRUD:         ${opts.skipCrud ? "skipped" : "enabled"}`);
console.log(`Fail-fast:    ${opts.failFast ? "yes" : "no"}`);
console.log("");

const results = await runPool(suites, opts, childArgs);
const ordered = suites.map((suite) => results.find((r) => r.id === suite.id)).filter(Boolean);
const passed = ordered.filter((r) => r.ok);
const failed = ordered.filter((r) => !r.ok);
const skipped = suites.length - ordered.length;

console.log("\n=== ORCHESTRATOR SUMMARY ===");
console.log(`Wall time:  ${formatDuration(Date.now() - wallStarted)}`);
console.log(`Passed:     ${passed.length}/${suites.length}`);
console.log(`Failed:     ${failed.length}`);
if (skipped) console.log(`Not run:    ${skipped} (fail-fast)`);

for (const result of ordered) {
  const mark = result.ok ? "✓" : "✗";
  const rate = result.rateLimited ? " rate-limited" : "";
  console.log(
    `  ${mark} ${result.id.padEnd(16)} ${formatDuration(result.durationMs).padStart(7)}  attempts=${result.attempts}${rate}`,
  );
}

if (failed.length) {
  console.log("\nFailed suites:");
  for (const result of failed) {
    console.log(`  - ${result.id} (exit ${result.code})`);
  }
  process.exit(1);
}

console.log("\nAll selected API smoke suites passed.");
