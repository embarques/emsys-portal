import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "../..");

// Compile the feature modules with only the central HTTP boundary replaced.
function loadFeature(relative, apiClient = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    function localRequire(specifier) {
      if (specifier === "@/lib/api/client") return { apiClient };
      if (specifier.startsWith("@/") || specifier.startsWith(".")) {
        const target = specifier.startsWith("@/") ? path.join(root, "src", specifier.slice(2)) : path.resolve(path.dirname(filename), specifier);
        if (target.endsWith(".json")) return JSON.parse(fs.readFileSync(target, "utf8"));
        return load(fs.existsSync(`${target}.ts`) ? `${target}.ts` : path.join(target, "index.ts"));
      }
      return require(specifier);
    }
    new Function("require", "module", "exports", source)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load(path.join(root, relative));
}

const { buildComplaintDetails, buildComplaintIntakeRequest } = loadFeature("src/lib/complaints/utils/intake.ts");
const { complaintSchema } = loadFeature("src/lib/complaints/schemas/complaint.schema.ts");

const delivery = {
  key: "delivery",
  label: "Delivery",
  active: true,
  defaultSeverity: "normal",
  responseSlaHours: 24,
  resolutionSlaHours: 96,
  detailsSchema: {
    type: "object",
    required: ["order_ref", "issue"],
    properties: {
      order_ref: { type: "string" },
      issue: { type: "string", enum: ["late", "missing", "damaged"] },
      expected_date: { type: "string", format: "date" },
      photos: { type: "array", items: { type: "string" } },
      wait_minutes: { type: "integer" },
      refund_requested: { type: "boolean" },
    },
  },
};

const intakeRow = {
  id: "8b0c5a5e-0000-4000-8000-000000000001",
  number: "C-2026-00007",
  complaintNumber: "C-2026-00007",
  version: 3,
  callerName: "Ana Pérez",
  callerPhone: "2015551234",
  category: "delivery",
  subject: "Box arrived damaged",
  title: "Box arrived damaged",
  description: "Corner crushed",
  severity: "high",
  priority: "",
  status: "in_progress",
  pending: true,
  details: { order_ref: "INV-77", issue: "damaged" },
  assigneeId: 12,
  targets: [{ kind: "invoice", label: "INV-77" }],
  events: [{ id: "e1", type: "status_change", actorId: 4, toValue: "open", createdAt: "2026-11-13T15:00:00Z" }],
  resolution: null,
  reopenedCount: 0,
  createdAt: "2026-11-13T15:00:00Z",
  updatedAt: "2026-11-13T16:00:00Z",
  resolvedAt: null,
  closedAt: null,
};

