#!/usr/bin/env node
/**
 * Smoke-test Invoice policies API endpoints used by the portal.
 *
 * Covers:
 *   GET  /invoice-policies, /invoice-policies/active
 *   POST /invoice-policies/search
 *   POST /invoice-policies
 *   GET|PUT|DELETE /invoice-policies/{id}
 *
 * The throwaway policy is created inactive (never prints on invoices) and is
 * always deleted.
 *
 * Usage:
 *   node scripts/test-invoice-policies-api.mjs '<jwt>' [--skip-crud]
 */
import { createApiSuite } from "./lib/api-suite.mjs";
import { createSeeder } from "./lib/seed-records.mjs";

const RESOURCE = "/invoice-policies";
const suite = createApiSuite({ title: "Invoice policies API smoke test" });
const { request, check, note, extractId, rowsOf, stamp } = suite;

suite.banner();

const seeder = createSeeder(suite);
const seeds = suite.opts.skipCrud
  ? []
  : await seeder.seed({
      label: "policy",
      path: RESOURCE,
      body: (index) => ({
        title: `ZZ_PROBE_SEED_POLICY_${stamp}_${index}`,
        body: `Throwaway seed policy ${index} created by the API smoke test.`,
        sortOrder: 990 + index,
        active: false,
      }),
      lookup: (body) => [{ field: "title", operator: "eq", value: body.title }],
    });

console.log("\n=== List / read ===");
const list = await suite.listOrExit(`${RESOURCE}?page=1&limit=40&sort=sortOrder:asc,title:asc`);
await request("GET", `${RESOURCE}/active`).then((res) =>
  check(`GET ${RESOURCE}/active`, res, (r) => `items=${Array.isArray(r.json?.data) ? r.json.data.length : 0}`),
);
const sample = seeds[0] ?? rowsOf(list)[0];
if (sample?.id != null) {
  check(`GET ${RESOURCE}/${sample.id}`, await request("GET", `${RESOURCE}/${sample.id}`), (r) => `title=${r.json?.data?.title ?? "?"}`);
} else {
  note("No existing invoice policies; read-by-id runs after create.");
}

console.log("\n=== Search ===");
check(
  `POST ${RESOURCE}/search title contains`,
  await request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, {
    filters: [{ field: "title", operator: "contains", value: String(sample?.title ?? "a").slice(0, 3) }],
  }),
  suite.summarizeList,
);
check(
  `POST ${RESOURCE}/search active eq true`,
  await request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, {
    filters: [{ field: "active", operator: "eq", value: true }],
  }),
  suite.summarizeList,
);

let createdId = null;
if (!suite.opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const body = { title: `ZZ_PROBE_POLICY_${stamp}`, body: "Throwaway policy created by the API smoke test.", sortOrder: 999, active: false };
  const create = await request("POST", RESOURCE, body);
  createdId = extractId(create);
  if (check(`POST ${RESOURCE}`, create, `id=${createdId}`) && createdId != null) {
    check(`GET ${RESOURCE}/${createdId} after create`, await request("GET", `${RESOURCE}/${createdId}`), (r) =>
      r.json?.data?.active === false ? "active=false" : `active=${r.json?.data?.active}`,
    );
    const update = await request("PUT", `${RESOURCE}/${createdId}`, { ...body, title: `${body.title}_UPD`, sortOrder: 998 });
    check(`PUT ${RESOURCE}/${createdId}`, update, "title + sortOrder");
    const reread = await request("GET", `${RESOURCE}/${createdId}`);
    if (reread.json?.data?.title === `${body.title}_UPD`) suite.pass("update persisted", `sortOrder=${reread.json?.data?.sortOrder}`);
    else suite.fail("update persisted", reread.status, `title=${reread.json?.data?.title}`);
  }
}

if (createdId != null) {
  console.log("\n=== Cleanup ===");
  check(`DELETE ${RESOURCE}/${createdId}`, await request("DELETE", `${RESOURCE}/${createdId}`));
  const gone = await request("GET", `${RESOURCE}/${createdId}`);
  if (gone.status === 404) suite.pass(`GET ${RESOURCE}/${createdId} after delete`, "404 as expected");
  else suite.fail(`GET ${RESOURCE}/${createdId} after delete`, gone.status, "expected 404");
}

await seeder.verifyListed();
await seeder.cleanup();

suite.finish("All invoice policy checks passed.");
