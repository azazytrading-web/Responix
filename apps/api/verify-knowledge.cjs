// Quick check: login, list documents in the e2e space, print shape + acceptance doc status.
const base = "http://localhost:4000";
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}. Set it before running this validation script.`);
  }
  return value;
};
const fs = require("fs");
async function login() {
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: requiredEnv("RESPONIX_E2E_EMAIL"), password: requiredEnv("RESPONIX_E2E_PASSWORD") })
  });
  const j = await r.json();
  if (j.requiresWorkspaceSelection) {
    const r2 = await fetch(`${base}/api/v1/auth/select-workspace`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectionToken: j.selectionToken, workspaceId: j.workspaces?.[0]?.id })
    });
    return (await r2.json()).accessToken;
  }
  return j.accessToken;
}
(async () => {
  const token = await login();
  const sp = await (await fetch(`${base}/api/v1/knowledge-base/spaces`, { headers: { Authorization: `Bearer ${token}` } })).json();
  const space = (Array.isArray(sp) ? sp : sp.items)?.[0];
  console.log("space:", space?.id, space?.name, "status:", space?.status);
  const r = await fetch(`${base}/api/v1/knowledge-base/documents?spaceId=${space.id}&limit=100`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const raw = await r.text();
  let j = null; try { j = JSON.parse(raw); } catch {}
  const list = Array.isArray(j) ? j : j?.data ?? j?.items ?? j?.documents ?? [];
  console.log("total docs:", Array.isArray(j) ? j.length : j?.total, "| list len:", list.length);
  console.log("RAW SHAPE:", raw.slice(0, 400));
  const acc = list.find((d) => (d.slug || "").startsWith("acceptance-pdf-"));
  if (acc) {
    console.log("\nACCEPTANCE DOC:");
    console.log("  id:", acc.id);
    console.log("  status:", acc.status, "| published:", acc.isPublished ?? acc.published ?? acc.publication?.status);
    console.log("  embeddingStatus:", acc.embeddingStatus ?? acc.embedding?.status);
    console.log("  chunkCount:", acc.chunkCount, "| version:", acc.currentVersion?.status ?? acc.versionStatus);
    console.log("  embeddingStatusMetadata:", acc.embeddingStatusMetadata ? JSON.stringify(acc.embeddingStatusMetadata) : "null");
    console.log("  full:", JSON.stringify(acc, null, 1).slice(0, 1500));
  } else {
    console.log("no acceptance doc found; first doc:", JSON.stringify(list[0], null, 1).slice(0, 600));
  }
  process.exit(0);
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
