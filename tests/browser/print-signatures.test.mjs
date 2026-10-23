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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-print-signatures-test-"));
  const hooks = path.resolve("tests/browser/fixtures/print-signatures-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "development" }) })],
    entry: path.resolve("tests/browser/fixtures/print-signatures.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
      "@/lib/auth/hooks/use-auth$": hooks,
      "@/lib/store/hooks$": hooks,
      "@/lib/store/store$": hooks,
      "@/lib/api/client$": hooks,
      "@/lib/api/axios$": hooks,
      "@/components/app-shell/feedback-provider$": hooks,
      "@/lib/reports/hooks/use-reports$": hooks,
      "@/lib/invoices/print-invoice-report$": hooks,
      "@/lib/i18n$": path.resolve("tests/browser/fixtures/print-signatures-i18n.ts"),
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
  await page.setContent('<div id="root"></div>');
  await page.evaluate(flags => Object.assign(window, flags), flags);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  return page;
}

const ready = page => page.locator("form").waitFor();
test("20 invoices load in one metadata request and submit reference-only choices", async () => {
 const page=await fixture(); try {
 await ready(page);
 assert.equal(await page.locator('select[id^="print-receiver-"]').count(),5);
 await page.locator('select[id^="print-receiver-"]').first().selectOption("68f800000000000000000005");
 await page.getByRole("button",{name:"invoices.printSignatures.next",exact:true}).click();
 await page.getByRole("button",{name:"invoices.printSignatures.previous",exact:true}).click();
 assert.equal(await page.locator('select[id^="print-receiver-"]').first().inputValue(),"68f800000000000000000005");
 await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
 await page.waitForFunction(() => window.printClosed);
 const result=await page.evaluate(() => ({calls:window.metadataRequests,requests:window.printRequests,opened:window.opened}));
 assert.equal(result.calls,1); assert.equal(result.requests.length,1); assert.equal(result.requests[0].signatureSelections.length,20);
 assert.equal(result.requests[0].signatureSelections[0].receiverSignatureId,"68f800000000000000000005");
 assert.equal(result.requests[0].signatureSelections[1].receiverSignatureId,"");
 assert.equal(JSON.stringify(result.requests).includes("base64"),false); assert.equal(result.opened,"/fixture.pdf");
 } finally {await page.close();}
});
test("delivery printing selects that barcode delivery, not the globally latest receipt",async()=>{
 const page=await fixture({trip:true}); try {await ready(page); assert.equal(await page.locator('select[id^="print-receiver-"]').inputValue(),"68f800000000000000000005");} finally {await page.close();}
});
test("latest receipt is used only after explicitly applying it to all",async()=>{
 const page=await fixture(); try {await ready(page); await page.locator("#print-signature-default").selectOption("latest"); await page.getByRole("button",{name:"invoices.printSignatures.applyAll",exact:true}).click(); assert.equal(await page.locator('select[id^="print-receiver-"]').first().inputValue(),"68f800000000000000000006");}finally{await page.close();}
});
test("missing print permission performs no metadata request",async()=>{
 const page=await fixture({readOnly:true});try{await page.getByRole("alert").waitFor();assert.equal(await page.evaluate(()=>window.metadataRequests??0),0);}finally{await page.close();}
});
test("failed metadata blocks printing until retry succeeds",async()=>{
 const page=await fixture({failMetadata:true});try{await page.getByRole("alert").waitFor();assert.equal(await page.locator("form").count(),0);await page.evaluate(()=>window.failMetadata=false);await page.getByRole("button",{name:"invoices.printSignatures.retry",exact:true}).click();await ready(page);}finally{await page.close();}
});
test("failed generation preserves chosen signature",async()=>{
 const page=await fixture({failPrint:true});try{await ready(page);await page.locator('select[id^="print-receiver-"]').first().selectOption("68f800000000000000000005");await page.locator("form").evaluate(form=>form.requestSubmit());await page.getByRole("alert").waitFor();assert.equal(await page.locator('select[id^="print-receiver-"]').first().inputValue(),"68f800000000000000000005");assert.equal(await page.evaluate(()=>window.opened),undefined);}finally{await page.close();}
});

test("signature picker fits desktop and mobile without a preview",async()=>{
 for (const width of [1200,390]) {
  const page=await fixture({visual:true});try{
   await page.setViewportSize({width,height:900});await ready(page);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
   assert.equal(await page.locator("canvas,img,iframe").count(),0);
   await page.screenshot({path:`/tmp/emsys-print-signatures-${width}.png`});
  }finally{await page.close();}
 }
});


test("English and Spanish counts render without raw placeholders",async()=>{
 for(const spanish of [false,true]) {
  const page=await fixture({visual:true,spanish});try{
   await ready(page);
   const text=await page.locator('[role="dialog"]').innerText();
   assert.equal(/\{(?:count|total|first|last|number)\}/.test(text),false);
   assert.ok(text.includes(spanish ? "20 facturas seleccionadas" : "20 selected invoices"));
   assert.ok(text.includes(spanish ? "Facturas 1–5 de 20" : "Invoices 1–5 of 20"));
  }finally{await page.close();}
 }
});
test("single invoice identifies its number and explains absent signatures",async()=>{
 const page=await fixture({visual:true,trip:true,noSignatures:true});try{
  await ready(page);
  await page.getByText("Invoice INV-1 · Choose signatures for this PDF",{exact:true}).waitFor();
  await page.getByText("This invoice has no saved signatures. You can print it without signatures.",{exact:true}).waitFor();
  assert.equal(await page.locator("#print-signature-default").count(),0);
  assert.equal(await page.getByRole("button",{name:"Print invoice",exact:true}).isEnabled(),true);
 }finally{await page.close();}
});
test("switching invoices during metadata loading prints only the new selection",async()=>{
 const page=await fixture({trip:true,metadataDelay:150});try{
  await page.waitForFunction(()=>window.metadataRequests===1 && window.switchPrintInvoice);
  await page.evaluate(()=>window.switchPrintInvoice("000000000000000000000002"));
  await ready(page);await page.getByText("INV-2",{exact:true}).waitFor();
  assert.equal(await page.getByText("INV-1",{exact:true}).count(),0);
  await page.locator("form").evaluate(form=>form.requestSubmit());await page.waitForFunction(()=>window.printClosed);
  const request=await page.evaluate(()=>window.printRequests[0]);
  assert.deepEqual(request.values,["000000000000000000000002"]);
  assert.equal(request.signatureSelections[0].invoiceId,"000000000000000000000002");
 }finally{await page.close();}
});
test("mismatched invoice metadata blocks printing with an explanation",async()=>{
 const page=await fixture({trip:true,wrongInvoice:true});try{
  await page.getByRole("alert").waitFor();
  assert.equal(await page.locator("form").count(),0);
  assert.ok((await page.getByRole("alert").innerText()).includes("do not match"));
  assert.equal(await page.evaluate(()=>window.printRequests?.length??0),0);
 }finally{await page.close();}
});