test("category details are converted to the JSON types the API schema validates", () => {
  const { details, errors } = buildComplaintDetails(delivery, {
    order_ref: "  INV-77 ",
    issue: "damaged",
    expected_date: "2026-11-10",
    photos: "https://a.example/1.jpg, https://a.example/2.jpg,",
    wait_minutes: "45",
    refund_requested: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(details, {
    order_ref: "INV-77",
    issue: "damaged",
    expected_date: "2026-11-10",
    photos: ["https://a.example/1.jpg", "https://a.example/2.jpg"],
    wait_minutes: 45,
    refund_requested: true,
  });
});

test("empty optional details are omitted because the API rejects blank values", () => {
  const { details, errors } = buildComplaintDetails(delivery, {
    order_ref: "INV-1",
    issue: "late",
    expected_date: "",
    photos: " , ",
    wait_minutes: "",
    refund_requested: false,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(details, { order_ref: "INV-1", issue: "late" });
});

test("missing required details and invalid values are reported per field", () => {
  const { errors } = buildComplaintDetails(delivery, { issue: "lost", wait_minutes: "2.5" });
  const byKey = Object.fromEntries(errors.map((error) => [error.key, error.message]));
  assert.equal(byKey.order_ref, "common.validation.required");
  assert.equal(byKey.issue, "complaints.validation.invalidOption");
  assert.equal(byKey.wait_minutes, "complaints.validation.wholeNumber");
});

test("intake request sends numeric employee IDs and typed labels, omitting optional blanks", () => {
  const request = buildComplaintIntakeRequest(
    {
      callerName: " Ana Pérez ",
      callerPhone: "2015551234",
      callerEmail: "  ",
      category: "delivery",
      severity: "",
      subject: " Box damaged ",
      description: " Corner crushed ",
      details: {},
      targets: [
        { kind: "employee", employeeId: "17", label: "", note: "" },
        { kind: "invoice", employeeId: "", label: " INV-77 ", note: " second box " },
      ],
    },
    { order_ref: "INV-77", issue: "damaged" },
  );
  assert.deepEqual(request, {
    callerName: "Ana Pérez",
    callerPhone: "2015551234",
    category: "delivery",
    subject: "Box damaged",
    description: "Corner crushed",
    details: { order_ref: "INV-77", issue: "damaged" },
    targets: [
      { kind: "employee", employeeId: 17 },
      { kind: "invoice", label: "INV-77", note: "second box" },
    ],
  });
});

test("legacy linked-origin complaints normalize to the shared row shape", () => {
  const legacy = complaintSchema.parse({
    id: "legacy-1",
    complaintNumber: "CMP-0009",
    version: 1,
    title: "Driver was late",
    description: "Two hours late",
    priority: "high",
    status: "open",
    resolution: { type: "apology", description: "", resolvedAt: "0001-01-01T00:00:00Z" },
    createdAt: "2026-01-02T00:00:00Z",
    resolvedAt: "0001-01-01T00:00:00Z",
  });
  assert.equal(legacy.number, "CMP-0009");
  assert.equal(legacy.subject, "Driver was late");
  assert.equal(legacy.severity, "high");
  assert.equal(legacy.category, "");
  assert.equal(legacy.resolution, null);
  assert.equal(legacy.resolvedAt, "");
  assert.deepEqual(legacy.targets, []);
});

function createClient(total = 1) {
  const calls = [];
  const page = (url) => {
    const params = new URL(url, "http://x").searchParams;
    const limit = Number(params.get("limit") ?? 1);
    const pageNumber = Number(params.get("page") ?? 1);
    const remaining = Math.max(0, total - (pageNumber - 1) * limit);
    const data = Array.from({ length: Math.min(limit, remaining) }, (_, index) => ({
      ...intakeRow,
      id: `row-${(pageNumber - 1) * limit + index}`,
    }));
    // Mirrors the API's legacy subtotal formula: total − limit × page.
    return { success: true, data, total, subtotal: Math.max(0, total - limit * pageNumber), page: pageNumber, resultsPerPage: limit };
  };
  return {
    calls,
    get: async (url, config) => {
      calls.push({ method: "GET", url, config });
      return url.includes("/complaints?") ? page(url) : { success: true, data: intakeRow };
    },
    post: async (url, body, config) => {
      calls.push({ method: "POST", url, body, config });
      return url.includes("/search") ? page(url) : { success: true, data: intakeRow };
    },
    patch: async (url, body, config) => {
      calls.push({ method: "PATCH", url, body, config });
      return { success: true, data: { ...intakeRow, version: intakeRow.version + 1, ...body } };
    },
  };
}

test("unresolved badge count searches pending complaints and reads total, not the legacy subtotal", async () => {
  const client = createClient(5);
  const api = loadFeature("src/lib/complaints/api/complaints-api.ts", client);
  assert.equal(await api.fetchUnresolvedComplaintCount(), 5);
  assert.equal(client.calls.length, 1);
  const [call] = client.calls;
  assert.equal(call.method, "POST");
  assert.match(call.url, /^\/complaints\/search\?/);
  assert.match(JSON.stringify(call.body), /"field":"pending","operator":"eq","value":true/);
});

test("table pages above the API's 100-row cap are assembled from sequential API pages", async () => {
  const client = createClient(250);
  const api = loadFeature("src/lib/complaints/api/complaints-api.ts", client);
  const result = await api.fetchComplaintsPage({ page: 1, limit: 200, sort: "createdAt:desc" });
  assert.equal(result.items.length, 200);
  assert.equal(result.total, 250);
  assert.equal(result.items[0].id, "row-0");
  assert.equal(result.items[199].id, "row-199");
  assert.equal(client.calls.length, 2);
  for (const call of client.calls) assert.match(call.url, /limit=100/);
});

test("the unresolved scope is applied to every table request", async () => {
  const client = createClient(3);
  const api = loadFeature("src/lib/complaints/api/complaints-api.ts", client);
  const result = await api.fetchComplaintsPage({ page: 1, limit: 50, sort: "createdAt:desc" }, { unresolvedOnly: true });
  assert.equal(result.total, 3);
  assert.equal(client.calls[0].method, "POST");
  assert.match(JSON.stringify(client.calls[0].body), /"pending"/);
});

test("workflow commands send the loaded version in If-Match", async () => {
  const client = createClient();
  const api = loadFeature("src/lib/complaints/api/complaints-api.ts", client);
  const updated = await api.patchComplaint(intakeRow.id, 3, { status: "pending_customer" });
  const [call] = client.calls;
  assert.equal(call.method, "PATCH");
  assert.equal(call.url, `/complaints/${intakeRow.id}`);
  assert.deepEqual(call.body, { status: "pending_customer" });
  assert.equal(call.config.headers["If-Match"], '"3"');
  assert.equal(updated.version, 4);
});

test("target replacement and attachments send the loaded version and API payload shapes", async () => {
  const calls = [];
  const client = {
    put: async (url, body, config) => { calls.push({ method: "PUT", url, body, config }); return { success: true, data: { ...intakeRow, version: 4 } }; },
    post: async (url, body, config) => { calls.push({ method: "POST", url, body, config }); return { success: true, data: { ...intakeRow, version: 5 } }; },
  };
  const api = loadFeature("src/lib/complaints/api/complaints-api.ts", client);
  const { buildComplaintTargets, buildComplaintAttachmentRequest, complaintTargetsToFormValues } = loadFeature("src/lib/complaints/utils/intake.ts");
  const targets = buildComplaintTargets([
    { kind: "employee", employeeId: "17", label: "", note: " " },
    { kind: "invoice", employeeId: "", label: " INV-9 ", note: "Wrong box" },
  ]);
  assert.deepEqual(targets, [{ kind: "employee", employeeId: 17 }, { kind: "invoice", label: "INV-9", note: "Wrong box" }]);
  assert.deepEqual(buildComplaintTargets(complaintTargetsToFormValues(targets)), targets);

  await api.replaceComplaintTargets(intakeRow.id, 3, targets);
  assert.equal(calls[0].url, `/complaints/${intakeRow.id}/targets`);
  assert.deepEqual(calls[0].body, { targets });
  assert.equal(calls[0].config.headers["If-Match"], '"3"');

  const attachment = buildComplaintAttachmentRequest({ fileUrl: " https://files.example/a.pdf ", mimeType: "application/pdf", sizeMb: "1.5" });
  assert.deepEqual(attachment, { fileUrl: "https://files.example/a.pdf", mimeType: "application/pdf", sizeBytes: 1572864 });
  await api.addComplaintAttachment(intakeRow.id, 4, attachment);
  assert.equal(calls[1].url, `/complaints/${intakeRow.id}/attachments`);
  assert.equal(calls[1].config.headers["If-Match"], '"4"');
});

test("attachment form accepts only HTTPS links without credentials and sizes up to 25 MB", () => {
  const { complaintAttachmentFormSchema } = loadFeature("src/lib/complaints/schemas/complaint.schema.ts");
  const valid = { fileUrl: "https://files.example/a.pdf", mimeType: "application/pdf", sizeMb: "25" };
  assert.equal(complaintAttachmentFormSchema.safeParse(valid).success, true);
  for (const change of [{ fileUrl: "http://files.example/a.pdf" }, { fileUrl: "https://user:pw@files.example/a" }, { sizeMb: "0" }, { sizeMb: "25.5" }, { mimeType: "" }]) {
    assert.equal(complaintAttachmentFormSchema.safeParse({ ...valid, ...change }).success, false, JSON.stringify(change));
  }
});

test("insights and inbox responses normalize and use the documented endpoints", async () => {
  const calls = [];
  const client = {
    get: async (url, config) => {
      calls.push({ url, config });
      if (url.endsWith("/insights")) {
        return { success: true, data: { categories: [{ key: "delivery", count: 4 }], employees: [{ key: 17, count: 2 }], summary: [{ total: 8, reopened: 2, averageResolutionHours: null }] } };
      }
      return { success: true, data: [{ id: "c-1", number: "C-2026-00001", subject: "Late", severity: "urgent", notifiedAt: "2026-11-13T12:00:00Z" }] };
    },
    put: async (url) => { calls.push({ url }); return { success: true, data: null }; },
  };
  const api = loadFeature("src/lib/complaints/api/complaints-api.ts", client);
  const insights = await api.fetchComplaintInsights("2026-11-01", "2026-11-30");
  assert.deepEqual(calls[0].config.params, { from: "2026-11-01", to: "2026-11-30" });
  assert.deepEqual(insights, { categories: [{ key: "delivery", count: 4 }], employees: [{ key: "17", count: 2 }], total: 8, reopened: 2, averageResolutionHours: null });
  const [notification] = await api.fetchComplaintNotifications();
  assert.equal(calls[1].url, "/complaints/notifications");
  assert.equal(notification.severity, "urgent");
  await api.markComplaintNotificationRead("c-1");
  assert.equal(calls[2].url, "/complaints/notifications/c-1/read");
});

test("insight date ranges mirror the API's inclusive 365-day limit", () => {
  const { complaintInsightsRangeError, defaultComplaintInsightsRange } = loadFeature("src/lib/complaints/utils/insights.ts");
  assert.deepEqual(defaultComplaintInsightsRange(new Date("2026-11-14T15:00:00Z")), { from: "2026-11-01", to: "2026-11-14" });
  assert.equal(complaintInsightsRangeError("2026-01-01", "2026-12-31"), null);
  assert.equal(complaintInsightsRangeError("2026-11-02", "2026-11-01"), "complaints.insights.errors.order");
  assert.equal(complaintInsightsRangeError("2025-01-01", "2026-11-01"), "complaints.insights.errors.span");
  assert.equal(complaintInsightsRangeError("", "2026-11-01"), "complaints.insights.errors.dates");
});
