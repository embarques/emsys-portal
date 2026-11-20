import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {test} from "node:test";
import {chromium} from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

async function openFixture(page) {
 await page.route("http://emsys.test/**", route => route.fulfill({contentType:"text/html",body:'<div id="root"></div>'}));
 await page.goto("http://emsys.test/");
}

test("principal forgiveness preserves money balances, validation and retry identity on desktop and mobile",async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),"emsys-journal-browser-"));
 let browser;
 try {
  const fixtures=path.resolve("tests/browser/fixtures");
  const compiler=webpackPackage.webpack({mode:"development",devtool:false,
   plugins:[new webpackPackage.webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],
   entry:path.join(fixtures,"loan-forgiveness.tsx"),output:{path:directory,filename:"fixture.js"},
   resolve:{extensions:[".tsx",".ts",".js"],alias:{
    "@/lib/auth/hooks/use-auth$":path.join(fixtures,"loan-forgiveness-mocks.ts"),
    "@/lib/store/hooks$":path.join(fixtures,"loan-forgiveness-mocks.ts"),
    "@/lib/layout/hooks/use-workspace-tabs$":path.join(fixtures,"journal-workspace-tabs.ts"),
    "@/lib/store/store$":path.join(fixtures,"loan-forgiveness-mocks.ts"),
    "@/lib/query/use-workspace-query$":path.join(fixtures,"loan-forgiveness-mocks.ts"),
    "@/lib/api/client$":path.join(fixtures,"loan-forgiveness-mocks.ts"),
    "@/lib/api/axios$":path.join(fixtures,"loan-forgiveness-mocks.ts"),
    "@/lib/i18n$":path.join(fixtures,"print-signatures-i18n.ts"),
    "next/navigation$":path.join(fixtures,"journal-navigation.ts"),
    "@":path.resolve("src")}},
   module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(fixtures,"typescript-loader.mjs")}]}
  });
  await new Promise((resolve,reject)=>compiler.run((error,stats)=>error||stats?.hasErrors()?reject(error??new Error(stats.toString({all:false,errors:true}))):resolve()));
  await new Promise(resolve=>compiler.close(resolve));
  browser=await chromium.launch({headless:true});
  const script=await readFile(path.join(directory,"fixture.js"),"utf8");
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:1000}});page.setDefaultTimeout(10000);
   page.on("pageerror",error=>console.error(error.message));
   await openFixture(page);await page.evaluate(()=>{window.forgivenessFailure=true;window.visual=true;});
   await page.addScriptTag({content:script});
   await page.getByText("The reduction is recorded as a loss. Cash and bank accounts stay unchanged.",{exact:true}).waitFor();
   assert.equal(await page.locator("#loan-increase-source-account").count(),0);
   const amount=page.locator("#loan-increase-amount");
   assert.equal(await amount.getAttribute("max"),"80");
   await amount.fill("81");await amount.press("Tab");
   await page.locator("form").evaluate(form=>form.requestSubmit());
   await page.getByRole("alert").filter({hasText:"open balance"}).waitFor();
   assert.equal(await page.evaluate(()=>window.forgivenessCalls.filter(c=>c.url.endsWith("/decreases")).length),0);
   await amount.fill("10");await page.locator("#loan-increase-description").fill("Approved forgiveness");
   await page.getByRole("button",{name:"Forgive principal",exact:true}).click();
   await page.getByText("Temporary forgiveness failure",{exact:true}).waitFor();
   assert.equal(await amount.inputValue(),"10");assert.equal(await page.locator("#loan-increase-description").inputValue(),"Approved forgiveness");
   await page.getByRole("button",{name:"Forgive principal",exact:true}).click();
   await page.getByRole("heading",{name:"Principal reductions",exact:true}).waitFor();
   await page.getByText("No money received",{exact:true}).waitFor();
   const calls=await page.evaluate(()=>window.forgivenessCalls.filter(c=>c.url.endsWith("/decreases")));
   assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);
   assert.equal(calls[0].body.amount,10);assert.equal(calls[0].body.sourceAccount,undefined);assert.equal(calls[0].body.paymentMethod,undefined);
   assert.deepEqual(await page.evaluate(()=>window.forgivenessCache()),{affected:true,unrelated:false,otherTenant:false,summary:true});
   await page.close();
  }
 }finally{await browser?.close();await rm(directory,{recursive:true,force:true});}
});
