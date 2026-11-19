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
test("read-only attribution preserves the saved person and offers no reassignment controls",async()=>{
 const page=await fixture("readonly");try {
  assert.equal(await page.getByText("Saved responsible person").isVisible(),true);
  assert.equal(await page.getByRole("combobox").count(),0);
  assert.equal(await page.getByRole("radio").count(),0);
 }finally{await page.close();}
});
