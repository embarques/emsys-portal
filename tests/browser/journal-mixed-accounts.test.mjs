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

test("mixed-account journal batches select across pages on desktop and mobile",async()=>{
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
    "@/lib/layout/hooks/use-workspace-tabs$":path.join(fixtures,"journal-workspace-tabs.ts"),
    "@/components/app-shell/feedback-provider$":path.join(fixtures,"journal-feedback.ts"),
    "next/navigation$":path.join(fixtures,"journal-navigation.ts"),
    "@":path.resolve("src")}},
   module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(fixtures,"typescript-loader.mjs")}]}
  });
  await new Promise((resolve,reject)=>compiler.run((error,stats)=>error||stats?.hasErrors()?reject(error??new Error(stats.toString({all:false,errors:true}))):resolve()));
  await new Promise(resolve=>compiler.close(resolve));
  browser=await chromium.launch({headless:true});
  const script=await readFile(path.join(directory,"fixture.js"),"utf8");
  for(const width of [1280,390]) {
   for(const clearance of [false,true]) {
    const page=await browser.newPage({viewport:{width,height:900}});
    await openFixture(page);
    await page.evaluate(clearance=>{window.pendingClearance=clearance;window.failApproval=true;window.failClearance=true;},clearance);
    await page.addScriptTag({content:script});
    const prefix=clearance ? "accounting.journalClearance" : "accounting.journalReconciliation";
    const action=clearance ? "clearSelected" : "reconcileSelected";
    await page.getByRole("checkbox",{name:"Select TXN-A1",exact:true}).check();
    assert.equal(await page.getByRole("checkbox",{name:"Select TXN-B1",exact:true}).isDisabled(),true);
    await page.getByRole("button",{name:"common.actions.next",exact:true}).click();
    // Same method, different persisted money account, on another server page.
    const next=page.getByRole("checkbox",{name:"Select TXN-A2",exact:true});
    await next.focus();
    await page.keyboard.press("Space");
    assert.equal(await next.isChecked(),true);
    await page.waitForFunction(()=>window.journalCalls.some(call=>call.url==="/journals/summary"&&call.body.ids?.length===2));
    await page.getByRole("button",{name:"common.actions.actions",exact:true}).click();
    await page.getByRole("menuitem",{name:`${prefix}.${action}`,exact:true}).click();
    await page.getByRole("heading",{name:`${prefix}.confirmTitle`,exact:true}).waitFor();
    await page.getByRole("button",{name:`${prefix}.${action}`,exact:true}).click();
    await page.getByRole("alert").waitFor();
    await page.getByRole("button",{name:`${prefix}.${action}`,exact:true}).click();
    await page.getByText(`${prefix}.batchComplete`,{exact:true}).waitFor();
    const calls=await page.evaluate(()=>window.journalCalls);
    const endpoint=clearance ? "/journals/clear" : "/journals/reconcile";
    const batches=calls.filter(call=>call.url===endpoint);
    assert.equal(batches.length,2);
    assert.deepEqual(batches[0].body,batches[1].body,"retry preserves the request ID and full mixed-account selection");
    assert.deepEqual(batches[0].body.ids,["650000000000000000000001","650000000000000000000003"]);
    assert.ok(!calls.some(call=>/^\/journals\/[0-9a-f]{24}/.test(call.url)),"no per-row detail waterfall");
    await page.close();
   }
  }
 } finally {await browser?.close();await rm(directory,{recursive:true,force:true});}
});
