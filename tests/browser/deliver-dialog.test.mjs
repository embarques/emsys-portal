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
        "@/lib/invoices/api/invoices-api$": hooks,
        "@/lib/accounting/daily-income/api$": hooks,
        "@/lib/users/api/users-api$": hooks,
        "@/lib/employees/api/employees-api$": hooks,
        "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api$": hooks,
        "@/lib/accounting/chart-accounts/api/chart-accounts-api$": hooks,
        "@/lib/branches/hooks/use-branches$": hooks,
        "@/lib/store/hooks$": hooks,
        "@/lib/store/store$": hooks,
        "@/lib/api/client$": hooks,
        "@/lib/api/axios$": hooks,
        "@/lib/reports/hooks/use-reports$": hooks,
        "@/components/app-shell/feedback-provider$": hooks,
        "@/lib/invoices/api/invoice-documents-api$": hooks,
        "@/lib/invoice-policies/hooks/use-invoice-policies$": hooks,
        "@/lib/accounting/checks/api/checks-api$": hooks,
        "@/lib/accounting/clearable-payments/api$": hooks,

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
    route.fulfill({ contentType: "text/html", body: flags.workspaceBody ? '<div id="root"></div><div id="workspace-body" style="position:absolute;left:240px;top:120px;width:calc(100% - 240px);height:calc(100% - 120px)"></div>' : '<div id="root"></div>' }),
  );
  await page.context().route("http://localhost/fixture.pdf",route=>route.fulfill({contentType:"text/html",body:"PDF document"}));
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
const review = async (page) => {
  await page.getByText("deliveries.wizard.headings.balance", { exact: true }).waitFor();
  await next(page);
  await page.getByText("deliveries.wizard.headings.review", { exact: true }).waitFor();
};
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

