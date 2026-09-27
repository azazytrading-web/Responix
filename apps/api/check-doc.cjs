// Diagnose SOURCE_METADATA_CHANGED: compare stored retrievalPackage.input vs fresh dto serialization.
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

function stableStringify(value) {
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const hash = (value) => crypto.createHash("sha256").update(stableStringify(value)).digest("hex");

const p = new PrismaClient();
(async () => {
  try {
    const rt = await p.retrievalRuntime.findFirst({ orderBy: { createdAt: "desc" }, where: { name: { startsWith: "E2E Runtime" } } });
    if (!rt) { console.log("no E2E runtime found"); return; }
    const stored = rt.retrievalPackage;
    const storedInput = stored.input;
    console.log("runtime:", rt.id, "| status:", rt.status);
    console.log("stored packageHash:", stored.hashes?.packageHash);
    console.log("\nstored input keys:", JSON.stringify(Object.keys(storedInput)));
    console.log("stored input JSON:", JSON.stringify(storedInput));
    // Test: simulate a fresh class-transformer instance that adds optional fields as undefined
    const body = { name: storedInput.name, knowledgeBaseId: storedInput.knowledgeBaseId, language: storedInput.language, sources: storedInput.sources };
    const freshLike = new (function (b) { Object.assign(this, b); Object.keys({ name: 1, knowledgeBaseId: 1, language: 1, allowedMimeTypes: 1, sources: 1, collections: 1, folderIds: 1, categoryIds: 1, tagIds: 1, filters: 1, variables: 1, metadata: 1 }).forEach((k) => { if (!(k in b)) this[k] = undefined; }); })(body);
    console.log("\n-- Simulation: fresh instance with optional fields as undefined --");
    console.log("fresh own keys:", JSON.stringify(Object.keys(freshLike)));
    console.log("stableStringify(storedInput) == stableStringify(freshLike)?",
      stableStringify(storedInput) === stableStringify(freshLike));
    console.log("stableStringify(storedInput):", stableStringify(storedInput).slice(0, 500));
    console.log("\n-- JSON round-trip normalization test --");
    const normalized = JSON.parse(JSON.stringify(freshLike));
    console.log("stableStringify(JSON-normalized fresh) == stableStringify(storedInput)?",
      stableStringify(normalized) === stableStringify(storedInput));
  } catch (e) {
    console.log("ERR", e.message, e.stack?.split("\n").slice(0, 3).join(" "));
  } finally {
    await p.$disconnect();
  }
})();

