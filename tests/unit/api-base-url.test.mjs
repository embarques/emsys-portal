import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { createPortalLoader } from "../../scripts/lib/portal-modules.mjs";

const require = createRequire(import.meta.url);
const api = createPortalLoader({ apiClient: {} })("src/lib/api/base-url.ts");
function withEnvironment(values, run) {
  const saved = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("local API remains direct under the existing automatic proxy policy", () => {
  for (const baseUrl of ["http://localhost:8080/v1", "http://127.0.0.1:8080/v1"]) {
    withEnvironment({ NODE_ENV: "development", NEXT_PUBLIC_API_BASE_URL: baseUrl, NEXT_PUBLIC_API_USE_DEV_PROXY: undefined }, () => {
      assert.equal(api.shouldUseDevProxy(), false);
      process.env.NEXT_PUBLIC_API_USE_DEV_PROXY = "true";
      assert.equal(api.shouldUseDevProxy(), false);
      assert.equal(api.getDevProxyDestination(), baseUrl);
      process.env.NEXT_PUBLIC_API_USE_DEV_PROXY = "false";
      assert.equal(api.shouldUseDevProxy(), false);
    });
  }
});

test("remote default, production direct calls and invalid-config behavior remain stable", () => {
  withEnvironment({ NODE_ENV: "development", NEXT_PUBLIC_API_BASE_URL: "https://api.example.test/v1/", NEXT_PUBLIC_API_USE_DEV_PROXY: undefined }, () => {
    assert.equal(api.shouldUseDevProxy(), true);
    assert.equal(api.getConfiguredApiBaseUrl(), "https://api.example.test/v1");
    process.env.NEXT_PUBLIC_API_USE_DEV_PROXY = "true";
    process.env.NODE_ENV = "production";
    assert.equal(api.shouldUseDevProxy(), false);
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_API_BASE_URL = "invalid-url";
    assert.equal(api.shouldUseDevProxy(), false);
  });
});

test("existing Next rewrite targets the configured local API without changing its version prefix", async () => {
  const previous = process.env.NEXT_PUBLIC_API_BASE_URL;
  try {
    process.env.NEXT_PUBLIC_API_BASE_URL = "http://localhost:8080/v1/";
    const config = require("../../next.config.js");
    const proxy = (await config.rewrites()).find(rule => rule.source === "/api/proxy/:path*");
    assert.equal(proxy.destination, "http://localhost:8080/v1/:path*");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL; else process.env.NEXT_PUBLIC_API_BASE_URL = previous;
  }
});