test("five-step wizard completes selected pieces only using barcode delivery ID", async () => {
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
test("delivery can be completed without merchandise photos", async () => {
  const page = await fixture();
  try {
    await review(page);
    await next(page);
    await next(page);
    await page
      .getByLabel("deliveries.deliver.signerName", { exact: true })
      .waitFor();
    await sign(page);
    await finish(page);
    const result = await page.evaluate(() => ({
      uploads: window.wizardUploadCalls ?? 0,
      requests: window.wizardRequests,
    }));
    assert.equal(result.uploads, 0);
    assert.deepEqual(result.requests[0].documentIds, []);
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
    await page.evaluate(() => { window.wizardFailComplete = false; window.wizardBalance = 25; });
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
      await page.getByText("Review balance", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
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


test("disabled delivery actions show the missing assignment reason without hover", async () => {
 for (const [state,reason] of [["missing-conduce","The invoice item has no Conduce assigned."],["missing-invoice","The item has no linked invoice."]]) {
  const page=await fixture({deliveryNotice:state,wizardVisual:true});
  try {
   await page.setViewportSize({width:390,height:844});
   await page.getByText(reason,{exact:true}).waitFor();
   assert.equal(await page.getByRole("button",{name:"Deliver",exact:true}).isDisabled(),true);
   assert.equal(await page.getByRole("button",{name:/^(Print invoice|invoices\.printSignatures\.action)$/,exact:true}).isDisabled(),true);
  } finally { await page.close(); }
 }
 const page=await fixture({deliveryNotice:"valid",wizardVisual:true});
 try {
  await page.getByRole("button",{name:"Deliver",exact:true}).waitFor();
  assert.equal(await page.getByRole("button",{name:"Deliver",exact:true}).isEnabled(),true);
  assert.equal(await page.getByText("The invoice item has no Conduce assigned.",{exact:true}).count(),0);
 } finally {await page.close();}
});


test("legacy invoice items submit their numeric IDs and no zero ObjectIDs",async()=>{
 const page=await fixture({wizardLegacy:true});try{
  await review(page);await next(page);await next(page);
  await page.getByLabel("deliveries.deliver.signerName",{exact:true}).waitFor();
  await sign(page);await finish(page);
  const request=await page.evaluate(()=>window.wizardRequests[0]);
  assert.deepEqual(request.barcodeIds,[]);
  assert.deepEqual(request.legacyBarcodeIds,[765464,765465,765466]);
  assert.equal(JSON.stringify(request).includes("000000000000000000000000"),false);
 }finally{await page.close();}
});


test("printing after completion opens the PDF before closing the delivery panel",async()=>{
 const page=await fixture();try{
  await toSignature(page);await sign(page);await finish(page);
  await page.getByRole("button",{name:"invoices.printSignatures.action",exact:true}).click();
  await page.getByRole("heading",{name:"invoices.printSignatures.title",exact:true}).waitFor();
  assert.equal(await page.getByText("Closed",{exact:true}).count(),0);
  assert.equal(await page.getByRole("dialog").count(),1);
  const popupPromise=page.waitForEvent("popup");
  await page.getByRole("button",{name:"invoices.printSignatures.printSingle",exact:true}).click();
  const popup=await popupPromise;await popup.waitForURL("http://localhost/fixture.pdf");
  await page.getByText("Closed",{exact:true}).waitFor();
 }finally{await page.close();}
});


test("wizard centers inside the visible workspace body and keeps its footer in bounds", async () => {
  const page = await fixture({ workspaceBody: true });
  try {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await review(page);
    const body = await page.locator("#workspace-body").boundingBox();
    const dialog = await page.getByRole("dialog").boundingBox();
    assert.ok(Math.abs(dialog.x + dialog.width / 2 - (body.x + body.width / 2)) < 2);
    assert.ok(Math.abs(dialog.y + dialog.height / 2 - (body.y + body.height / 2)) < 2);
    assert.ok(dialog.width <= 1152);
    assert.ok(dialog.y >= body.y + 16);
    assert.ok(dialog.y + dialog.height <= body.y + body.height - 16);
    await next(page);
    const photos = await page.getByRole("dialog").boundingBox();
    assert.deepEqual(photos, dialog);
    const footer = await page.locator("footer").boundingBox();
    assert.ok(footer.y + footer.height <= dialog.y + dialog.height);
  } finally {
    await page.close();
  }
});

test("nonzero balance blocks delivery until an external payment is refreshed", async () => {
  const page = await fixture({ wizardBalance: 50, wizardCannotPay: true });
  try {
    await page.getByText("deliveries.wizard.balance.paymentUnavailable", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "deliveries.wizard.continue", exact: true }).isDisabled(), true);
    assert.equal(await page.locator("#journal-amount").count(), 0);
    await page.evaluate(() => { window.wizardBalance = 0; });
    await page.getByRole("button", { name: "deliveries.wizard.balance.refresh" }).click();
    await page.getByText("deliveries.wizard.balance.paid", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "deliveries.wizard.balance.refresh" }).count(), 0);
    await review(page);
    assert.equal(await page.evaluate(() => window.wizardRequests?.length ?? 0), 0);
  } finally { await page.close(); }
});

test("failed balance reads block continuation", async () => {
  const page = await fixture({ wizardBalanceError: true });
  try {
    await page.getByText("deliveries.wizard.balance.loadError", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "deliveries.wizard.continue", exact: true }).isDisabled(), true);
    await page.evaluate(() => { window.wizardBalanceError = false; });
    await page.getByRole("button", { name: "deliveries.deliver.retry", exact: true }).click();
    await review(page);
  } finally { await page.close(); }
});

test("rejected item reads show the API reason; local failures stay generic", async () => {
  let page = await fixture({ wizardVisual: true, wizardItemsApiError: "invoice is not assigned to this delivery" });
  try {
    await page.getByText("Unable to load the items for this delivery.", { exact: true }).waitFor();
    await page.getByText("Reason: invoice is not assigned to this delivery", { exact: true }).waitFor();
  } finally { await page.close(); }
  page = await fixture({ wizardVisual: true, wizardNoItems: true });
  try {
    await page.getByText("Unable to load the items for this delivery.", { exact: true }).waitFor();
    assert.equal(await page.getByText(/^Reason:/).count(), 0);
  } finally { await page.close(); }
});

