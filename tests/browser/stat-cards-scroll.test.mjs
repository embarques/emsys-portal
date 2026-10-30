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
    entry: path.resolve("tests/browser/fixtures/stat-cards-scroll.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: { extensions: [".tsx", ".ts", ".js"], alias: {
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

async function fixture(width, nested = false) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>');
  await page.evaluate((nested) => { document.documentElement.dataset.nested = String(nested); }, nested);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  await page.locator('[data-slot="carousel"]:visible').waitFor();
  await page.waitForTimeout(150);
  return page;
}

async function swipeUp(page) {
  const session = await page.context().newCDPSession(page);
  const card = await page.locator('[data-slot="carousel"]:visible [data-slot="carousel-item"]').first().boundingBox();
  assert.ok(card, "The swipe must start on a rendered panel");
  const x = Math.round(card.x + card.width / 2);
  const startY = Math.round(card.y + card.height / 2);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: startY }] });
  for (let y = startY - 20; y >= startY - 220; y -= 20) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

for (const width of [390, 768]) {
  for (const nested of [false, true]) {
    test(`swiping over panels scrolls ${nested ? "workspace" : "document"} at ${width}px`, async () => {
      const page = await fixture(width, nested);
      try {
        await swipeUp(page);
        await page.waitForFunction((nested) =>
          (nested ? document.getElementById("page-scroll").scrollTop : window.scrollY) > 100, nested);
      } finally { await page.close(); }
    });
  }
}

test("mobile and desktop carousel arrows still change the visible panels", async () => {
  for (const width of [390, 1280]) {
    const page = await fixture(width);
    try {
      const carousel = page.locator('[data-slot="carousel"]:visible');
      const track = carousel.locator('[data-slot="carousel-content"] > div');
      const before = await track.evaluate((element) => element.style.transform);
      await carousel.locator('[data-slot="carousel-next"]').click();
      await page.waitForFunction((before) => {
        const carousels = [...document.querySelectorAll('[data-slot="carousel"]')];
        const carousel = carousels.find((element) => element.getBoundingClientRect().width > 0);
        return carousel.querySelector('[data-slot="carousel-content"] > div').style.transform !== before;
      }, before);
      await page.screenshot({ path: path.join(tmpdir(), `emsys-panels-${width}.png`), fullPage: false });
    } finally { await page.close(); }
  }
});
