// End-to-end Knowledge acceptance: login -> space -> upload PDF -> poll -> publish.
const base = "http://localhost:4000";
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}. Set it before running this validation script.`);
  }
  return value;
};
const email = requiredEnv("RESPONIX_E2E_EMAIL");
const password = requiredEnv("RESPONIX_E2E_PASSWORD");
const fs = require("fs");
const path = require("path");

async function login() {
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const j = await r.json();
  if (r.status >= 400) throw new Error("login failed: " + r.status + " " + JSON.stringify(j));
  if (j.requiresWorkspaceSelection) {
    const ws = j.workspaces?.[0];
    const r2 = await fetch(`${base}/api/v1/auth/select-workspace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectionToken: j.selectionToken, workspaceId: ws?.id })
    });
    const j2 = await r2.json();
    if (r2.status >= 400) throw new Error("select-workspace failed: " + r2.status + " " + JSON.stringify(j2));
    return j2.accessToken;
  }
  return j.accessToken;
}

async function api(token, method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, body: j, raw: text };
}

(async () => {
  const token = await login();
  console.log("token ok");

  const spaces = await api(token, "GET", "/api/v1/knowledge-base/spaces");
  console.log("GET spaces ->", spaces.status);
  let space = (Array.isArray(spaces.body) ? spaces.body : spaces.body?.items)?.[0];
  if (!space) {
    const created = await api(token, "POST", "/api/v1/knowledge-base/spaces", {
      name: "E2E Space",
      slug: "e2e-space-" + Date.now().toString(36)
    });
    space = created.body;
    console.log("created space ->", created.status, created.raw.slice(0, 200));
  }
  console.log("space:", space.id, space.name);

  const pdfPath = path.join(__dirname, "tmp-pdf-test", "real917.pdf");
  const buf = fs.readFileSync(pdfPath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buf)], { type: "application/pdf" }), "acceptance.pdf");
  form.append("spaceId", space.id);
  form.append("name", "Acceptance PDF " + Date.now().toString(36));
  form.append("slug", "acceptance-pdf-" + Date.now().toString(36));

  const ur = await fetch(base + "/api/v1/knowledge-base/documents/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const utext = await ur.text();
  let uj = null;
  try { uj = JSON.parse(utext); } catch { /* not json */ }
  console.log("upload ->", ur.status, ur.status >= 400 ? utext.slice(0, 600) : "ok");
  const docId = uj?.id;
  if (!docId) {
    console.log("no doc id; body:", utext.slice(0, 600));
    process.exit(1);
  }
  console.log("document id:", docId);

  let last = null;
  for (let i = 0; i < 50; i++) {
    await new Promise((res) => setTimeout(res, 1500));
    const d = await api(token, "GET", `/api/v1/knowledge-base/documents?spaceId=${space.id}&limit=100`);
    const list = Array.isArray(d.body) ? d.body : d.body?.items ?? [];
    const doc = list.find((x) => x.id === docId) ?? list[0];
    last = doc;
    if (doc) {
      const meta = doc.embeddingStatusMetadata ? JSON.stringify(doc.embeddingStatusMetadata).slice(0, 160) : "";
      console.log(`poll ${i}: status=${doc.status} embed=${doc.embeddingStatus ?? doc.embedding?.status} ${meta}`);
      if (["READY", "INDEXED", "PUBLISHED", "ACTIVE"].includes(doc.status)) break;
    }
  }
  console.log("FINAL doc:", last ? JSON.stringify(last, null, 1).slice(0, 1200) : "none");

  // publish if a document is in a publishable state
  const pub = await api(token, "POST", `/api/v1/knowledge-base/documents/${docId}/publish`, {
    changeSummary: "e2e acceptance publish"
  });
  console.log("publish ->", pub.status, pub.raw.slice(0, 400));
  process.exit(0);
})().catch((e) => {
  console.log("FATAL", e.stack || e.message);
  process.exit(1);
});