test("completion rechecks the balance and returns to balance review if it changed", async () => {
  const page = await fixture();
  try {
    await toSignature(page); await sign(page);
    await page.evaluate(() => { window.wizardBalance = 25; window.wizardCannotPay = true; });
    await page.getByRole("button", { name: "deliveries.deliver.submit", exact: true }).click();
    await page.getByText("deliveries.wizard.headings.balance", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.wizardRequests?.length ?? 0), 0);
  } finally { await page.close(); }
});

test("driver can record a cash payment from balance review", async () => {
  const page = await fixture({ wizardBalance: 50 });
  try {
    await page.locator("#journal-amount").waitFor();
    assert.equal(await page.locator("form form").count(), 0);
    await page.locator("#journal-employee").click();
    await page.getByRole("option", { name: /Driver/ }).click();
    await page.getByRole("button", { name: "deliveries.wizard.balance.recordPayment", exact: true }).click();
    await page.getByText("deliveries.wizard.balance.paid", { exact: true }).waitFor();
    const payments = await page.evaluate(() => window.wizardPayments);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].transactionType, "PAYMENT");
    assert.equal(payments[0].invoiceId, "68f800000000000000000001");
    assert.equal(payments[0].amount, 50);
    await review(page);
  } finally { await page.close(); }
});

test("an uncleared driver payment leaves delivery blocked", async () => {
  const page = await fixture({ wizardBalance: 50 });
  try {
    await page.locator("#journal-amount").waitFor();
    await page.locator("#journal-employee").click();
    await page.getByRole("option", { name: /Driver/ }).click();
    await page.locator("#journal-payment").click();
    await page.getByRole("option", { name: "CHECK", exact: true }).click();
    await page.locator("#journal-check-number").fill("000123");
    await page.locator("#journal-bank-account").click();
    await page.getByRole("option", { name: /Delivery bank/ }).click();
    await page.getByRole("button", { name: "deliveries.wizard.balance.recordPayment", exact: true }).click();
    await page.getByText("deliveries.wizard.balance.recordedPending", { exact: true }).waitFor();
    await page.getByText("deliveries.wizard.balance.pendingTitle", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "deliveries.wizard.continue", exact: true }).isDisabled(), true);
    assert.equal(await page.evaluate(() => window.wizardPayments.length), 1);
    assert.equal(await page.locator("#journal-check-number").inputValue(), "000123");
  } finally { await page.close(); }
});

test("balance review cannot be skipped while a balance is owed", async () => {
  const page = await fixture({ wizardBalance: 50 });
  try {
    await page.locator("#journal-amount").waitFor();
    const continueButton = page.getByRole("button", { name: "deliveries.wizard.continue", exact: true });
    assert.equal(await continueButton.isDisabled(), true);
    assert.equal(await page.locator('nav[class] ol a, nav[class] ol button').count(), 0);
    await continueButton.evaluate((button) => { button.disabled = false; button.click(); });
    await page.getByText("deliveries.wizard.balance.required", { exact: true }).last().waitFor();
    assert.equal(await page.getByText("deliveries.wizard.headings.balance", { exact: true }).count(), 1);
    assert.equal(await page.getByText("deliveries.wizard.headings.review", { exact: true }).count(), 0);
  } finally { await page.close(); }
});

const acceptLiability = (page) =>
  page.getByLabel("deliveries.wizard.balance.overrideAccept", { exact: true });

