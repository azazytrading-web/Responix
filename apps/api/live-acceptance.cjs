// Knowledge V1 LIVE acceptance test (Section 7):
//   1 login -> 2 create space -> 3 upload PDF (500-fix) -> 4 poll async processing
//   5 create text doc (known content, reliable retrieval) -> 6 publish docs
//   7 publish space -> 8 prepare runtime -> 9 publish runtime (SOURCE_METADATA_CHANGED fix)
//   10 execute retrieval (retrieval "system message" content) -> 11 bind agent -> verify.
const base = "http://localhost:4000";
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}. Set it before running this validation script.`);
  }
  return value;
};
const fs = require("fs");
const path = require("path");

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

async function api(token, method, p, body) {
  const r = await fetch(base + p, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, body: j, raw: text };
}

async function uploadPdf(token, filePath, fields) {
  const buffer = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append("file", new Blob([buffer], { type: "application/pdf" }), path.basename(filePath));
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await fetch(base + "/api/v1/knowledge-base/documents/upload", {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd
  });
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch {}
  return { status: r.status, body: j, raw: text };
}

const agentsOf = (j) => Array.isArray(j) ? j : (j?.data ?? j?.items ?? []);
const versionsOf = (j) => Array.isArray(j) ? j : (j?.data ?? j?.items ?? []);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROCESSED = new Set(["READY", "INDEXED", "READY_TO_PUBLISH"]);

(async () => {
  const { token } = await login();
  const stamp = Date.now().toString(36);
  console.log("token ok. stamp:", stamp);

  // 1. create space
  const space = await api(token, "POST", "/api/v1/knowledge-base/spaces", {
    name: "Acceptance Space " + stamp, slug: "acc-space-" + stamp
  });
  console.log("\n[1] create space ->", space.status, "id:", space.body?.id, "status:", space.body?.status);
  if (space.status >= 400) { console.log(space.raw.slice(0, 300)); return; }
  const spaceId = space.body.id;

  // 2. upload PDF (the original 500 bug)
  const pdfPath = path.join(__dirname, "tmp-pdf-test", "real917.pdf");
  const pdfSize = fs.statSync(pdfPath).size;
  console.log("\n[2] upload PDF ->", path.basename(pdfPath), "(" + pdfSize + " bytes)");
  const up = await uploadPdf(token, pdfPath, {
    spaceId, name: "Acceptance PDF " + stamp, slug: "acc-pdf-" + stamp
  });
  console.log("    upload ->", up.status, "id:", up.body?.id, "status:", up.body?.status, "chunks:", up.body?.chunkCount);
  if (up.status === 500) { console.log("    *** 500 REGRESSION — PDF upload still broken ***"); console.log(up.raw.slice(0, 500)); return; }
  if (up.status >= 400) { console.log(up.raw.slice(0, 400)); return; }
  const pdfDocId = up.body.id;

  // 3. poll async PDF processing
  let pdfDoc = up.body, pdfStatus = pdfDoc?.status, pdfChunks = pdfDoc?.chunkCount;
  for (let i = 0; i < 40; i++) {
    const g = await api(token, "GET", `/api/v1/knowledge-base/documents/${pdfDocId}`);
    pdfDoc = g.body || pdfDoc; pdfStatus = pdfDoc?.status; pdfChunks = pdfDoc?.chunkCount;
    if (PROCESSED.has(pdfStatus) || pdfStatus === "FAILED" || pdfStatus === "PUBLISHED") break;
    if (i % 3 === 0) console.log(`    poll[${i}] status: ${pdfStatus} chunks: ${pdfChunks}`);
    await sleep(2000);
  }
  console.log("    [3] PDF final -> status:", pdfStatus, "| chunks:", pdfChunks);

  // 4. create text doc (known content for reliable retrieval)
  const content = [
    "What are the supported payment methods?",
    "We accept all major credit cards, PayPal, and bank transfers. For enterprise customers, we also support invoicing.",
    "How do I reset my password?",
    "Go to Settings, then Account, then select Reset Password. You will receive an email with a reset link valid for 24 hours.",
    "What is the SLA for the business plan?",
    "Business plan includes 99.9% uptime, 4 hour response time, and dedicated support during business hours."
  ].join("\n\n");
  const tdoc = await api(token, "POST", "/api/v1/knowledge-base/documents/text", {
    spaceId, name: "Acceptance FAQ " + stamp, slug: "acc-faq-" + stamp, content
  });
  console.log("\n[4] create text doc ->", tdoc.status, "id:", tdoc.body?.id, "status:", tdoc.body?.status, "chunks:", tdoc.body?.chunkCount);
  if (tdoc.status >= 400) { console.log(tdoc.raw.slice(0, 300)); return; }
  const textDocId = tdoc.body.id;

  // 5. publish both docs and collect sources
  const sources = [];
  for (const [label, d] of [["pdf", { id: pdfDocId, status: pdfStatus }], ["text", { id: textDocId, status: tdoc.body?.status }]]) {
    let st = d.status;
    if (st !== "PUBLISHED") {
      const dp = await api(token, "POST", `/api/v1/knowledge-base/documents/${d.id}/publish`, { changeSummary: "acceptance" });
      st = dp.body?.status;
      console.log(`\n[5] publish ${label} doc -> ${dp.status} status: ${st} rev: ${dp.body?.revision}`);
      if (dp.status >= 400) { console.log(dp.raw.slice(0, 300)); }
    } else {
      console.log(`\n[5] ${label} doc already PUBLISHED`);
    }
    const hist = await api(token, "GET", `/api/v1/knowledge-base/documents/${d.id}/history`);
    const versions = versionsOf(hist.body);
    const vid = versions[0]?.id;
    const chunks = versions[0]?.snapshot?.chunks?.length ?? 0;
    console.log(`    ${label} versions: ${versions.length} | versionId: ${vid} rev: ${versions[0]?.revision} chunks: ${chunks}`);
    if (vid && chunks > 0) sources.push({ documentId: d.id, versionId: vid });
  }
  if (!sources.length) { console.log("    NO PUBLISHABLE SOURCES (0 chunks)"); return; }
  console.log("    sources ready:", sources.length);

  // 6. publish the space
  const sp = await api(token, "POST", `/api/v1/knowledge-base/spaces/${spaceId}/publish`);
  console.log("\n[6] publish space ->", sp.status, "rev:", sp.body?.revision, sp.status >= 400 ? sp.raw.slice(0, 250) : "");
  if (sp.status >= 400) { console.log("CANNOT PROCEED: space not publishable"); return; }

  // 7. prepare runtime
  const prep = await api(token, "POST", "/api/v1/retrieval-runtime", {
    name: "Acceptance Runtime " + stamp, knowledgeBaseId: spaceId, language: "en", sources
  });
  console.log("\n[7] prepare runtime ->", prep.status, "id:", prep.body?.id, "status:", prep.body?.status, prep.status >= 400 ? prep.raw.slice(0, 300) : "");
  if (prep.status >= 400) return;
  const runtimeId = prep.body.id;

  // 8. publish runtime (the SOURCE_METADATA_CHANGED fix)
  const pub = await api(token, "POST", `/api/v1/retrieval-runtime/${runtimeId}/publish`);
  console.log("\n[8] publish runtime ->", pub.status, "snapshot:", pub.body?.id, "rev:", pub.body?.revision, "hash:", (pub.body?.packageHash ?? "").slice(0, 12));
  if (pub.status >= 400) { console.log("    *** PUBLISH FAILED (SOURCE_METADATA_CHANGED?) ***"); console.log(pub.raw.slice(0, 500)); return; }
  const snapshotId = pub.body.id;

  // 9. execute retrieval (the "system message" content)
  const rex = await api(token, "POST", "/api/v1/retrieval-executions", {
    retrievalRuntimeSnapshotId: snapshotId,
    query: "What are the supported payment methods? How do I reset my password?",
    mode: "HYBRID", topK: 10, minScore: 0
  });
  const pkg = rex.body;
  console.log("\n[9] execute retrieval ->", rex.status);
  if (rex.status >= 400) { console.log(rex.raw.slice(0, 500)); }
  else {
    console.log("    query:", pkg?.query);
    console.log("    documents:", pkg?.documents?.length, "| citations:", pkg?.citations?.length);
    console.log("    packageHash:", pkg?.packageHash, "| budget:", pkg?.budget ?? pkg?.tokenBudget);
    if (pkg?.documents?.length) {
      const top = pkg.documents[0];
      console.log("    top doc:", JSON.stringify(top?.name), "score:", top?.score, "contentLen:", (top?.content ?? "").length);
      console.log("    sample content:", (top?.content ?? "").slice(0, 140).replace(/\n/g, " "));
    }
    console.log("    -> this payload is what the agent execution injects as the retrieval SYSTEM message");
  }

  // 10. bind agent + verify persistence
  const agents = await api(token, "GET", "/api/v1/agent-studio/agents?limit=100");
  const list = agentsOf(agents.body);
  const agent = list.find((a) => a.knowledgeEnabled === true) || list[0];
  console.log("\n[10] agents:", list.length, "| target:", agent?.name, agent?.id, "knowledgeEnabled:", agent?.knowledgeEnabled);
  if (!agent) { console.log("NO AGENT"); return; }
  const bind = await api(token, "POST", `/api/v1/agent-studio/agents/${agent.id}/retrieval-runtime`, { retrievalRuntimeId: runtimeId });
  console.log("    bind ->", bind.status, "retrievalRuntimeId:", bind.body?.retrievalRuntimeId ?? bind.body?.agent?.retrievalRuntimeId);
  const verify = await api(token, "GET", `/api/v1/agent-studio/agents/${agent.id}`);
  const bound = verify.body?.retrievalRuntimeId;
  console.log("    verify GET -> retrievalRuntimeId:", bound, bound === runtimeId ? "(MATCH)" : "(MISMATCH)");

  // 11. leave it unbound (clean state)
  const unbind = await api(token, "DELETE", `/api/v1/agent-studio/agents/${agent.id}/retrieval-runtime`);
  console.log("\n[11] unbind (cleanup) ->", unbind.status);

  console.log("\n=== LIVE ACCEPTANCE DONE ===");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
