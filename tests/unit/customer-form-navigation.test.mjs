import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileCustomerFormHref } from "../../src/lib/customers/customer-form-navigation.ts";

test("customer editing retains the originating appointment route and query", () => {
  assert.equal(
    buildMobileCustomerFormHref("/appointments?search=Ana+Lopez&page=2", "edit-123"),
    "/appointments?search=Ana+Lopez&page=2&customer-form=edit-123",
  );
});

test("customer editing works from a directory without query parameters", () => {
  assert.equal(buildMobileCustomerFormHref("/customers", "edit-123"), "/customers?customer-form=edit-123");
});

test("opening another customer replaces the navigation parameter without duplicating it", () => {
  assert.equal(
    buildMobileCustomerFormHref("/invoices?customer-form=old&step=2", "new"),
    "/invoices?customer-form=new&step=2",
  );
});
