import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(packageRoot, "src/generated/api.types.ts");
const source = new URL(process.env.RESPONIX_OPENAPI_URL ?? "http://localhost:4000/docs-json");

const ast = await openapiTS(source);
const output = [
  "// This file is generated from the backend OpenAPI document. Do not edit manually.",
  "// Run `pnpm --filter @responix/api-client openapi:generate` to regenerate.",
  "",
  astToString(ast),
].join("\n");

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output, "utf8");

process.stdout.write(`Generated API types from ${source.href}\n`);
