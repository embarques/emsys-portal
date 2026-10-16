import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPreviewDocument,
  formatDocumentSize,
  MAX_DOCUMENT_BYTES,
  sortDocuments,
} from "../../src/lib/invoices/documents.ts";

test("document search and sorting preserve source records", () => {
  const items = [
    { name: "Receipt 10.pdf", createdAt: "2026-10-15T10:00:00Z" },
    { name: "receipt 2.pdf", createdAt: "2026-10-15T11:00:00Z" },
    { name: "Photo.jpg", createdAt: "2026-10-15T12:00:00Z" },
  ];
  assert.deepEqual(
    sortDocuments(items, " RECEIPT ", "name").map((item) => item.name),
    ["receipt 2.pdf", "Receipt 10.pdf"],
  );
  assert.equal(sortDocuments(items, "", "newest")[0].name, "Photo.jpg");
  assert.equal(items[0].name, "Receipt 10.pdf");
});
test("unsupported phone previews retain download fallback", () => {
  assert.equal(canPreviewDocument("image/heic"), false);
  assert.equal(canPreviewDocument("image/tiff"), false);
  assert.equal(canPreviewDocument("application/pdf"), true);
  assert.equal(canPreviewDocument("image/jpeg"), true);
  assert.equal(canPreviewDocument("image/svg+xml"), false);
});
test("upload limit and displayed sizes agree", () => {
  assert.equal(MAX_DOCUMENT_BYTES, 26_214_400);
  assert.equal(formatDocumentSize(MAX_DOCUMENT_BYTES), "25.0 MB");
  assert.equal(formatDocumentSize(1024), "1.0 KB");
  assert.equal(formatDocumentSize(32), "32 B");
});
