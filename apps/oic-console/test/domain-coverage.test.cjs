const test = require("node:test");
const assert = require("node:assert/strict");
const { domainCoverageRows } = require("../app/features/evaluation/domain-coverage.cjs");

test("domain coverage reports only scoped registry counts and keeps missing packs explicit", () => {
  const result = domainCoverageRows([
    { id: "pack-coding", domain: "coding", status: "VALIDATED", caseCount: 3 },
    { id: "pack-arabic", domain: "Arabic", status: "PUBLISHED", caseCount: 2 },
    { id: "pack-math", domain: "mathematics", status: "PUBLISHED", caseCount: 1 }
  ], [
    { id: "release-arabic", packId: "pack-arabic", status: "PUBLISHED" },
    { id: "release-unrelated", packId: "pack-math", status: "PUBLISHED" }
  ]);
  assert.deepEqual(result.map((row) => [row.key, row.packRevisionCount, row.caseCount, row.publishedReleaseCount, row.status]), [
    ["coding-tool-schema", 1, 3, 0, "VALIDATED"],
    ["retrieval-memory", 0, 0, 0, "MISSING"],
    ["multilingual-arabic", 1, 2, 1, "PUBLISHED"],
    ["communication-sales", 0, 0, 0, "MISSING"]
  ]);
  assert.equal(JSON.stringify(result).includes("mathematics"), false);
  assert.equal(JSON.stringify(result).includes("performance"), false);
});

test("domain coverage fails safely on absent or malformed registry lists", () => {
  assert.deepEqual(domainCoverageRows(null, {} ).map((row) => [row.packRevisionCount, row.caseCount, row.publishedReleaseCount, row.status]), Array.from({ length: 4 }, () => [0, 0, 0, "MISSING"]));
});
