const families = [
  { key: "coding-tool-schema", domains: ["coding", "agentic_coding", "software_engineering", "terminal_computer", "tool_function"] },
  { key: "retrieval-memory", domains: ["retrieval_RAG", "memory"] },
  { key: "multilingual-arabic", domains: ["language_multilingual", "Arabic"] },
  { key: "communication-sales", domains: ["customer_service", "sales", "negotiation"] }
];

function domainCoverageRows(packValues, releaseValues) {
  const packs = Array.isArray(packValues) ? packValues : [];
  const releases = Array.isArray(releaseValues) ? releaseValues : [];
  return families.map((family) => {
    const familyPacks = packs.filter((pack) => family.domains.includes(pack?.domain));
    const packIds = new Set(familyPacks.map((pack) => pack?.id).filter((id) => typeof id === "string"));
    const familyReleases = releases.filter((release) => packIds.has(release?.packId));
    const packStates = new Set(familyPacks.map((pack) => pack?.status));
    const releaseStates = new Set(familyReleases.map((release) => release?.status));
    const status = releaseStates.has("PUBLISHED") ? "PUBLISHED" : releaseStates.has("COMPROMISED") ? "COMPROMISED" : packStates.has("VALIDATED") ? "VALIDATED" : packStates.has("DRAFT") ? "DRAFT" : "MISSING";
    return {
      key: family.key,
      domains: family.domains,
      packRevisionCount: familyPacks.length,
      caseCount: familyPacks.reduce((sum, pack) => sum + (Number.isInteger(pack?.caseCount) ? pack.caseCount : 0), 0),
      publishedReleaseCount: familyReleases.filter((release) => release?.status === "PUBLISHED").length,
      status
    };
  });
}

module.exports = { domainCoverageRows };
