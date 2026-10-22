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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-scroll-test-"));
  const compiler = webpackPackage.webpack({
    mode: "development", devtool: false,
    entry: path.resolve("tests/browser/fixtures/predefined-routes-ui.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "next/image": path.resolve("tests/browser/fixtures/predefined-routes-image.tsx"), "@/lib/auth/hooks/use-auth": path.resolve("tests/browser/fixtures/documents-auth.ts"), "@/lib/i18n": path.resolve("tests/browser/fixtures/predefined-routes-i18n.ts"), "@/lib/api/client": path.resolve("tests/browser/fixtures/predefined-routes-api.ts"), "@/components/app-shell/feedback-provider": path.resolve("tests/browser/fixtures/feedback.tsx"), "@": path.resolve("src") } },
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

async function fixture(width, mode = "routes", canCreate = true) {
 const page = await browser.newPage({viewport:{width,height:844}});
 page.on("pageerror", error=>console.error(error));
 await page.route("**/logo.svg", route => route.fulfill({path:path.resolve("public/logo.svg"),contentType:"image/svg+xml"}));
 await page.setContent('<base href="http://fixture.test/"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
 await page.evaluate(({mode,canCreate})=>{document.documentElement.dataset.fixture=mode;document.documentElement.dataset.canCreate=String(canCreate);document.documentElement.classList.add("dark")},{mode,canCreate});
 await page.addStyleTag({content:css});
 await page.addScriptTag({content:script});
 return page;
}

for (const width of [320,390,1280]) {
 test(`application loader is visible without horizontal overflow at ${width}px`, async()=>{
  const page=await fixture(width,"loader");
  try {
   await page.getByRole("heading").waitFor();
   assert.ok(await page.getByRole("status").isVisible());
   await page.screenshot({path:path.join(tmpdir(),`emsys-predefined-filter-${width}.png`)});
   assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})).slice(0,8)),[]);
   const bounds=await page.getByRole("heading").boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
   await page.screenshot({path:path.join(tmpdir(),`emsys-main-loader-${width}.png`)});
  } finally {await page.close();}
 });
 test(`predefined route form retains mixed entries and saves from filter at ${width}px`,async()=>{
  const page=await fixture(width);
  try {
   await page.getByRole("button",{name:"Edit existing"}).click();
   await page.getByRole("dialog").waitFor();
   const inputs=page.getByRole("dialog").getByRole("textbox");
   assert.deepEqual(await inputs.evaluateAll(nodes=>nodes.map(node=>node.value)),["Miami Sur","Kendall","33157","Cutler Bay","Homestead","33030"]);
   await page.getByRole("button",{name:"Cancel",exact:true}).click();
   await page.getByRole("button",{name:"Add predefined route",exact:true}).click();
   const dialog=page.getByRole("dialog");
   await dialog.getByLabel("Route name",{exact:false}).fill("Boston");
   await dialog.getByRole("textbox").nth(1).fill("Boston, 02119, Lynn");
   await page.screenshot({path:path.join(tmpdir(),`emsys-predefined-form-${width}.png`)});
   await dialog.getByRole("button",{name:"Save",exact:true}).click();
   await dialog.waitFor({state:"hidden"});
   assert.deepEqual(await page.evaluate(()=>window.savedRoute),{name:"Boston",content:"Boston, 02119, Lynn"});
   assert.equal(await page.locator("output").textContent(),"15");
   await page.screenshot({path:path.join(tmpdir(),`emsys-predefined-filter-${width}.png`)});
   assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll("body *")].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,right:el.getBoundingClientRect().right})).slice(0,8)),[]);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && scrollX===0),true);
   assert.equal(await page.getByRole("button",{name:/delete/i}).count(),0);
   await page.screenshot({path:path.join(tmpdir(),`emsys-predefined-filter-${width}.png`)});
  } finally {await page.close();}
 });
}

test("pickup filter hides the create action without create permission",async()=>{
 const page=await fixture(390,"routes",false);
 try {await page.getByRole("combobox").waitFor();assert.equal(await page.getByRole("button",{name:"Add predefined route",exact:true}).count(),0);}finally{await page.close();}
});
