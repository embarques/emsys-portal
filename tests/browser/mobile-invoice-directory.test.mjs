import {createServer} from "node:http";
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
let server;let origin;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-scroll-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    plugins: [new webpackPackage.webpack.DefinePlugin({ "process.env": JSON.stringify({ NODE_ENV: "test" }) })],
    entry: path.resolve("tests/browser/fixtures/mobile-invoice-directory.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@/lib/i18n$": path.resolve("tests/browser/fixtures/mobile-invoice-i18n.ts"),
 "@/lib/auth/hooks/use-auth$":path.resolve("tests/browser/fixtures/mobile-invoice-auth.ts"),
 "@/lib/layout/hooks/use-workspace-tabs$":path.resolve("tests/browser/fixtures/mobile-invoice-tabs.ts"),
 "@/lib/layout/hooks/use-sync-workspace-tab-title$":path.resolve("tests/browser/fixtures/mobile-invoice-tabs.ts"),
 "@/lib/api/client$":path.resolve("tests/browser/fixtures/mobile-invoice-api.ts"), "@": path.resolve("src") } },
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
  server=createServer((_request,response)=>{response.setHeader("Content-Type","text/html");response.end('<meta name="viewport" content="width=device-width, initial-scale=1"><pre id="requests" hidden></pre><div id="root"></div>');});
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));origin=`http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if(server)await new Promise(resolve=>server.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});


test("real mobile directory lists, searches, filters, and keeps rows on older-page failure",async()=>{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on("pageerror",error=>errors.push(error.message));
 try {
  await page.goto(origin);
  await page.addStyleTag({content:css});await page.addScriptTag({content:script});
  const mobile=page.locator("section.md\\:hidden");
  await mobile.getByRole("button",{name:"MOBILE-001",exact:true}).waitFor({timeout:5000});
  const search=mobile.getByRole("textbox",{name:"Search invoice",exact:true});
  await search.fill("MOBILE-001");await mobile.getByText("1 invoices",{exact:true}).waitFor();
  assert.equal(await mobile.getByRole("button",{name:/MOBILE-\d/}).count(),1);
  await search.fill("Alpha");await mobile.getByText("40 invoices",{exact:true}).waitFor();
  await mobile.getByRole("button",{name:"Balance due",exact:true}).click();await mobile.getByText("20 invoices",{exact:true}).waitFor();
  await mobile.getByRole("button",{name:"Paid",exact:true}).click();await mobile.getByText("20 invoices",{exact:true}).waitFor();
  await search.fill("");await mobile.getByRole("button",{name:"Incomplete",exact:true}).click();await mobile.getByText("12 invoices",{exact:true}).waitFor();
  await search.fill("NoSuchCustomer");await mobile.getByText("No invoices match your search or filters.",{exact:true}).waitFor();
  await search.fill("");await mobile.getByRole("button",{name:"All",exact:true}).click();await mobile.getByText("120 invoices",{exact:true}).waitFor();
  await page.evaluate(()=>document.documentElement.dataset.failOlder="true");
  const older=mobile.getByRole("button",{name:"Older invoices",exact:true});await older.scrollIntoViewIfNeeded();
  await mobile.getByRole("button",{name:"Retry",exact:true}).waitFor();
  assert.equal(await mobile.getByRole("button",{name:"MOBILE-001",exact:true}).count(),1);
  await mobile.getByRole("button",{name:"Retry",exact:true}).click();await mobile.getByRole("button",{name:"MOBILE-051",exact:true}).waitFor();
  await mobile.getByRole("button",{name:"Older invoices",exact:true}).scrollIntoViewIfNeeded();await mobile.getByRole("button",{name:"MOBILE-120",exact:true}).waitFor();
  assert.equal(await mobile.getByRole("button",{name:/MOBILE-\d/}).count(),120);
  assert.deepEqual(errors,[]);
 }catch(error){console.error("PAGE ERRORS",errors);console.error((await page.locator("body").innerText()).slice(0,2500));throw error;}finally {await page.close();}
});
