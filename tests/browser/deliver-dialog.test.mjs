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
  directory = await mkdtemp(path.join(tmpdir(), "emsys-delivery-wizard-test-"));
  const hooks = path.resolve("tests/browser/fixtures/delivery-wizard-hooks.ts");
  const compiler = webpackPackage.webpack({
    mode: "development",
    devtool: false,
    plugins: [
      new webpackPackage.webpack.DefinePlugin({
        "process.env": JSON.stringify({ NODE_ENV: "development" }),
      }),
    ],
    entry: path.resolve("tests/browser/fixtures/delivery-wizard.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@/lib/auth/hooks/use-auth$": hooks,
        "@/lib/store/hooks$": hooks,
        "@/lib/store/store$": hooks,
        "@/lib/api/client$": hooks,
        "@/lib/api/axios$": hooks,
        "@/lib/invoices/api/invoice-documents-api$": hooks,
        "@/lib/invoice-policies/hooks/use-invoice-policies$": hooks,

        "@/lib/i18n$": path.resolve(
          "tests/browser/fixtures/delivery-wizard-i18n.ts",
        ),
        "@": path.resolve("src"),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: path.resolve("tests/browser/fixtures/typescript-loader.mjs"),
        },
      ],
    },
  });
  await new Promise((resolve, reject) =>
    compiler.run((error, stats) => {
      compiler.close(() => {
        if (error || stats.hasErrors())
          reject(error ?? new Error(stats.toString()));
        else resolve();
      });
    }),
  );
  script = await readFile(path.join(directory, "fixture.js"), "utf8");
  const cssPath = path.resolve("src/app/globals.css");
  css = (
    await postcss([tailwind()]).process(await readFile(cssPath, "utf8"), {
      from: cssPath,
    })
  ).css;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function fixture(flags = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", (error) =>
    console.error("Wizard page error:", error.message),
  );
  await page.route("http://localhost/wizard", (route) =>
    route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }),
  );
  await page.goto("http://localhost/wizard");
  await page.evaluate((flags) => Object.assign(window, flags), flags);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: script });
  return page;
}

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQImWP8z8Dwn4GBgYGJAQoAHgQCAZk9MZsAAAAASUVORK5CYII=",
  "base64",
);
const next = (page) =>
  page
    .getByRole("button", { name: "deliveries.wizard.continue", exact: true })
    .click();
const review = (page) =>
  page
    .getByText("deliveries.wizard.headings.review", { exact: true })
    .waitFor();
async function addPhotos(page, count = 1) {
  await page
    .getByLabel(/^(deliveries\.wizard\.gallery|Choose from gallery)$/, {
      exact: true,
    })
    .setInputFiles(
      Array.from({ length: count }, (_, i) => ({
        name: `photo${i}.png`,
        mimeType: "image/png",
        buffer: png,
      })),
    );
}
async function draw(page) {
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const box = await page.locator("canvas").boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + 45, { steps: 5 });
  await page.mouse.up();
}
async function toSignature(page) {
  await review(page);
  await next(page);
  await addPhotos(page);
  await next(page);
  await page
    .getByLabel("deliveries.deliver.signerName", { exact: true })
    .waitFor();
}
async function sign(page) {
  await page
    .getByLabel("deliveries.deliver.signerName", { exact: true })
    .fill("Pedro Ramirez");
  await page
    .getByLabel("deliveries.deliver.idNumber", { exact: true })
    .fill("001-1234567-8");
  const agreement = page.getByLabel("deliveries.deliver.agree", {
    exact: true,
  });
  if (await agreement.count()) await agreement.check();
  await draw(page);
  await next(page);
}
async function finish(page) {
  await page
    .getByRole("button", { name: "deliveries.deliver.submit", exact: true })
    .click();
  await page
    .getByText("deliveries.wizard.successTitle", { exact: true })
    .last()
    .waitFor();
}

