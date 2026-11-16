import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

test("AuthProvider discards stale user/refresh results and isolates actor/company caches", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "emsys-auth-context-"));
  let browser;
  try {
    const fixtures = path.resolve("tests/browser/fixtures");
    const boundary = path.join(fixtures, "auth-context-boundary.ts");
    const aliases = Object.fromEntries(["firebase/auth", "@/lib/auth/firebase/firebase-config", "@/lib/auth/firebase/firebase-user-profile",
      "@/lib/auth/utils/auth-bypass", "@/lib/auth/utils/dev-auth", "@/lib/auth/hooks/use-user-permissions"].map(key => [`${key}$`, boundary]));
    const compiler = webpackPackage.webpack({ mode: "development", devtool: false,
      plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
      entry: path.join(fixtures, "auth-context.tsx"), output: { path: directory, filename: "fixture.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { ...aliases, "@": path.resolve("src") } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(fixtures, "typescript-loader.mjs") }] },
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => error || stats?.hasErrors() ? reject(error ?? new Error(stats.toString({ all: false, errors: true }))) : resolve()));
    await new Promise(resolve => compiler.close(resolve));
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(7000);
    await page.route("http://localhost/**", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
    await page.goto("http://localhost/fixture");
    await page.addScriptTag({ content: await readFile(path.join(directory, "fixture.js"), "utf8") });
    await page.locator('#auth-status[data-ready="true"]').waitFor();

    // Local logout is immediate even while Firebase has not finished clearing its old currentUser.
    await page.evaluate(() => { void window.authContextTest.emit("logout-race", { delay: true }); window.authContextTest.holdLogout(); });
    await page.evaluate(() => window.authContextTest.startLogout());
    await page.waitForFunction(() => window.authContextTest.logoutWaiting());
    await page.evaluate(() => window.authContextTest.releaseUser("logout-race"));
    assert.equal((await page.evaluate(() => window.authContextTest.state())).idToken, null, "late auth callback must not revive a locally ended session");
    await page.evaluate(() => window.authContextTest.finishLogout());

    // A slow old login must not overwrite a newer user's already established session.
    await page.evaluate(() => { void window.authContextTest.emit("old-user", { delay: true }); });
    await page.evaluate(() => window.authContextTest.emit("new-user"));
    await page.waitForFunction(() => JSON.parse(document.querySelector("#auth-status").textContent).actorId === "new-user");
    await page.evaluate(() => window.authContextTest.releaseUser("old-user"));
    assert.equal((await page.evaluate(() => window.authContextTest.state())).actorId, "new-user");

    // Renewal for the same actor/company retains cached data.
    await page.evaluate(() => window.authContextTest.setData("private-a"));
    await page.getByText("private-a", { exact: true }).waitFor();
    const version = (await page.evaluate(() => window.authContextTest.state())).contextVersion;
    await page.evaluate(() => window.authContextTest.emit("new-user", { token: "renewed-token" }));
    assert.equal(await page.evaluate(() => window.authContextTest.readData()), "private-a");
    assert.equal(await page.locator("#invoice-data").textContent(), "private-a");
    assert.equal((await page.evaluate(() => window.authContextTest.state())).contextVersion, version);

    // The same user's changed company cannot retain an unscoped legacy cache key.
    await page.evaluate(() => window.authContextTest.emit("new-user", { companyId: "company-b" }));
    await page.waitForFunction(() => JSON.parse(document.querySelector("#auth-status").textContent).companyId === "company-b");
    assert.equal(await page.evaluate(() => window.authContextTest.readData()), null);
    assert.equal(await page.locator("#invoice-data").textContent(), "empty", "keepPreviousData cannot retain old-company rows");

    // An in-flight refresh completing after logout cannot restore React or Redux auth state.
    await page.evaluate(() => { window.authContextTest.setData("private-b"); window.authContextTest.holdRefresh(); window.authContextTest.startRefresh(); });
    await page.waitForFunction(() => window.authContextTest.refreshWaiting());
    await page.evaluate(() => window.authContextTest.signOut());
    await page.evaluate(() => window.authContextTest.releaseRefresh());
    await page.waitForFunction(() => JSON.parse(document.querySelector("#auth-status").textContent).authenticated === false);
    const state = await page.evaluate(() => window.authContextTest.state());
    assert.equal(state.idToken, null);
    assert.equal(state.companyId, null);
    assert.equal(state.actorId, null);
    assert.equal(await page.evaluate(() => window.authContextTest.readData()), null);

    // A delayed dev bootstrap must not replace an explicit newer sign-in.
    await page.goto("http://localhost/fixture?mode=dev");
    await page.addScriptTag({ content: await readFile(path.join(directory, "fixture.js"), "utf8") });
    await page.waitForFunction(() => !!window.authContextTest);
    await page.evaluate(() => window.authContextTest.signInDev({ email: "new@fixture.test", password: "fixture", companyId: "company-b" }));
    await page.locator('#auth-status[data-ready="true"]').waitFor();
    await page.evaluate(() => window.authContextTest.releaseBootstrap());
    assert.equal((await page.evaluate(() => window.authContextTest.state())).actorId, "dev:new@fixture.test");

    // A manually initiated sign-in canceled by logout must not acknowledge success to its caller.
    await page.evaluate(() => window.authContextTest.startDelayedDevLogin());
    await page.waitForFunction(() => window.authContextTest.devLoginWaiting());
    await page.evaluate(() => window.authContextTest.signOut());
    assert.equal(await page.evaluate(() => window.authContextTest.finishDelayedDevLogin()), "canceled");
    assert.equal((await page.evaluate(() => window.authContextTest.state())).idToken, null);

    // Logout during dev initialization releases the loading UI and rejects late bootstrap results.
    await page.goto("http://localhost/fixture?mode=dev");
    await page.addScriptTag({ content: await readFile(path.join(directory, "fixture.js"), "utf8") });
    await page.waitForFunction(() => !!window.authContextTest);
    await page.evaluate(() => window.authContextTest.signOut());
    await page.locator('#auth-status[data-ready="true"]').waitFor();
    await page.evaluate(() => window.authContextTest.releaseBootstrap());
    assert.equal((await page.evaluate(() => window.authContextTest.state())).idToken, null);
  } finally { await browser?.close(); await rm(directory, { recursive: true, force: true }); }
});
