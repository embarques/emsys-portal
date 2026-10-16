import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { before, after, test } from "node:test";
import { chromium } from "@playwright/test";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let browser, directory, script, css;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "emsys-documents-"));
  const compiler = webpackPackage.webpack({
    mode: "development",
    devtool: false,
    entry: path.resolve("tests/browser/fixtures/invoice-documents.tsx"),
    output: { path: directory, filename: "fixture.js" },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@/lib/layout/hooks/use-workspace-tabs": path.resolve(
          "tests/browser/fixtures/documents-navigation.ts",
        ),
        "@/lib/i18n": path.resolve("tests/browser/fixtures/documents-i18n.ts"),
        "@/lib/auth/hooks/use-auth": path.resolve(
          "tests/browser/fixtures/documents-auth.ts",
        ),
        "@/lib/store/hooks": path.resolve(
          "tests/browser/fixtures/documents-auth.ts",
        ),
        "@/lib/invoices/display": path.resolve(
          "tests/browser/fixtures/documents-auth.ts",
        ),
        "@/lib/invoices/api/invoice-documents-api": path.resolve(
          "tests/browser/fixtures/documents-api.ts",
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

async function fixture(width = 1440, readOnly = false, multipleDocs = false) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });
  page.on("pageerror", (error) => console.error("UI error:", error.message));
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div>',
  );
  await page.evaluate((value) => {
    window.readOnly = value;
    window.process = { env: { NODE_ENV: "development" } };
  }, readOnly);
  await page.addStyleTag({ content: css });
  await page.evaluate(
    ({ mobile, multipleDocs }) => {
      window.mobileDocs = mobile;
      window.multipleDocs = multipleDocs;
    },
    { mobile: width < 768, multipleDocs },
  );
  await page.addScriptTag({ content: script });
  await page
    .getByRole("button", { name: "signed-invoice.pdf", exact: true })
    .waitFor();
  return page;
}

test("invoice documents support preview, search, rename and confirmed deletion", async () => {
  const page = await fixture();
  try {
    await page
      .getByRole("button", { name: "signed-invoice.pdf", exact: true })
      .click();
    await page
      .getByTitle("signed-invoice.pdf", { exact: true })
      .last()
      .waitFor();
    assert.equal(await page.locator("iframe").count(), 1);
    await page.screenshot({
      path: path.join(tmpdir(), "emsys-invoice-documents-desktop.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Actions for signed-invoice.pdf" })
      .click();
    await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("signed-copy.pdf");
    await page.getByRole("button", { name: "Rename", exact: true }).click();
    await page
      .getByRole("button", { name: "signed-copy.pdf", exact: true })
      .waitFor();
    await page
      .getByRole("textbox", { name: "Search documents" })
      .fill("signed-copy");
    assert.equal(await page.locator("tbody tr").count(), 1);
    await page
      .getByRole("button", { name: "Actions for signed-copy.pdf" })
      .click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    assert.equal(await page.getByRole("dialog").count(), 1);
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByText("No matching documents in the loaded files.")
      .waitFor();
  } finally {
    await page.close();
  }
});

test("phone formats have download fallback and multiple uploads show progress", async () => {
  const page = await fixture();
  try {
    await page
      .getByRole("button", { name: "phone-photo.heic", exact: true })
      .click();
    await page
      .getByText(
        "This format cannot be previewed here. Download the original file to open it.",
      )
      .waitFor();
    await page.locator('input[type="file"]').setInputFiles([
      {
        name: "new-photo.heic",
        mimeType: "image/heic",
        buffer: Buffer.from("phone"),
      },
      {
        name: "receipt.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF"),
      },
    ]);
    await page
      .getByRole("button", { name: "new-photo.heic", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "receipt.pdf", exact: true })
      .waitFor();
    assert.equal(
      (await page.getByText("Uploaded", { exact: true }).count()) >= 2,
      true,
    );
    await page.getByRole("button", { name: "Grid view" }).click();
    await page
      .getByRole("button", { name: "delivery-receipt.jpg", exact: true })
      .waitFor();
  } finally {
    await page.close();
  }
});

test("mobile layout contains overflow and read-only users cannot mutate documents", async () => {
  const page = await fixture(390, true);
  try {
    assert.equal(
      await page
        .getByRole("button", { name: "Upload documents", exact: true })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Actions for signed-invoice.pdf" })
      .click();
    assert.equal(
      await page.getByRole("menuitem", { name: "Delete", exact: true }).count(),
      0,
    );
    assert.equal(
      await page.getByRole("menuitem", { name: "Rename", exact: true }).count(),
      0,
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "phone-photo.heic", exact: true })
      .click();
    await page
      .getByText(
        "This format cannot be previewed here. Download the original file to open it.",
      )
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: path.join(tmpdir(), "emsys-invoice-documents-mobile.png"),
      fullPage: true,
    });
  } finally {
    await page.close();
  }
});

test("Documents shortcut opens an invoice-number tab and is disabled for multiple selection", async () => {
  const page = await fixture();
  try {
    const button = page.getByRole("button", { name: "Documents", exact: true });
    await button.click();
    const tabs = await page.evaluate(() => window.documentTabs);
    assert.equal(tabs[0].feature, "invoice-documents");
    assert.equal(tabs[0].entityId, "invoice");
    assert.equal(tabs[0].label, "INV-456");
  } finally {
    await page.close();
  }
  const multiple = await fixture(1440, false, true);
  try {
    assert.equal(
      await multiple
        .getByRole("button", { name: "Documents", exact: true })
        .isDisabled(),
      true,
    );
  } finally {
    await multiple.close();
  }
  const mobile = await fixture(390);
  try {
    await mobile
      .getByRole("button", { name: "Documents", exact: true })
      .click();
    assert.equal(await mobile.evaluate(() => window.openedMobile), true);
  } finally {
    await mobile.close();
  }
});

test("document info exposes upload and modification metadata in list and thumbnail views", async () => {
  const page = await fixture(390, true);
  try {
    for (const view of ["List view", "Grid view"]) {
      await page.getByRole("button", { name: view, exact: true }).click();
      const info = page.getByRole("button", {
        name: "Information for signed-invoice.pdf",
        exact: true,
      });
      await info.click();
      const dialog = page.getByRole("dialog");
      await dialog
        .getByRole("heading", { name: "Document information", exact: true })
        .waitFor();
      assert.equal(
        await dialog
          .locator("dd")
          .filter({ hasText: "Hector Martinez" })
          .count(),
        1,
      );
      assert.equal(
        await dialog.locator("dd").filter({ hasText: "Ana Perez" }).count(),
        1,
      );
      assert.equal(
        await dialog.getByText("2.0 KB (2,048 bytes)", { exact: true }).count(),
        1,
      );
      assert.equal(await dialog.getByText("PDF", { exact: true }).count(), 1);
      assert.equal(
        await dialog
          .getByText("Oct 15, 2026, 2:00 PM EDT", { exact: true })
          .count(),
        1,
      );
      assert.equal(await page.locator("iframe").count(), 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Information for signed-invoice.pdf");
    }
  } finally {
    await page.close();
  }
});
