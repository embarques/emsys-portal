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

test("offsets reconcile on desktop and mobile but never enter pending clearance",{timeout:60000},async()=>{
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
    page.setDefaultTimeout(10000);
    await page.evaluate(clearance=>{window.pendingClearance=clearance;window.offsetQueue=true;},clearance);
    await page.addScriptTag({content:script});
    if(clearance) {
      await page.getByText("accounting.journalClearance.empty",{exact:true}).waitFor();
      assert.equal(await page.getByRole("checkbox",{name:"Select OFFSET-1",exact:true}).count(),0);
    } else {
      const checkbox=page.getByRole("checkbox",{name:"Select OFFSET-1",exact:true});
      await checkbox.waitFor();
      assert.equal(await checkbox.isEnabled(),true);
      await checkbox.focus();
      await page.keyboard.press("Space");
      await page.getByRole("button",{name:"common.actions.actions",exact:true}).click();
      await page.getByRole("menuitem",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
      await page.getByText("accounting.journalReconciliation.reversal",{exact:true}).first().waitFor();
      await page.getByRole("button",{name:"accounting.journalReconciliation.reconcileSelected",exact:true}).click();
      await page.getByText("accounting.journalReconciliation.batchComplete",{exact:true}).waitFor();
      const commands=await page.evaluate(()=>window.journalCalls.filter(call=>call.url==="/journals/reconcile"));
      assert.equal(commands.length,1);
      assert.deepEqual(commands[0].body.ids,["650000000000000000000004"]);
    }
    const calls=await page.evaluate(()=>window.journalCalls);
    const search=calls.find(call=>call.url==="/journals/search");
    assert.ok(search);
    const leaves=nodes=>nodes.flatMap(node=>node.field ? [node] : leaves(node.filters));
    assert.equal(leaves(search.body.filters).some(filter=>filter.field==="transactionType"&&filter.value==="REVERSAL"&&filter.operator==="neq"),clearance);
    assert.ok(!calls.some(call=>call.url==="/journals/clear"));
    await page.close();
   }
  }
 } finally {await browser?.close();await rm(directory,{recursive:true,force:true});}
});
