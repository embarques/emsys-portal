#!/usr/bin/env node
/**
 * Smoke-test Chart of accounts API endpoints used by the portal.
 *
 * Covers:
 *   GET  /chart-accounts
 *   POST /chart-accounts/search
 *   POST /chart-accounts
 *   GET|PUT|DELETE /chart-accounts/{id}
 *
 * The throwaway account is an unused EXPENSE account (no journal references),
 * so it can always be deleted.
 *
 * Usage:
 *   node scripts/test-chart-accounts-api.mjs '<jwt>' [--skip-crud]
 */
import { createApiSuite } from "./lib/api-suite.mjs";
import { createSeeder } from "./lib/seed-records.mjs";

const RESOURCE = "/chart-accounts";
const suite = createApiSuite({ title: "Chart of accounts API smoke test" });
const { request, check, note, extractId, rowsOf, stamp, ok } = suite;

suite.banner();

const seeder = createSeeder(suite);
const seeds = suite.opts.skipCrud
  ? []
  : await seeder.seed({
      label: "account",
      path: RESOURCE,
      body: (index) => {
        const name = `ZZ_PROBE_SEED_ACCOUNT_${stamp}_${index}`;
        return { name, displayName: name, type: "EXPENSE", description: `Throwaway seed account ${index}.` };
      },
      lookup: (body) => [{ field: "displayName", operator: "eq", value: body.displayName }],
    });

console.log("\n=== List / read ===");
const list = await suite.listOrExit(`${RESOURCE}?page=1&limit=40&offset=0&sort=displayName:asc`);
const sample = seeds[0] ?? rowsOf(list)[0];
if (sample?.id != null) {
  check(`GET ${RESOURCE}/${sample.id}`, await request("GET", `${RESOURCE}/${sample.id}`), (r) => `displayName=${r.json?.data?.displayName ?? "?"}`);
} else {
  note("No existing chart accounts; read-by-id runs after create.");
}

console.log("\n=== Search ===");
const search = (label, filters) =>
  request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, { filters }).then((res) => check(label, res, suite.summarizeList));
await search(`POST ${RESOURCE}/search bar OR`, [
  { operator: "or", filters: ["displayName", "name", "branch.code"].map((field) => ({ field, operator: "contains", value: "a" })) },
]);
if (sample?.type) await search(`search type eq ${sample.type}`, [{ field: "type", operator: "eq", value: sample.type }]);
if (sample?.id != null) await search(`search id eq ${sample.id} (number)`, [{ field: "id", operator: "eq", value: Number(sample.id) }]);

let createdId = null;
if (!suite.opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const name = `ZZ_PROBE_ACCOUNT_${stamp}`;
  const body = { name, displayName: name, type: "EXPENSE", description: "Throwaway account created by the API smoke test." };
  const create = await request("POST", RESOURCE, body);
  createdId = extractId(create);
  if (ok(create) && createdId == null) {
    const found = await request("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
      filters: [{ field: "displayName", operator: "eq", value: name }],
    });
    createdId = rowsOf(found)[0]?.id ?? null;
  }
  if (check(`POST ${RESOURCE}`, create, `id=${createdId} type=EXPENSE`) && createdId != null) {
    check(`GET ${RESOURCE}/${createdId} after create`, await request("GET", `${RESOURCE}/${createdId}`));
    const updatedName = `${name}_UPD`;
    check(
      `PUT ${RESOURCE}/${createdId}`,
      await request("PUT", `${RESOURCE}/${createdId}`, { ...body, id: createdId, name: updatedName, displayName: updatedName }),
      `displayName=${updatedName}`,
    );
    const reread = await request("GET", `${RESOURCE}/${createdId}`);
    if (reread.json?.data?.displayName === updatedName) suite.pass("update persisted");
    else suite.fail("update persisted", reread.status, `displayName=${reread.json?.data?.displayName}`);
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

suite.finish("All chart of accounts checks passed.");