test("four-step wizard completes selected pieces only using barcode delivery ID", async () => {
  const page = await fixture();
  try {
    await review(page);
    await page.getByRole("checkbox").last().uncheck();
    await next(page);
    await addPhotos(page, 2);
    await next(page);
    await sign(page);
    await page.locator("form").evaluate((form) => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await page.waitForFunction(() => window.wizardCompleted);
    const result = await page.evaluate(() => ({
      reads: window.wizardReads,
      uploads: window.wizardUploadCalls,
      requests: window.wizardRequests,
    }));
    assert.equal(result.reads, 1);
    assert.equal(result.uploads, 2);
    assert.equal(result.requests.length, 1);
    assert.equal(result.requests[0].barcodeIds.length, 2);
    assert.equal(result.requests[0].documentIds.length, 2);
    assert.equal(
      result.requests[0].receiverSignature.signerName,
      "Pedro Ramirez",
    );
    assert.equal(
      result.requests[0].receiverSignature.idNumber,
      "001-1234567-8",
    );
    assert.equal("signedAt" in result.requests[0].receiverSignature, false);
    assert.equal("collectedBy" in result.requests[0].receiverSignature, false);
  } finally {
    await page.close();
  }
});
test("selecting no items blocks the wizard", async () => {
  const page = await fixture();
  try {
    await review(page);
    for (const checkbox of await page.getByRole("checkbox").all())
      await checkbox.uncheck();
    await next(page);
    await page.getByRole("alert").waitFor();
    assert.equal(
      await page
        .getByText("deliveries.wizard.headings.review", { exact: true })
        .count(),
      1,
    );
  } finally {
    await page.close();
  }
});
test("at least one merchandise photo is required", async () => {
  const page = await fixture();
  try {
    await review(page);
    await next(page);
    await next(page);
    await page
      .getByText("deliveries.wizard.photoRequired", { exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(() => window.wizardRequests?.length ?? 0),
      0,
    );
  } finally {
    await page.close();
  }
});
test("photo upload failure retries only failed and unattempted files", async () => {
  const page = await fixture({ wizardUploadFailAt: 2 });
  try {
    await review(page);
    await next(page);
    await addPhotos(page, 3);
    await next(page);
    await page.getByRole("alert").last().waitFor();
    assert.equal(
      await page.evaluate(() => window.wizardUploadedNames.length),
      1,
    );
    await next(page);
    await page
      .getByLabel("deliveries.deliver.signerName", { exact: true })
      .waitFor();
    assert.equal(await page.evaluate(() => window.wizardUploadCalls), 4);
    assert.equal(
      await page.evaluate(() => window.wizardUploadedNames.length),
      3,
    );
  } finally {
    await page.close();
  }
});
test("receiver fields start empty and the actual signer can differ from invoice customer", async () => {
  const page = await fixture();
  try {
    await toSignature(page);
    assert.equal(
      await page
        .getByLabel("deliveries.deliver.signerName", { exact: true })
        .inputValue(),
      "",
    );
    assert.equal(
      await page
        .getByLabel("deliveries.deliver.idNumber", { exact: true })
        .inputValue(),
      "",
    );
    await sign(page);
    await finish(page);
  } finally {
    await page.close();
  }
});
test("invoice receiver shortcut fills editable name and ID", async () => {
  const page = await fixture();
  try {
    await toSignature(page);
    await page
      .getByRole("button", {
        name: "deliveries.deliver.sameAsInvoiceReceiver",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .getByLabel("deliveries.deliver.signerName", { exact: true })
        .inputValue(),
      "Maria Perez",
    );
    assert.equal(
      await page
        .getByLabel("deliveries.deliver.idNumber", { exact: true })
        .inputValue(),
      "INVOICE-CUSTOMER-ID",
    );
    await page
      .getByLabel("deliveries.deliver.idNumber", { exact: true })
      .fill("ACTUAL-ID");
  } finally {
    await page.close();
  }
});
test("active terms must be accepted before signature step can advance", async () => {
  const page = await fixture();
  try {
    await toSignature(page);
    await page
      .getByLabel("deliveries.deliver.signerName", { exact: true })
      .fill("Pedro");
    await page
      .getByLabel("deliveries.deliver.idNumber", { exact: true })
      .fill("ACTUAL-ID");
    await draw(page);
    await next(page);
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator("canvas").count(), 1);
  } finally {
    await page.close();
  }
});
test("no active terms allows completion without an agreement", async () => {
  const page = await fixture({ wizardNoPolicies: true });
  try {
    await toSignature(page);
    await sign(page);
    await finish(page);
    assert.deepEqual(
      await page.evaluate(() => window.wizardRequests[0].policyIds),
      [],
    );
  } finally {
    await page.close();
  }
});
test("failed terms block advancing and can be retried", async () => {
  const page = await fixture({ wizardPoliciesFail: true });
  try {
    await toSignature(page);
    assert.equal(
      await page
        .getByRole("button", {
          name: "deliveries.wizard.continue",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    await page.evaluate(() => (window.wizardPoliciesFail = false));
    await page
      .getByRole("button", { name: "deliveries.deliver.retry", exact: true })
      .click();
    await page
      .getByLabel("deliveries.deliver.agree", { exact: true })
      .waitFor();
  } finally {
    await page.close();
  }
});
test("an uncertain completion retries the exact receipt and does not upload photos again", async () => {
  const page = await fixture({ wizardFailComplete: true });
  try {
    await toSignature(page);
    await sign(page);
    await page
      .getByRole("button", { name: "deliveries.deliver.submit", exact: true })
      .click();
    await page.getByRole("alert").waitFor();
    await page.evaluate(() => (window.wizardFailComplete = false));
    await finish(page);
    const requests = await page.evaluate(() => window.wizardRequests);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal(await page.evaluate(() => window.wizardUploadCalls), 1);
  } finally {
    await page.close();
  }
});
test("missing permission performs no delivery read or completion", async () => {
  const page = await fixture({ wizardReadOnly: true });
  try {
    await page.getByRole("alert").waitFor();
    assert.equal(await page.evaluate(() => window.wizardReads ?? 0), 0);
    assert.equal(
      await page.evaluate(() => window.wizardRequests?.length ?? 0),
      0,
    );
  } finally {
    await page.close();
  }
});
test("photo input is images only, with camera capture and no video control", async () => {
  const page = await fixture();
  try {
    await review(page);
    await next(page);
    const input = page.getByLabel("deliveries.wizard.takePhoto", {
      exact: true,
    });
    assert.equal(await input.getAttribute("accept"), "image/*");
    assert.equal(await input.getAttribute("capture"), "environment");
    assert.equal(await page.locator('input[accept="video/*"]').count(), 0);
  } finally {
    await page.close();
  }
});
test("mobile, iPad and desktop follow the same wizard layout", async () => {
  for (const width of [390, 820, 1440]) {
    const page = await fixture({ wizardVisual: true });
    try {
      await page.setViewportSize({ width, height: 1000 });
      await page.getByText("Review items", { exact: true }).waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
      await page.screenshot({
        path: `/tmp/emsys-delivery-wizard-${width}-review.png`,
      });
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.screenshot({
        path: `/tmp/emsys-delivery-wizard-${width}-photos.png`,
      });
      await addPhotos(page);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page
        .getByLabel("Delivery receiver name", { exact: true })
        .waitFor();
      await page.screenshot({
        path: `/tmp/emsys-delivery-wizard-${width}-signature.png`,
      });
      await page
        .getByLabel("Delivery receiver name", { exact: true })
        .fill("Pedro Ramirez");
      await page
        .getByLabel("Delivery receiver ID number", { exact: true })
        .fill("001-1234567-8");
      await page.getByRole("checkbox").check();
      await draw(page);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.screenshot({
        path: `/tmp/emsys-delivery-wizard-${width}-finish.png`,
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
        false,
      );
    } finally {
      await page.close();
    }
  }
});


test("a definitive conflict reloads items and requires a fresh receipt without reuploading photos", async () => {
 const page = await fixture({ wizardConflict: true });
 try {
  await toSignature(page); await sign(page);
  await page.getByRole("button", { name: "deliveries.deliver.submit", exact: true }).click();
  await review(page);
  const first=await page.evaluate(()=>window.wizardRequests[0]);
  await page.evaluate(()=>{window.wizardConflict=false;});
  await next(page); await next(page);
  await page.getByLabel("deliveries.deliver.signerName",{exact:true}).waitFor();
  await sign(page);await finish(page);
  const result=await page.evaluate(()=>({ requests:window.wizardRequests, uploads:window.wizardUploadCalls, reads:window.wizardReads }));
  assert.notEqual(result.requests[1].requestId,first.requestId);
  assert.equal(result.uploads,1);assert.equal(result.reads,2);
 } finally { await page.close(); }
});
