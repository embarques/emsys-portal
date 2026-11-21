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

test("Edit/Delete lifecycle confirmations preserve drafts, reasons and retry identity",{timeout:60000},async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),"emsys-journal-browser-"));
 let browser;
 try {
  const fixtures=path.resolve("tests/browser/fixtures");
  const compiler=webpackPackage.webpack({mode:"development",devtool:false,
   plugins:[new webpackPackage.webpack.DefinePlugin({"process.env":JSON.stringify({NODE_ENV:"development"})})],
   entry:path.join(fixtures,"journal-edit.tsx"),output:{path:directory,filename:"fixture.js"},
   resolve:{extensions:[".tsx",".ts",".js"],alias:{
    "@/lib/accounting/daily-income/hooks$":path.join(fixtures,"journal-auth.ts"),
    "@/lib/auth/hooks/use-auth$":path.join(fixtures,"journal-auth.ts"),
    "@/lib/store/hooks$":path.join(fixtures,"journal-auth.ts"),
    "@/lib/api/client$":path.join(fixtures,"journal-edit-api.ts"),
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
    const page=await browser.newPage({viewport:{width,height:900}});
    page.setDefaultTimeout(10000);
    page.on("pageerror",error=>console.error(error));
    await openFixture(page);
    await page.evaluate(()=>{window.failCorrection=true;});
    await page.addScriptTag({content:script});
    await page.getByRole("button",{name:"Edit protected",exact:true}).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button",{name:"accounting.journalLifecycle.confirm",exact:true}).click();
    await page.getByText("accounting.journalLifecycle.reasonRequired",{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>window.editCalls?.length??0),0);
    assert.equal(await page.getByRole("textbox",{name:"accounting.journalLifecycle.reason",exact:true}).getAttribute("aria-invalid"),"true");
    await page.keyboard.press("Escape");
    await page.getByRole("status").filter({hasText:"cancelled"}).waitFor();
    assert.equal(await page.getByRole("textbox",{name:"Amount",exact:true}).inputValue(),"105");
    await page.getByRole("button",{name:"Edit protected",exact:true}).click();
    await page.getByRole("textbox",{name:"accounting.journalLifecycle.reason",exact:true}).fill("Receipt confirms amount");
    await page.getByRole("button",{name:"accounting.journalLifecycle.confirm",exact:true}).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByRole("alert").textContent(),"Temporary correction failure",JSON.stringify(await page.evaluate(()=>window.editCalls)));
    await page.getByRole("button",{name:"accounting.journalLifecycle.confirm",exact:true}).click();
    await page.getByRole("status").filter({hasText:"saved:replacement"}).waitFor();
    const calls=await page.evaluate(()=>window.editCalls);
    assert.equal(calls.length,2);
    assert.deepEqual(calls[0],calls[1]);
    assert.equal(calls[0].url,"/journals/original/correct");
    assert.equal(calls[0].body.replacement.autoClear,undefined);
    await page.getByRole("button",{name:"Edit outstanding",exact:true}).click();
    await page.getByRole("status").filter({hasText:"saved:original"}).waitFor();
    assert.equal((await page.evaluate(()=>window.editCalls)).at(-1).method,"PUT");
    const deletes=page.getByRole("button",{name:"common.actions.delete",exact:true});
    assert.equal(await deletes.count(),2,"one Delete per record, without separate Void/Reverse controls");
    for (const [index,operation] of ["reverse","void"].entries()) {
      await deletes.nth(index).click();
      await page.getByText(`accounting.journalLifecycle.${operation}Description`,{exact:true}).waitFor();
      await page.getByRole("textbox",{name:"accounting.journalLifecycle.reason",exact:true}).fill("Duplicate entry");
      await page.getByRole("button",{name:"accounting.journalLifecycle.confirm",exact:true}).click();
      await page.getByRole("dialog").waitFor({state:"hidden"});
      const last=(await page.evaluate(()=>window.editCalls)).at(-1);
      assert.ok(last.url.endsWith(`/${operation}`));
      assert.equal(last.method,"POST");
    }
    await page.close();
  }
 } finally {await browser?.close();await rm(directory,{recursive:true,force:true});}
});
