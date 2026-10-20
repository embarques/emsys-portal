#!/usr/bin/env node
/**
 * Smoke-test tenant Users API endpoints used by the portal.
 *
 * Covers:
 *   GET  /users, /users/current
 *   POST /users/search
 *   POST /users
 *   GET|PUT|DELETE /users/{id}
 *
 * The throwaway tenant user is created inactive with a synthetic Firebase uid
 * and an `example.invalid` email, so nobody can sign in as it. It is always
 * deleted. Pass --user-uid if the API requires a real Firebase uid.
 *
 * Usage:
 *   node scripts/test-users-api.mjs '<jwt>' [--skip-crud] [--user-uid <uid>]
 */
import { createApiSuite } from "./lib/api-suite.mjs";
import { createSeeder } from "./lib/seed-records.mjs";

const RESOURCE = "/users";
const suite = createApiSuite({
  title: "Users API smoke test",
  usage: "  --user-uid <uid>   Firebase uid for the throwaway user (default: synthetic)\n",
  options: { userUid: { flag: "--user-uid", env: "EMSYS_TEST_USER_UID", takesValue: true } },
});
const { request, check, note, extractId, rowsOf, stamp, ok } = suite;

suite.banner();

let seedRefs = null;
async function roleAndBranch() {
  if (!seedRefs) {
    const [roles, branches] = await Promise.all([
      request("GET", "/roles?page=1&limit=1&offset=0"),
      request("GET", "/branches?page=1&limit=1&offset=0"),
    ]);
    seedRefs = { role: rowsOf(roles)[0] ?? null, branch: rowsOf(branches)[0] ?? null };
  }
  return seedRefs;
}

const seeder = createSeeder(suite);
const seeds = suite.opts.skipCrud
  ? []
  : await seeder.seed({
      label: "user",
      path: RESOURCE,
      body: async (index) => {
        const { role, branch } = await roleAndBranch();
        return {
          email: `zz-probe-seed-user-${stamp}-${index}@example.invalid`,
          name: `ZZ_PROBE_SEED_USER_${stamp}_${index}`,
          active: false,
          uid: `zz-probe-seed-uid-${stamp}-${index}`,
          branch: role && branch ? { id: branch.id, name: branch.name } : undefined,
          role: role && branch ? { id: role.id, name: role.name } : undefined,
          startTime: "",
          endTime: "",
        };
      },
      lookup: (body) => [{ field: "email", operator: "eq", value: body.email }],
    });

console.log("\n=== List / read ===");
const list = await suite.listOrExit(`${RESOURCE}?page=1&limit=40&offset=0&sort=name:asc`);
check("GET /users/current", await request("GET", "/users/current"), (r) => `id=${r.json?.data?.id ?? "?"}`);
const sample = seeds[0] ?? rowsOf(list)[0];
if (sample?.id != null) {
  check(`GET ${RESOURCE}/${sample.id}`, await request("GET", `${RESOURCE}/${sample.id}`), (r) => `email=${r.json?.data?.email ?? "?"}`);
}

console.log("\n=== Search ===");
const search = (label, filters) =>
  request("POST", `${RESOURCE}/search?page=1&limit=5&offset=0`, { filters }).then((res) => check(label, res, suite.summarizeList));
await search(`POST ${RESOURCE}/search email contains`, [{ field: "email", operator: "contains", value: String(sample?.email ?? "@").slice(0, 3) }]);
await search("search active eq true", [{ field: "active", operator: "eq", value: true }]);
if (sample?.role?.id != null) await search(`search role.id eq ${sample.role.id}`, [{ field: "role.id", operator: "eq", value: Number(sample.role.id) }]);

let createdId = null;
if (!suite.opts.skipCrud) {
  console.log("\n=== CRUD ===");
  const { role, branch } = await roleAndBranch();
  if (!role || !branch) {
    note("Skipping user CRUD: need at least one role and one branch.");
  } else {
    const email = `zz-probe-user-${stamp}@example.invalid`;
    const body = {
      email,
      name: `ZZ_PROBE_USER_${stamp}`,
      active: false,
      uid: suite.opts.userUid || `zz-probe-uid-${stamp}`,
      branch: { id: branch.id, name: branch.name },
      role: { id: role.id, name: role.name },
      startTime: "",
      endTime: "",
    };
    const create = await request("POST", RESOURCE, body);
    createdId = extractId(create);
    if (ok(create) && createdId == null) {
      const found = await request("POST", `${RESOURCE}/search?page=1&limit=1&offset=0`, {
        filters: [{ field: "email", operator: "eq", value: email }],
      });
      createdId = rowsOf(found)[0]?.id ?? null;
    }
    if (check(`POST ${RESOURCE}`, create, `id=${createdId} active=false`) && createdId != null) {
      check(`GET ${RESOURCE}/${createdId} after create`, await request("GET", `${RESOURCE}/${createdId}`));
      const updateBody = { ...body };
      delete updateBody.uid;
      const updatedName = `${body.name}_UPD`;
      check(`PUT ${RESOURCE}/${createdId}`, await request("PUT", `${RESOURCE}/${createdId}`, { ...updateBody, name: updatedName }), `name=${updatedName}`);
      const reread = await request("GET", `${RESOURCE}/${createdId}`);
      // The API omits `active` for inactive users.
      if (reread.json?.data?.name === updatedName && reread.json?.data?.active !== true) suite.pass("update persisted", "still inactive");
      else suite.fail("update persisted", reread.status, `name=${reread.json?.data?.name} active=${reread.json?.data?.active}`);
    } else if (!ok(create)) {
      note("If the API requires a real Firebase account, rerun with --user-uid <uid of a disposable Firebase user>.");
    }
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

suite.finish("All user checks passed.");
