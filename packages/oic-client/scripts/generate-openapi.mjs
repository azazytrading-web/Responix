import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const generatedDirectory = resolve(packageRoot, "src/generated");
const source = new URL(process.env.OIC_OPENAPI_URL ?? "http://127.0.0.1:4100/docs-json");
const response = await fetch(source);
if (!response.ok) throw new Error(`OIC OpenAPI fetch failed with HTTP ${response.status}`);
const document = await response.json();
if (!document || typeof document !== "object" || !document.paths || typeof document.paths !== "object") throw new Error("OIC OpenAPI document has no paths object");
const required = ["/api/v1/runtime/invocations", "/api/v1/runtime/stream", "/v1/models", "/v1/chat/completions", "/v1/responses"];
for (const path of required) if (!(path in document.paths)) throw new Error(`OIC OpenAPI document is missing required path ${path}`);
const schemes = Object.values(document.components?.securitySchemes ?? {});
if (!schemes.some((scheme) => scheme && typeof scheme === "object" && scheme.type === "http" && scheme.scheme === "bearer")) throw new Error("OIC OpenAPI document is missing OIC bearer authentication");
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
const stableDocument = stable(document);
const pathLines = Object.keys(stableDocument.paths).sort().map((path) => {
  const operations = Object.keys(stableDocument.paths[path]).sort().map((method) => {
    const operation = stableDocument.paths[path][method];
    const operationId = typeof operation?.operationId === "string" ? JSON.stringify(operation.operationId) : "undefined";
    return `    ${JSON.stringify(method)}: { operationId: ${operationId} };`;
  });
  return `  ${JSON.stringify(path)}: {\n${operations.join("\n")}\n  };`;
});
const generatedTypes = [
  "// Generated from packages/oic-client/src/generated/oic-openapi.json. Do not edit manually.",
  "// Run `pnpm --filter @oic/client openapi:generate` against the OIC API to regenerate.",
  "export type OicApiPaths = {",
  ...pathLines,
  "};",
  "export type OicApiPath = keyof OicApiPaths;",
  ""
].join("\n");
await mkdir(generatedDirectory, { recursive: true });
await writeFile(resolve(generatedDirectory, "oic-openapi.json"), `${JSON.stringify(stableDocument, null, 2)}\n`, "utf8");
await writeFile(resolve(generatedDirectory, "oic-api.paths.ts"), generatedTypes, "utf8");
process.stdout.write(`Generated OIC OpenAPI document and path types from ${source.href}\n`);
