import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let browser;
let directory;
let script;
let css;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-invoice-pool-test-"));
  const hooks = path.resolve("tests/browser/fixtures/invoice-pool-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/invoice-pool-entry.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": hooks,
      "@/lib/store/hooks$": hooks,
      "@/lib/api/client$": hooks,
      "@/lib/api/axios$": hooks,
      "@/lib/users/api/users-api$": hooks,
      "@/lib/i18n$": hooks,
      "@": path.resolve("src"),
    } },
    module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/,
      use: path.resolve("tests/browser/fixtures/typescript-loader.mjs") }] },
  });
  await new Promise((resolve, reject) => compiler.run((error, stats) => {
    compiler.close(() => {
      if (error || stats.hasErrors()) reject(error ?? new Error(stats.toString()));
      else resolve();
    });
  }));
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  const cssPath = path.resolve("src/app/globals.css");
  css = (await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture(flags = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  await page.context().route("http://localhost/**",route=>route.fulfill({contentType:"text/html",body:route.request().url().endsWith("fixture.pdf") ? "PDF document" : '<div id="root"></div>'}));
  await page.goto("http://localhost/fixture");
  await page.evaluate(flags => Object.assign(window, flags), flags);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  return page;
}


test("reserved page presents available, assigned and downloaded numbers",async()=>{
 const page=await fixture();try{
  await page.getByRole("heading",{name:"Reserved invoices"}).waitFor();
  await page.getByText("INV-102",{exact:true}).waitFor();
  assert.equal(await page.getByRole("checkbox",{name:"Select INV-102",exact:true}).isDisabled(),true);
  await page.screenshot({path:"/tmp/emsys-invoice-pool-portal.png",fullPage:true});
 }finally{await page.close();}
});
test("uncertain generation retries the exact persisted operation",async()=>{
 const page=await fixture({poolLoseAck:true});try{
  await page.getByRole("button",{name:"Generate numbers",exact:true}).click();
  await page.getByRole("button",{name:"Retry saved request",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Generate numbers",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"Retry saved request",exact:true}).click();
  await page.getByText("Invoice pool updated.",{exact:true}).waitFor();
  const writes=await page.evaluate(()=>window.poolWrites);
  assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);assert.equal(writes[0].userId,0);assert.equal(writes[0].count,50);
 }finally{await page.close();}
});
test("an uncertain generation survives a page reload",async()=>{
 const page=await fixture({poolLoseAck:true});try{
  await page.getByRole("button",{name:"Generate numbers",exact:true}).click();
  await page.getByRole("button",{name:"Retry saved request",exact:true}).waitFor();
  const first=await page.evaluate(()=>window.poolWrites[0]);
  await page.reload();await page.addStyleTag({content:css});await page.addScriptTag({content:script});
  await page.getByRole("button",{name:"Retry saved request",exact:true}).click();
  await page.getByText("Invoice pool updated.",{exact:true}).waitFor();
  const retried=await page.evaluate(()=>window.poolWrites[0]);assert.deepEqual(first,retried);
 }finally{await page.close();}
});
test("unprivileged user cannot load or mutate the pool",async()=>{
 const page=await fixture({poolDenied:true});try{
  await page.getByText("You do not have permission to view invoice pools.",{exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>window.poolReads??0),0);assert.equal(await page.getByRole("button",{name:"Generate numbers"}).count(),0);
 }finally{await page.close();}
});
test("only unused unclaimed assignments can be returned",async()=>{
 const page=await fixture();try{
  await page.getByRole("checkbox",{name:"Select INV-101",exact:true}).check();
  await page.getByRole("button",{name:"Return selected to pool",exact:true}).click();
  await page.getByText("Invoice pool updated.",{exact:true}).waitFor();
  const writes=await page.evaluate(()=>window.poolWrites);assert.equal(writes[0].action,"return");
  assert.deepEqual(writes[0].items,[{id:"68f800000000000000000002",token:"assigned-v1"}]);
 }finally{await page.close();}
});

test("user selection is separate from generation and does not require an employee", async () => {
 const page = await fixture();
 try {
  await page.getByRole("heading", {name:"Reserved invoices"}).waitFor();
  await page.locator("#pool-user").click();
  await page.getByRole("option", {name:"Ada User",exact:true}).click();
  await page.getByRole("checkbox", {name:"Select INV-100",exact:true}).check();
  await page.getByRole("button", {name:"Assign selected",exact:true}).click();
  await page.getByText("Invoice pool updated.",{exact:true}).waitFor();
  const assigned = await page.evaluate(() => window.poolWrites[0]);
  assert.equal(assigned.action,"assign"); assert.equal(assigned.userId,3); assert.equal("employeeId" in assigned,false);
  await page.getByRole("button", {name:"Generate numbers",exact:true}).click();
  await page.waitForFunction(() => window.poolWrites.length === 2);
  const generated = await page.evaluate(() => window.poolWrites[1]);
  assert.equal(generated.action,"generate"); assert.equal(generated.userId,0);
 } finally { await page.close(); }
});

test("Reserved navigation labels resolve in both supported languages", async () => {
 for (const [locale,label] of [["en","Reserved"],["es","Reservadas"]]) {
  const catalog = JSON.parse(await readFile(`src/locales/${locale}/navigation.json`,"utf8"));
  assert.equal(catalog.items.reservedInvoices,label);
 }
});

 test("missing user-view permission is explained instead of an empty selector", async () => {
  const page=await fixture({poolUsersDenied:true});try{
   await page.getByText("You need permission to view users to select an assignee.",{exact:true}).waitFor();
   assert.equal(await page.locator("#pool-user").isDisabled(),true);
  }finally{await page.close();}
 });
 test("user lookup errors are shown rather than disguised as no matches", async () => {
  const page=await fixture({poolUsersError:true});try{
   await page.getByRole("alert").filter({hasText:"User lookup unavailable"}).waitFor({timeout:15000});
  }finally{await page.close();}
 });
