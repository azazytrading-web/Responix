// Live Agent->Retrieval Runtime binding e2e.
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
  if (r.status >= 400) throw new Error("login failed " + r.status + " " + JSON.stringify(j));
  if (j.requiresWorkspaceSelection) {
    const r2 = await fetch(`${base}/api/v1/auth/select-workspace`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectionToken: j.selectionToken, workspaceId: j.workspaces?.[0]?.id })
    });
    const j2 = await r2.json();
    if (r2.status >= 400) throw new Error("select-workspace failed " + r2.status);
    return { token: j2.accessToken, workspaceId: j.workspaces?.[0]?.id };
  }
  return { token: j.accessToken, workspaceId: j.workspaceId };
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

const pickSpace = (j) => Array.isArray(j) ? j[0] : (j?.data?.[0] ?? j?.items?.[0] ?? j?.[0]);
const pickAgents = (j) => Array.isArray(j) ? j : (j?.data ?? j?.items ?? []);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "00000000-0000-4000-8000-000000000000");

(async () => {
  const { token, workspaceId } = await login();
  console.log("token ok | workspace:", workspaceId);

  const spaces = await api(token, "GET", "/api/v1/knowledge-base/spaces?limit=100");
  const space = pickSpace(spaces.body);
  console.log("\n[1] space:", space?.id, space?.name, "status:", space?.status);
  if (!space) { console.log("NO SPACE FOUND"); return; }

  const stamp = Date.now().toString(36);
  const prep = await api(token, "POST", "/api/v1/retrieval-runtime", {
    name: "BindingTest " + stamp, knowledgeBaseId: space.id, language: "en"
  });
  console.log("\n[2] prepare runtime ->", prep.status, prep.body?.status ?? prep.raw.slice(0, 200));
  const runtime = prep.body;
  if (prep.status >= 400) console.log("PREPARE FAILED:", prep.raw.slice(0, 400));

  let published = false;
  if (runtime?.id && runtime.status === "PREPARED") {
    const pub = await api(token, "POST", `/api/v1/retrieval-runtime/${runtime.id}/publish`);
    console.log("\n[3] publish ->", pub.status, "snapshot:", pub.body?.id ?? "n/a", "rev:", pub.body?.revision);
    if (pub.status >= 200 && pub.status < 300) published = true;
    else console.log("PUBLISH FAILED:", pub.raw.slice(0, 500));
  } else if (runtime?.status === "REJECTED") {
    console.log("\n[3] runtime REJECTED; cannot publish. diagnostics:", JSON.stringify(runtime.diagnostics ?? []).slice(0, 400));
  }

  const agents = await api(token, "GET", "/api/v1/agent-studio/agents?limit=100");
  const list = pickAgents(agents.body);
  const enabled = list.find((a) => a.knowledgeEnabled === true);
  console.log("\n[4] agents total:", list.length, "| knowledgeEnabled:", list.filter((a) => a.knowledgeEnabled).length, "| target:", enabled?.name, enabled?.id);
  if (!enabled) { console.log("NO knowledgeEnabled AGENT"); return; }

  if (!published) {
    console.log("\n--- SKIP bind/unbind (no published runtime). Testing error paths only. ---");
  } else {
    const bind = await api(token, "POST", `/api/v1/agent-studio/agents/${enabled.id}/retrieval-runtime`, { retrievalRuntimeId: runtime.id });
    console.log("\n[5] BIND ->", bind.status, "retrievalRuntimeId:", bind.body?.retrievalRuntimeId ?? bind.body?.agent?.retrievalRuntimeId);
    const after = await api(token, "GET", `/api/v1/agent-studio/agents/${enabled.id}`);
    console.log("    GET agent -> retrievalRuntimeId:", after.body?.retrievalRuntimeId, "knowledgeEnabled:", after.body?.knowledgeEnabled);

    const unbind = await api(token, "DELETE", `/api/v1/agent-studio/agents/${enabled.id}/retrieval-runtime`);
    console.log("\n[6] UNBIND ->", unbind.status);
    const after2 = await api(token, "GET", `/api/v1/agent-studio/agents/${enabled.id}`);
    console.log("    GET agent -> retrievalRuntimeId:", after2.body?.retrievalRuntimeId, "(expected null)");

    const rebind = await api(token, "POST", `/api/v1/agent-studio/agents/${enabled.id}/retrieval-runtime`, { retrievalRuntimeId: runtime.id });
    console.log("\n[7] REBIND ->", rebind.status);
    const reUnbind = await api(token, "DELETE", `/api/v1/agent-studio/agents/${enabled.id}/retrieval-runtime`);
    console.log("    RE-UNBIND ->", reUnbind.status);
  }
  const draftPrep = await api(token, "POST", "/api/v1/retrieval-runtime", {
    name: "BindingTestDraft " + stamp, knowledgeBaseId: space.id, language: "en"
  });
  const draft = draftPrep.body;
  if (draft?.id && draft.status !== "PUBLISHED") {
    const bad = await api(token, "POST", `/api/v1/agent-studio/agents/${enabled.id}/retrieval-runtime`, { retrievalRuntimeId: draft.id });
    console.log("\n[8] BIND to DRAFT runtime ->", bad.status, "(expect 400/409):", bad.body?.message ?? bad.raw.slice(0, 200));
  }

  const badMissing = await api(token, "POST", `/api/v1/agent-studio/agents/${enabled.id}/retrieval-runtime`, { retrievalRuntimeId: uuid() });
  console.log("\n[9] BIND to MISSING runtime ->", badMissing.status, "(expect 404):", badMissing.body?.message ?? badMissing.raw.slice(0, 200));

  const iso = await api(token, "GET", `/api/v1/agent-studio/agents/${uuid()}`);
  console.log("\n[10] GET foreign agent ->", iso.status, "(expect 404 workspace isolation):", iso.body?.message ?? iso.raw.slice(0, 160));

  console.log("\n=== DONE ===");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
