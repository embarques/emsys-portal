#!/usr/bin/env node
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const freshAuth = process.argv.includes("--fresh-auth");

for (const dir of [
  "test-results",
  "playwright-report",
  "blob-report",
  ".next-playwright",
]) {
  rmSync(resolve(root, dir), { recursive: true, force: true });
}

if (freshAuth) {
  rmSync(resolve(root, "playwright/.auth/user.json"), { force: true });
}

mkdirSync(resolve(root, "playwright/.auth"), { recursive: true });

console.log(
  `[playwright] Cleaned artifacts${freshAuth ? " and auth session" : ""} — ready for UI/CLI runs.`,
);
