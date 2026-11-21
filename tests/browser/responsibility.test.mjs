import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

let browser, directory, script;
before(async () => {
 directory = await mkdtemp(path.join(tmpdir(), "emsys-responsibility-"));
 const compiler = webpackPackage.webpack({ mode:"development", devtool:false,
  entry:path.resolve("tests/browser/fixtures/responsibility.tsx"), output:{path:directory,filename:"fixture.js"},
  resolve:{extensions:[".tsx",".ts",".js"],alias:{
   "@/lib/accounting/daily-income/use-responsibility-access$":path.resolve("tests/browser/fixtures/responsibility-access.ts"),
   "@/lib/i18n$":path.resolve("tests/browser/fixtures/responsibility-i18n.ts"),"@":path.resolve("src")}},
  module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.resolve("tests/browser/fixtures/typescript-loader.mjs")}]},
 });
 await new Promise((resolve,reject)=>compiler.run((error,stats)=>compiler.close(()=>error||stats.hasErrors()?reject(error??new Error(stats.toString())):resolve())));
 script=await readFile(path.join(directory,"fixture.js"),"utf8");
 browser=await chromium.launch();
});
after(async()=>{await browser?.close();if(directory)await rm(directory,{recursive:true,force:true});});
async function fixture(hash="",width=1200) {
 const page=await browser.newPage({viewport:{width,height:900}});
 page.setDefaultTimeout(5000);
 await page.goto(`about:blank#${hash}`);
 await page.setContent('<div id="root"></div>');
 await page.addScriptTag({content:script});
 await page.locator("#values").waitFor();return page;
}
test("without assignment grant, desktop and mobile hide other employees and routes",async()=>{
 for(const width of [1200,390]) {
  const page=await fixture("",width);
  try {
   assert.equal(await page.getByRole("radio",{name:/Employee/}).count(),0);
   const route=page.getByRole("radio",{name:/route/i});
   await route.click();
   const picker=page.getByRole("combobox").first();await picker.click();
   assert.equal(await page.getByRole("option",{name:/Other route/}).count(),0);
   await page.getByRole("option",{name:/My route/}).click();
   const values=JSON.parse(await page.locator("#values").textContent());
   assert.equal(values.routeId,"5");assert.equal(values.supervisorId,5);assert.equal(values.employeeId,undefined);
  } finally {await page.close();}
 }
});
test("exact assignment capability permits employee selection",async()=>{
 const page=await fixture("assign");try {
  const employee=page.getByRole("radio",{name:/Employee/});await employee.click();
  assert.equal(await employee.getAttribute("aria-checked"),"true");
  await page.getByRole("combobox").first().click();await page.getByRole("option",{name:"Other employee",exact:true}).click();
  assert.equal(JSON.parse(await page.locator("#values").textContent()).employeeId,99);
 }finally{await page.close();}
});

test("route assignment displays its single supervisor and excludes ambiguous crews on desktop and mobile", async () => {
 for (const width of [1200, 390]) {
  const page = await fixture("assign", width);
  try {
   await page.getByRole("radio", { name: /route/i }).click();
   await page.getByRole("combobox").first().click();
   assert.equal(await page.getByRole("option", { name: /Ambiguous route/ }).count(), 0);
   await page.getByRole("option", { name: /Other route/ }).click();
   assert.equal(JSON.parse(await page.locator("#values").textContent()).supervisorId, 99);
   assert.equal(await page.getByRole("status", { name: "Responsible supervisor" }).textContent(), "Supervisor 99");
   assert.equal(await page.getByRole("combobox").count(), 1, "only the route is selectable");
  } finally { await page.close(); }
 }
});
test("read-only attribution preserves the saved person and offers no reassignment controls",async()=>{
 const page=await fixture("readonly");try {
  assert.equal(await page.getByText("Saved responsible person").isVisible(),true);
  assert.equal(await page.getByRole("combobox").count(),0);
  assert.equal(await page.getByRole("radio").count(),0);
 }finally{await page.close();}
});

test("invoice and payment selectors obey their separate assignment grants", async () => {
 for (const grant of ["invoice-grant", "payment-grant"]) {
  const page = await fixture(`split-${grant}`);
  try {
   const invoice = page.getByRole("region", { name: "Invoice responsibility" });
   const payment = page.getByRole("region", { name: "Payment responsibility" });
   const allowed = grant === "invoice-grant" ? invoice : payment;
   const restricted = grant === "invoice-grant" ? payment : invoice;
   assert.equal(await restricted.getByRole("radio", { name: /Employee/ }).count(), 0);
   await allowed.getByRole("radio", { name: /Employee/ }).click();
   await allowed.getByRole("combobox").first().click();
   await page.getByRole("option", { name: "Other employee", exact: true }).click();
   const values = JSON.parse(await page.locator("#values").textContent());
   if (grant === "invoice-grant") { assert.equal(values.invoice.employee.id, 99); assert.equal(values.payment.employeeId, undefined); }
   else { assert.deepEqual(values.invoice, {}); assert.equal(values.payment.employeeId, 99); }
  } finally { await page.close(); }
 }
});
