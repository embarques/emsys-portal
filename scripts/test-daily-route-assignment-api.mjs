#!/usr/bin/env node
/** Isolated catalog lifecycle checks. Read-only unless --write-probes is explicit. */
import { randomUUID } from "node:crypto";
import { createApiSuite } from "./lib/api-suite.mjs";

const suite = createApiSuite({
  title: "Daily-route assignment lifecycle",
  options: { writeProbes: { flag: "--write-probes" } },
  usage: "  --write-probes    Create and remove isolated fixtures in an approved test company\n",
});
const { request, ok, check, pass, fail, note, rowsOf } = suite;
const writesEnabled = suite.opts.writeProbes && !suite.opts.skipCrud;
suite.opts.skipCrud = !writesEnabled;
suite.banner();
const routes = await request("POST", "/vehicle-routes/search?page=1&limit=20&offset=0", {
  sort: [{ field: "date", direction: "desc" }],
});
check("Bounded route lookup", routes);

if (writesEnabled && ok(routes)) {
  // Reuse references only; never update the sampled business route or its work.
  const sample = rowsOf(routes).find(row => row.routeType === "delivery" && row.branch?.id &&
    row.vehicle?.id && row.container?.id && row.driver?.id && row.supervisor?.id);
  if (!sample) fail("Fixture prerequisites", 0, "No valid delivery configuration in the bounded sample; no writes performed");
  else await verifyLifecycle(sample);
} else note("No lifecycle mutations performed. Supply --write-probes only for an approved test company.");

note("Catalog checks do not establish invoice-embedded synchronization, delivery completion races, assigned-only permission isolation or server business-midnight behavior.");
suite.finish("Catalog lifecycle checks complete; see docs/daily-route-assignment-api-contract.md for remaining acceptance.");

async function verifyLifecycle(sample) {
  const cleanup = [];
  function expect(label, condition, response) {
    if (!condition) throw new Error(`${label}: HTTP ${response?.status ?? 0}`);
    pass(label);
  }
  async function create(path, payload) {
    const response = await request("POST", path, payload);
    const id = response.json?.data?.id;
    if (id != null) cleanup.push({ path: `${path}/${id}` });
    expect(`Create fixture ${path}`, ok(response) && id != null, response);
    return { ...response.json.data, id };
  }
  async function getBarcode(id) {
    const response = await request("GET", `/barcodes/${id}`);
    expect("Read fixture barcode", ok(response) && response.json?.data?.id === id, response);
    return response.json.data;
  }
  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 2);
  const dates = [future.toISOString().slice(0, 10) + "T00:00:00Z"];
  future.setUTCDate(future.getUTCDate() + 1);
  dates.push(future.toISOString().slice(0, 10) + "T00:00:00Z");
  const baseRoute = {
    active: true, routeType: "delivery", branch: sample.branch, vehicle: sample.vehicle,
    supervisor: sample.supervisor, driver: sample.driver, helpers: sample.helpers ?? [],
    employees: sample.employees, container: sample.container, rate: sample.rate,
  };
  const prefix = `CODEX-ROUTE-${randomUUID()}`;
  try {
    const source = await create("/vehicle-routes", { ...baseRoute, date: dates[0] });
    const destination = await create("/vehicle-routes", { ...baseRoute, date: dates[1] });
    const sourceRef = { id: source.id, name: source.name };
    const destinationRef = { id: destination.id, name: destination.name };
    const baseBarcode = { status: { id: 3, name: "EN TRANSITO" }, container: sample.container, route: sourceRef };
    const a = await create("/barcodes", { ...baseBarcode, number: `${prefix}-A` });
    const b = await create("/barcodes", { ...baseBarcode, number: `${prefix}-B` });
    expect("Source assignment persisted", (await getBarcode(a.id)).route?.id === source.id);
    const age = await request("PUT", `/vehicle-routes/${source.id}`, { ...baseRoute, date: "2000-01-01T00:00:00Z" });
    expect("Age only the fixture source route", ok(age), age);

    const removeOld = await request("PUT", `/barcodes/${b.id}`, { ...baseBarcode, number: b.number, route: null });
    expect("Remove unfinished work from an old source", ok(removeOld), removeOld);
    const removed = await getBarcode(b.id);
    expect("Removal clears route and preserves status/container", !removed.route?.id &&
      removed.status?.id === baseBarcode.status.id && removed.container?.id === sample.container.id);

    const move = await request("PUT", `/barcodes/${a.id}`, { ...baseBarcode, number: a.number, route: destinationRef });
    expect("Move unfinished work off an old source", ok(move), move);
    expect("Destination persisted", (await getBarcode(a.id)).route?.id === destination.id);
    const omitted = await request("PUT", `/barcodes/${a.id}`, { number: a.number, status: baseBarcode.status, container: sample.container });
    expect("Omitted route preserves assignment", ok(omitted) && (await getBarcode(a.id)).route?.id === destination.id, omitted);
    const old = await request("PUT", `/barcodes/${a.id}`, { ...baseBarcode, number: a.number });
    expect("Past destination rejected without changing assignment", old.status === 400 && (await getBarcode(a.id)).route?.id === destination.id, old);
    const remove = await request("PUT", `/barcodes/${a.id}`, { ...baseBarcode, number: a.number, route: null });
    expect("Explicit null clears assigned route", ok(remove) && !(await getBarcode(a.id)).route?.id, remove);
    const repeat = await request("PUT", `/barcodes/${a.id}`, { ...baseBarcode, number: a.number, route: null });
    expect("Repeated removal remains unassigned", ok(repeat) && !(await getBarcode(a.id)).route?.id, repeat);
  } catch (error) {
    fail("Catalog lifecycle", 0, error.message);
  } finally {
    for (const { path } of cleanup.reverse()) {
      const deleted = await request("DELETE", path);
      const absent = await request("GET", path);
      if (ok(deleted) && absent.status === 404) pass(`Cleanup verified ${path}`);
      else fail(`Cleanup requires attention ${path}`, deleted.status, `GET after delete: ${absent.status}`);
    }
  }
}
