import assert from "node:assert/strict";
import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {test} from "node:test";
import {chromium} from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

test("journal selection spans pages, restricts methods, and retries approval with one stable request ID",async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),"emsys-journal-browser-"));
 let browser;
 try {
  const fixtures=path.resolve("tests/browser/fixtures");
  const compiler=webpackPackage.webpack({mode:"development",devtool:false,
   plugins:[new webpackPackage.webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],
   entry:path.join(fixtures,"journal-reconciliation.tsx"),output:{path:directory,filename:"fixture.js"},
   resolve:{extensions:[".tsx",".ts",".js"],alias:{
    "@/lib/accounting/daily-income/hooks$":path.join(fixtures,"journal-auth.ts"),
    "@/lib/auth/hooks/use-auth$":path.join(fixtures,"journal-auth.ts"),
    "@/lib/store/hooks$":path.join(fixtures,"journal-auth.ts"),
    "@/lib/api/client$":path.join(fixtures,"journal-api.ts"),
    "@/lib/i18n$":path.join(fixtures,"i18n.ts"),
    "@":path.resolve("src")}},
   module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(fixtures,"typescript-loader.mjs")}]}
  });
  await new Promise((resolve,reject)=>compiler.run((error,stats)=>error||stats?.hasErrors()?reject(error??new Error(stats.toString({all:false,errors:true}))):resolve()));
  await new Promise(resolve=>compiler.close(resolve));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on("pageerror", error => console.error(error.message));
  page.on("console", msg => {if(msg.type()==="error") console.error(msg.text());});
  await page.setContent('<div id="root"></div>');
  await page.evaluate(()=>{window.failApproval=true;});
  const script=await readFile(path.join(directory,"fixture.js"),"utf8");
  await page.addScriptTag({content:script});
  await page.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  assert.equal(await page.getByRole("checkbox",{name:"Select TXN-B1",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"common.actions.next",exact:true}).click();
  await page.getByRole("checkbox",{name:"Select TXN-A2",exact:true}).check();
  await page.waitForFunction(()=>window.journalCalls.some(call=>call.url==="/journals/summary"&&call.body.ids?.length===2));
  await page.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  await dialog.getByRole("alert").waitFor();
  await dialog.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  await dialog.waitFor({state:"hidden"});
  const calls=await page.evaluate(()=>window.journalCalls);
  const approvals=calls.filter(call=>call.url==="/journals/reconcile");
  assert.equal(approvals.length,2);
  assert.equal(approvals[0].body.requestId,approvals[1].body.requestId);
  assert.deepEqual(approvals[0].body.ids,["650000000000000000000001","650000000000000000000003"]);
  assert.ok(calls.filter(call=>call.url==="/journals/search").every(call=>JSON.stringify(call.body.filters).includes("OUTSTANDING")));
  assert.ok(!calls.some(call=>call.url.startsWith("/invoices")||call.url.startsWith("/financial-activity")));
  await page.screenshot({path:"/tmp/emsys-journal-table.png",fullPage:true});
  await page.close();
  const viewer=await browser.newPage();
  await viewer.setContent('<div id="root"></div>');
  await viewer.evaluate(()=>{window.readOnly=true;});
  await viewer.addScriptTag({content:script});
  await viewer.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  await viewer.getByRole("checkbox",{name:"Select TXN-B1",exact:true}).check();
  assert.equal(await viewer.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).count(),0);
  await viewer.close();
 } finally {await browser?.close();await rm(directory,{recursive:true,force:true});}
});