test("uncleared payments covering the balance allow delivery only after accepting liability", async () => {
  const page = await fixture({ wizardBalance: 50, wizardPendingChecks: [{ id: "check-1", amount: 50 }] });
  try {
    await page.getByText("deliveries.wizard.balance.overrideWarning", { exact: true }).waitFor();
    const continueButton = page.getByRole("button", { name: "deliveries.wizard.continue", exact: true });
    assert.equal(await continueButton.isDisabled(), true);
    await acceptLiability(page).check();
    await review(page);
    await next(page);
    await next(page);
    await sign(page);
    await finish(page);
    assert.equal(await page.evaluate(() => window.wizardRequests.length), 1);
  } finally { await page.close(); }
});

test("completion returns to balance review when the pending payment no longer covers the balance", async () => {
  const page = await fixture({ wizardBalance: 50, wizardPendingChecks: [{ id: "check-1", amount: 50 }] });
  try {
    await acceptLiability(page).check();
    await review(page);
    await next(page);
    await next(page);
    await sign(page);
    await page.evaluate(() => { window.wizardPendingChecks = []; });
    await page.getByRole("button", { name: "deliveries.deliver.submit", exact: true }).click();
    await page.getByText("deliveries.wizard.headings.balance", { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.wizardRequests?.length ?? 0), 0);
  } finally { await page.close(); }
});

test("pending payments short of the balance offer no override", async () => {
  const page = await fixture({ wizardBalance: 50, wizardPendingChecks: [{ id: "check-1", amount: 20 }] });
  try {
    await page.getByText("deliveries.wizard.balance.pendingShort", { exact: true }).waitFor();
    assert.equal(await acceptLiability(page).count(), 0);
    assert.equal(await page.getByRole("button", { name: "deliveries.wizard.continue", exact: true }).isDisabled(), true);
  } finally { await page.close(); }
});

test("payment, Cuadre and override require delivery view, Cuadre create and journal create", async () => {
  for (const denied of ["canViewDelivery", "canCreateIncomeStatement", "canCreateJournal"]) {
    const page = await fixture({ wizardBalance: 50, wizardPendingChecks: [{ id: "check-1", amount: 50 }], wizardDenied: [denied] });
    try {
      await page.getByText("deliveries.wizard.balance.paymentUnavailable", { exact: true }).waitFor();
      assert.equal(await acceptLiability(page).count(), 0, denied);
      assert.equal(await page.locator("#journal-amount").count(), 0, denied);
    } finally { await page.close(); }
  }
});

test("driver opens today's Cuadre at the route rate when none exists", async () => {
  const page = await fixture({ wizardBalance: 50, wizardNoStatement: true, wizardRowRate: 60 });
  try {
    await page.getByText("deliveries.wizard.balance.noStatementCreate", { exact: true }).waitFor();
    await page.getByRole("button", { name: "deliveries.wizard.balance.createStatement", exact: true }).click();
    await page.locator("#journal-amount").waitFor();
    const [created] = await page.evaluate(() => window.wizardStatements);
    assert.equal(created.branchId, 1);
    assert.equal(created.currency, "USD");
    assert.equal(created.rate, 60);
  } finally { await page.close(); }
});

test("a route without a rate cannot open a Cuadre from the wizard", async () => {
  const page = await fixture({ wizardBalance: 50, wizardNoStatement: true });
  try {
    await page.getByText("deliveries.wizard.balance.noStatementNoRate", { exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "deliveries.wizard.balance.createStatement", exact: true }).count(), 0);
  } finally { await page.close(); }
});

test("balance shows the DOP equivalent at the row rate, or reads the route rate once", async () => {
  let page = await fixture({ wizardBalance: 50, wizardRowRate: 60, wizardVisual: true });
  try {
    await page.getByText(/DOP\s3,000\.00 at route rate 60/).waitFor();
    assert.equal(await page.evaluate(() => window.wizardRouteReads ?? 0), 0);
  } finally { await page.close(); }
  page = await fixture({ wizardBalance: 50, wizardRouteRate: 58.5, wizardVisual: true });
  try {
    await page.getByText(/DOP\s2,925\.00 at route rate 58\.5/).waitFor();
    assert.equal(await page.evaluate(() => window.wizardRouteReads), 1);
  } finally { await page.close(); }
});
