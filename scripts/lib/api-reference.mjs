import fs from "node:fs";
import path from "node:path";

/** Authoritative API contract: the emsys-api clone's generated Swagger 2 document. */
export const API_REFERENCE_SPEC = ".reference/emsys-api/docs/swagger.json";

export function readApiReferenceSpec(root) {
  const filename = path.join(root, API_REFERENCE_SPEC);
  if (!fs.existsSync(filename)) {
    throw new Error(
      `${API_REFERENCE_SPEC} not found. Clone https://github.com/embarques/emsys-api into .reference/emsys-api and pull dev.`,
    );
  }
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}
