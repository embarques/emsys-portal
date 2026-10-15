import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import ts from "typescript";

function loadFeature(file) {
  const source = ts.transpileModule(fs.readFileSync(new URL(`../../src/lib/orders/${file}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (name.endsWith("orders.json")) return JSON.parse(fs.readFileSync(new URL(`../../src/${name.slice(2)}`, import.meta.url), "utf8"));
    if (name === "./types") return types;
    return {};
  };
  new Function("require", "module", "exports", source)(require, module, module.exports);
  return module.exports;
}
const types = loadFeature("types");
const display = loadFeature("display");

test("Spanish entries compile purpose and item labels in Spanish without translating notes", () => {
  const comment = { language: "es", purpose: "PICKUP", itemType: "box", customItem: "", quantity: "1", description: "" };
  assert.equal(types.formatOrderCommentSentence(comment), "Recoger 1 Caja.");
  assert.equal(types.formatOrderCommentSentence({ ...comment, purpose: "TAKE", itemType: "barrel" }), "Llevar 1 Barril.");
  assert.equal(types.formatOrderCommentSentence({ ...comment, purpose: "ESTIMATE", description: "Hacer un estimado de una TV" }), "Estimado Hacer un estimado de una TV.");
});

test("stored Spanish and English comments retain their language through editing", () => {
  for (const description of ["Estimado Hacer un estimado.", "Estimate Call after noon."]) {
    const stored = { purpose: "estimate", unit: "", quantity: 0, description };
    assert.equal(types.formatOrderCommentSentence(types.orderCommentToFormValues(stored)), description);
    assert.equal(display.formatPickupCommentSummary(stored), description);
  }
});

test("summaries preserve stored text verbatim instead of rebuilding English sentences", () => {
  const description = "Recoger 1 caja; llamar al llegar";
  assert.equal(display.formatOrderCommentsSummary({ comments: [{ purpose: "pickup", unit: "box", quantity: 1, description }] }), description);
});

test("typing in Spanish replaces a stale English draft language before serialization", () => {
  const draft = { ...types.createEmptyOrderComment(), language: "en" };
  const entered = types.updateOrderComment(draft, { purpose: "TAKE", itemType: "box", quantity: "2" }, "es");
  assert.equal(types.formatOrderCommentSentence(entered), "Llevar 2 Caja.");
  for (const [purpose, expected] of [["PAYMENT", "Pago."], ["ESTIMATE", "Estimado."], ["OTHER", "Otro."]]) {
    assert.equal(types.formatOrderCommentSentence(types.updateOrderComment(draft, { purpose }, "es")), expected);
  }
  const existing = types.orderCommentToFormValues({ purpose: "pickup", unit: "box", quantity: 1, description: "Pickup 1 Box." });
  assert.equal(types.formatOrderCommentSentence(types.updateOrderComment(existing, { quantity: "2" }, "es")), "Recoger 2 Caja.");
});

test("pickup dates preserve October 15 when the API includes UTC midnight", () => {
  const previousTimezone = process.env.TZ;
  try {
    for (const timezone of ["America/New_York", "America/Los_Angeles", "Asia/Tokyo"]) {
      process.env.TZ = timezone;
      for (const date of ["2026-10-15", "2026-10-15T00:00:00Z"]) {
        assert.equal(display.formatOrderCalendarDate(date), "2026-10-15");
        assert.equal(display.formatOrderDate(date), "Oct 15, 2026");
        assert.equal(display.formatOrderDateWithWeekday(date), "Thursday October 15 2026");
      }
    }
    assert.equal(display.formatOrderCalendarDate(""), "—");
    assert.equal(display.formatOrderCalendarDate("invalid"), "—");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
