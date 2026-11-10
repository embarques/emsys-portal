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
    "@/lib/i18n$":path.join(fixtures,"journal-i18n.ts"),
    "@":path.resolve("src")}},
   module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(fixtures,"typescript-loader.mjs")}]}
  });
  await new Promise((resolve,reject)=>compiler.run((error,stats)=>error||stats?.hasErrors()?reject(error??new Error(stats.toString({all:false,errors:true}))):resolve()));
  await new Promise(resolve=>compiler.close(resolve));
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  page.on("pageerror", error => console.error(error.message));
  page.on("console", msg => {if(msg.type()==="error") console.error(msg.text());});
  await openFixture(page);
  await page.evaluate(()=>{window.failApproval=true;});
  const script=await readFile(path.join(directory,"fixture.js"),"utf8");
  await page.addScriptTag({content:script});
  await page.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  await page.getByRole("toolbar",{name:"common.table.selectionActionsGroup"}).waitFor();
  assert.equal(await page.getByRole("checkbox",{name:"Select TXN-B1",exact:true}).isDisabled(),true);
  await page.getByRole("button",{name:"common.actions.next",exact:true}).click();
  await page.getByRole("checkbox",{name:"Select TXN-A2",exact:true}).check();
  await page.waitForFunction(()=>window.journalCalls.some(call=>call.url==="/journals/summary"&&call.body.ids?.length===2));
  await page.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  await dialog.getByRole("alert").waitFor();
  await dialog.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  await dialog.getByText("accounting.journalReconciliation.batchComplete",{exact:true}).waitFor();
  assert.equal(await dialog.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).isDisabled(),true);
  await dialog.getByRole("button",{name:"common.actions.cancel",exact:true}).click();
  const calls=await page.evaluate(()=>window.journalCalls);
  const approvals=calls.filter(call=>call.url==="/journals/reconcile");
  assert.equal(approvals.length,2);
  assert.equal(approvals[0].body.requestId,approvals[1].body.requestId);
  assert.deepEqual(approvals[0].body.ids,["650000000000000000000001","650000000000000000000003"]);
  assert.ok(calls.filter(call=>call.url==="/journals/search").every(call=>JSON.stringify(call.body.filters).includes("OUTSTANDING")));
  assert.ok(!calls.some(call=>call.url.startsWith("/invoices")||call.url.startsWith("/financial-activity")));
  await page.screenshot({path:"/tmp/emsys-journal-table.png",fullPage:true});
  await page.close();
  const incomplete=await browser.newPage();
  await openFixture(incomplete);
  await incomplete.evaluate(()=>{window.partialAcknowledgement=true;});
  await incomplete.addScriptTag({content:script});
  await incomplete.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  await incomplete.getByRole("button",{name:"common.actions.next",exact:true}).click();
  await incomplete.getByRole("checkbox",{name:"Select TXN-A2",exact:true}).check();
  await incomplete.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
  const partialDialog=incomplete.getByRole("dialog");
  const retry=partialDialog.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true});
  await retry.click();
  await partialDialog.getByText("650000000000000000000003 — accounting.journalReconciliation.unconfirmed",{exact:true}).waitFor();
  assert.equal(await retry.isEnabled(),true);
  await retry.click();
  await partialDialog.getByText("accounting.journalReconciliation.batchComplete",{exact:true}).waitFor();
  assert.equal(await retry.isDisabled(),true);
  const partialCalls=await incomplete.evaluate(()=>window.journalCalls.filter(call=>call.url==="/journals/reconcile"));
  assert.equal(partialCalls.length,2);
  assert.deepEqual(partialCalls[0].body,partialCalls[1].body);
  await incomplete.close();
  const viewer=await browser.newPage();
  await openFixture(viewer);
  await viewer.evaluate(()=>{window.readOnly=true;});
  await viewer.addScriptTag({content:script});
  await viewer.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  await viewer.getByRole("checkbox",{name:"Select TXN-B1",exact:true}).check();
  assert.equal(await viewer.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).count(),0);
  await viewer.close();
  const daily=await browser.newPage();
  await openFixture(daily);
  await daily.evaluate(()=>{window.dailyIncome=true;});
  await daily.addScriptTag({content:script});
  await daily.getByRole("button",{name:"Add transaction",exact:true}).waitFor();
  const firstRow=daily.getByRole("row").filter({has:daily.getByRole("checkbox",{name:"Select TXN-A1",exact:true})});
  assert.ok((await firstRow.innerText()).includes("Nov 4, 2026"));
  assert.ok((await firstRow.innerText()).includes("$20.00"));
  await daily.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  const toolbar=daily.getByRole("toolbar",{name:"common.table.selectionActionsGroup"});
  await toolbar.getByRole("button",{name:"common.actions.view",exact:true}).click();
  assert.equal(await daily.locator("body").getAttribute("data-viewed-journal"),"650000000000000000000001");
  await toolbar.getByRole("button",{name:"accounting.dailyIncome.actions.printReceipt",exact:true}).click();
  assert.equal(await daily.locator("body").getAttribute("data-receipt-journal"),"650000000000000000000001");
  await daily.waitForFunction(()=>document.querySelector("dd")?.textContent==="25.00");
  assert.deepEqual(await daily.locator("dl dd").allTextContents(),["25.00","0.00","25.00"]);
  await toolbar.getByRole("button",{name:"common.table.clearSelection",exact:true}).click();
  await toolbar.waitFor({state:"hidden"});
  assert.equal(await daily.getByText("accounting.journalReconciliation.selectedTotals",{exact:true}).count(),0);
  const dailyCalls=await daily.evaluate(()=>window.journalCalls);
  assert.ok(dailyCalls.filter(call=>call.url==="/journals/search").every(call=>JSON.stringify(call.body.filters).includes("32690")));
  assert.ok(!dailyCalls.some(call=>call.url==="/journals/reconcile"));
  await daily.close();
  const clearance=await browser.newPage();
  await openFixture(clearance);
  await clearance.evaluate(()=>{window.pendingClearance=true;window.failClearance=true;});
  await clearance.addScriptTag({content:script});
  await clearance.getByRole("button",{name:"accounting.journalClearance.blocked.notAuthorized",exact:true}).waitFor();
  await clearance.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  assert.equal(await clearance.getByRole("checkbox",{name:"Select TXN-B1",exact:true}).isDisabled(),true);
  assert.equal(await clearance.getByRole("button",{name:"accounting.journalClearance.blocked.notAuthorized",exact:true}).count(),1);
  // TXN-A1 is already reconciled and belongs to a closed closeout, but can still settle.
  await clearance.getByRole("button",{name:"accounting.journalClearance.clearSelected",exact:true}).click();
  const clearanceDialog=clearance.getByRole("dialog");
  const confirmList=clearanceDialog.getByRole("table",{name:"accounting.journalClearance.confirmList.caption"});
  assert.equal(await confirmList.getByRole("row").count(),2);
  for (const value of ["INV-26-001475","TXN-A1","004521","CHECK"]) await confirmList.getByRole("cell",{name:value,exact:true}).waitFor();
  await clearanceDialog.getByRole("button",{name:"accounting.journalClearance.clearSelected",exact:true}).click();
  await clearanceDialog.getByRole("alert").waitFor();
  await clearanceDialog.getByRole("button",{name:"accounting.journalClearance.clearSelected",exact:true}).click();
  await clearanceDialog.getByText("accounting.journalClearance.batchComplete",{exact:true}).waitFor();
  await confirmList.getByRole("cell",{name:"TXN-A1",exact:true}).waitFor();
  assert.equal(await clearanceDialog.getByRole("button",{name:"accounting.journalClearance.clearSelected",exact:true}).isDisabled(),true);
  await clearanceDialog.getByRole("button",{name:"common.actions.cancel",exact:true}).click();
  const clearanceCalls=await clearance.evaluate(()=>window.journalCalls);
  const settlements=clearanceCalls.filter(call=>call.url==="/journals/clear");
  assert.equal(settlements.length,2);
  assert.equal(settlements[0].body.requestId,settlements[1].body.requestId);
  assert.deepEqual(settlements[0].body.ids,["650000000000000000000001"]);
  assert.ok(clearanceCalls.filter(call=>call.url==="/journals/search").every(call=>JSON.stringify(call.body.filters).includes("clearanceStatus")&&!JSON.stringify(call.body.filters).includes("reconciliationStatus")));
  assert.ok(!clearanceCalls.some(call=>call.url==="/journals/reconcile"||call.url.startsWith("/checks")||call.url.startsWith("/invoices")));
  await clearance.close();
  const reconciliationOnly=await browser.newPage();
  await openFixture(reconciliationOnly);
  await reconciliationOnly.evaluate(()=>{window.pendingClearance=true;window.denyClear=true;});
  await reconciliationOnly.addScriptTag({content:script});
  await reconciliationOnly.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
  assert.equal(await reconciliationOnly.getByRole("button",{name:"accounting.journalClearance.clearSelected",exact:true}).count(),0);
  await reconciliationOnly.close();
 } finally {await browser?.close();await rm(directory,{recursive:true,force:true});}
});
