/**
 * Seeds throwaway `ZZ_PROBE_SEED_*` records before a suite lists/searches, so
 * list, read and search checks always run against known data, then deletes
 * them at the end.
 *
 * Usage inside a suite (after its request/ok/pass/fail helpers exist):
 *
 *   const seeder = createSeeder({ request, ok, pass, fail, errDetail });
 *   const seeds = await seeder.seed({
 *     label: "vehicle",
 *     path: "/vehicles",
 *     body: (index) => ({ name: `ZZ_PROBE_SEED_VEHICLE_${stamp}_${index}`, ... }),
 *     // Filters that find the seed via /search; `id` is null before the create
 *     // response is resolved (return null then if the lookup needs it).
 *     lookup: (body, id) => [{ field: "name", operator: "eq", value: body.name }],
 *   });
 *   const sample = seeds[0] ?? firstOf(list);
 *   ...
 *   await seeder.verifyListed();   // each seed is findable through /search
 *   ...
 *   await seeder.cleanup();        // before the summary
 */

function idOf(json) {
  const data = json?.data;
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

function rowsOf(json) {
  const data = json?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export function createSeeder({ request, ok, pass, fail, errDetail }) {
  /** @type {{ label: string, path: string, id: string|number, lookup?: object[], searchPath: string }[]} */
  const seeded = [];

  async function findByLookup(searchPath, lookup) {
    const res = await request("POST", `${searchPath}?page=1&limit=5&offset=0`, { operator: "and", filters: lookup });
    return { res, rows: ok(res) ? rowsOf(res.json) : [] };
  }

  /**
   * Creates `count` records (default 2) and returns their GET /{id} payloads.
   * Exits on 401/403 so a stale token fails fast before anything else runs.
   */
  async function seed({ label, path, count = 2, body, lookup, searchPath = `${path}/search`, readPath = path }) {
    console.log(`=== Seed: ${count} throwaway ${label}${count === 1 ? "" : "s"} ===`);
    const records = [];
    for (let index = 1; index <= count; index += 1) {
      const payload = await body(index);
      const create = await request("POST", path, payload);
      if (create.status === 401 || create.status === 403) {
        fail(`seed POST ${path} (auth check)`, create.status, errDetail(create));
        console.log("\nAuth failed. Refresh the temporary token and try again.");
        process.exit(1);
      }
      let id = idOf(create.json);
      const preIdFilters = lookup ? lookup(payload, null) : null;
      if (ok(create) && id == null && preIdFilters) {
        id = (await findByLookup(searchPath, preIdFilters)).rows[0]?.id ?? null;
      }
      if (!ok(create) || id == null) {
        fail(`seed POST ${path} #${index}`, create.status, errDetail(create) || "created without a resolvable id");
        continue;
      }
      const filters = lookup ? lookup(payload, id) : null;
      seeded.push({ label, path, id, lookup: filters ?? undefined, searchPath });
      const read = await request("GET", `${readPath}/${id}`);
      const record = read.json?.data && typeof read.json.data === "object" ? read.json.data : { ...payload, id };
      records.push(record);
      pass(`seed POST ${path} #${index}`, `id=${id}`);
    }
    return records;
  }

  /** Confirms every seed is returned by its resource search (proves list/search see new data). */
  async function verifyListed() {
    for (const entry of seeded) {
      if (!entry.lookup) continue;
      const { res, rows } = await findByLookup(entry.searchPath, entry.lookup);
      const found = rows.some((row) => String(row.id ?? row._id) === String(entry.id));
      if (found) pass(`seed ${entry.label} ${entry.id} found via ${entry.searchPath}`);
      else fail(`seed ${entry.label} ${entry.id} found via ${entry.searchPath}`, res.status, ok(res) ? "not in results" : errDetail(res));
    }
  }

  /** Deletes seeds newest-first and confirms each is gone (404). */
  async function cleanup() {
    if (!seeded.length) return;
    console.log("\n=== Seed cleanup ===");
    for (const entry of [...seeded].reverse()) {
      const del = await request("DELETE", `${entry.path}/${entry.id}`);
      if (ok(del)) pass(`seed DELETE ${entry.path}/${entry.id}`);
      else fail(`seed DELETE ${entry.path}/${entry.id}`, del.status, errDetail(del));
      const gone = await request("GET", `${entry.path}/${entry.id}`);
      if (gone.status === 404) pass(`seed GET ${entry.path}/${entry.id} after delete`, "404 as expected");
      else fail(`seed GET ${entry.path}/${entry.id} after delete`, gone.status, "expected 404");
    }
    seeded.length = 0;
  }

  return { seed, verifyListed, cleanup, seeded };
}

/**
 * Pickups and invoices with inline sender/receiver parties make the API create
 * customer records that survive deleting the document. Removes this run's
 * (`ZZ_PROBE…<stamp>…` names) and confirms each is gone.
 */
export async function cleanupAutoCreatedCustomers({ request, ok, pass, fail, errDetail }, stamp) {
  const res = await request("POST", "/customers/search?page=1&limit=100&offset=0", {
    operator: "and",
    filters: [{ field: "name", operator: "contains", value: String(stamp) }],
  });
  const customers = (ok(res) ? rowsOf(res.json) : []).filter((customer) =>
    String(customer?.name ?? "").startsWith("ZZ_PROBE"),
  );
  if (!customers.length) return;
  console.log("\n=== Auto-created customer cleanup ===");
  for (const customer of customers) {
    const del = await request("DELETE", `/customers/${customer.id}`);
    if (ok(del)) pass(`DELETE /customers/${customer.id}`, customer.name);
    else fail(`DELETE /customers/${customer.id}`, del.status, errDetail(del));
  }
}
