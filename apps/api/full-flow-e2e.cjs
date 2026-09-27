// Full Knowledge V1 end-to-end: space -> text doc -> publish doc -> publish space
// -> prepare runtime -> publish runtime -> bind agent -> verify -> unbind -> verify.
const base = "http://localhost:4000";
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}. Set it before running this validation script.`);
  }
  return value;
};

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
    const j2 = await r2.json();
    if (r2.status >= 400) throw new Error("select-workspace failed " + r2.status);
    return { token: j2.accessToken };
  }
  if (r.status >= 400) throw new Error("login failed " + r.status);
  return { token: j.accessToken };
}

async function api(token, method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, body: j, raw: text };
}
const pick = (j, keys) => Array.isArray(j) ? j[0] : (j?.data?.[0] ?? j?.items?.[0] ?? j?.[0] ?? null);
const agentsOf = (j) => Array.isArray(j) ? j : (j?.data ?? j?.items ?? []);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000000");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const { token } = await login();
  const stamp = Date.now().toString(36);
  console.log("token ok. stamp:", stamp);

  // 1. create space
  const space = await api(token, "POST", "/api/v1/knowledge-base/spaces", {
    name: "E2E Space " + stamp, slug: "e2e-space-" + stamp
  });
  console.log("\n[1] create space ->", space.status, "id:", space.body?.id, "status:", space.body?.status);
  if (space.status >= 400) { console.log(space.raw.slice(0, 300)); return; }

  // 2. create text doc (synchronous processing)
  const content = [
    "What are the supported payment methods?",
    "We accept all major credit cards, PayPal, and bank transfers. For enterprise customers, we also support invoicing.",
    "How do I reset my password?",
    "Go to Settings, then Account, then select Reset Password. You will receive an email with a reset link valid for 24 hours.",
    "What is the SLA for the business plan?",
    "Business plan includes 99.9% uptime, 4 hour response time, and dedicated support during business hours."
  ].join("\n\n");
  const doc = await api(token, "POST", "/api/v1/knowledge-base/documents/text", {
    spaceId: space.body.id, name: "E2E FAQ " + stamp, slug: "e2e-faq-" + stamp, content
  });
  console.log("\n[2] create text doc ->", doc.status, "id:", doc.body?.id, "status:", doc.body?.status, "chunks:", doc.body?.chunkCount);
  if (doc.status >= 400) { console.log(doc.raw.slice(0, 300)); return; }

  // 3. publish doc (if not already published)
  let docStatus = doc.body?.status;
  if (docStatus !== "PUBLISHED") {
    const dp = await api(token, "POST", `/api/v1/knowledge-base/documents/${doc.body.id}/publish`, { changeSummary: "e2e" });
    console.log("\n[3] publish doc ->", dp.status, "status:", dp.body?.status, "revision:", dp.body?.revision);
    docStatus = dp.body?.status ?? docStatus;
    if (dp.status >= 400) console.log(doc.raw.slice(0, 300), "| publish:", dp.raw.slice(0, 200));
  } else console.log("\n[3] doc already PUBLISHED");

  // 3b. get the published version id (highest revision)
  const hist = await api(token, "GET", `/api/v1/knowledge-base/documents/${doc.body.id}/history`);
  const versions = Array.isArray(hist.body) ? hist.body : (hist.body?.data ?? hist.body?.items ?? []);
  const versionId = versions[0]?.id;
  console.log("    doc versions:", versions.length, "| versionId:", versionId, "rev:", versions[0]?.revision);
  if (!versionId) { console.log("NO VERSION FOUND:", hist.raw.slice(0, 300)); return; }
  // 4. publish the space
  const sp = await api(token, "POST", `/api/v1/knowledge-base/spaces/${space.body.id}/publish`);
  console.log("\n[4] publish space ->", sp.status, "status:", sp.body?.status, "rev:", sp.body?.revision, sp.status >= 400 ? sp.raw.slice(0, 250) : "");
  if (sp.status >= 400) { console.log("CANNOT PROCEED: space not publishable"); return; }

  // 5. prepare runtime
  const prep = await api(token, "POST", "/api/v1/retrieval-runtime", {
    name: "E2E Runtime " + stamp, knowledgeBaseId: space.body.id, language: "en",
    sources: [{ documentId: doc.body.id, versionId }]
  });
  console.log("\n[5] prepare runtime ->", prep.status, "status:", prep.body?.status, prep.status >= 400 ? prep.raw.slice(0, 300) : "");
  if (prep.status >= 400) return;

  // 5b. inspect doc metadata before/after a delay to detect async mutation
  const before = await api(token, "GET", `/api/v1/knowledge-base/documents/${doc.body.id}`);
  const bmeta = JSON.stringify(before.body?.metadata ?? before.body?.parserMetadata ?? null);
  await new Promise((r) => setTimeout(r, 5000));
  const after = await api(token, "GET", `/api/v1/knowledge-base/documents/${doc.body.id}`);
  const ameta = JSON.stringify(after.body?.metadata ?? after.body?.parserMetadata ?? null);
  console.log("    doc metadata before:", bmeta);
  console.log("    doc metadata after 5s:", ameta, "| changed:", bmeta !== ameta);

  // 6. publish runtime
  const pub = await api(token, "POST", `/api/v1/retrieval-runtime/${prep.body.id}/publish`);
  console.log("\n[6] publish runtime ->", pub.status, "snapshot:", pub.body?.id, "rev:", pub.body?.revision, "chunks:", pub.body?.chunkCount);
  if (pub.status >= 400) { console.log(pub.raw.slice(0, 300)); return; }

  // 7. find an agent (prefer knowledgeEnabled)
  const agents = await api(token, "GET", "/api/v1/agent-studio/agents?limit=100");
  const list = agentsOf(agents.body);
  const agent = list.find((a) => a.knowledgeEnabled === true) || list[0];
  console.log("\n[7] agents:", list.length, "| target:", agent?.name, agent?.id, "knowledgeEnabled:", agent?.knowledgeEnabled);
  if (!agent) { console.log("NO AGENT"); return; }

  // 8. bind
  const bind = await api(token, "POST", `/api/v1/agent-studio/agents/${agent.id}/retrieval-runtime`, { retrievalRuntimeId: prep.body.id });
  console.log("\n[8] BIND ->", bind.status, "retrievalRuntimeId:", bind.body?.retrievalRuntimeId ?? bind.body?.agent?.retrievalRuntimeId);
  const verify1 = await api(token, "GET", `/api/v1/agent-studio/agents/${agent.id}`);
  console.log("    verify GET -> retrievalRuntimeId:", verify1.body?.retrievalRuntimeId, "(expect runtime id)");

  // 9. unbind
  const unbind = await api(token, "DELETE", `/api/v1/agent-studio/agents/${agent.id}/retrieval-runtime`);
  console.log("\n[9] UNBIND ->", unbind.status);
  const verify2 = await api(token, "GET", `/api/v1/agent-studio/agents/${agent.id}`);
  console.log("    verify GET -> retrievalRuntimeId:", verify2.body?.retrievalRuntimeId, "(expect null)");

  console.log("\n=== FULL FLOW DONE ===");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
