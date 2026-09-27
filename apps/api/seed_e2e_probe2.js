// Disposable probe: identify real Agent A (active on connection) and Agent B (published, READY) for the switch e2e.

const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

(function loadEnv() {
  const root = path.resolve(__dirname, "..", "..");
  const envFile = path.join(root, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
    }
  }
})();

async function main() {
  const prisma = new PrismaClient();
  try {
    const ws = await prisma.workspace.findFirst({ where: { slug: "responix-development" }, select: { id: true } });
    console.log("workspaceId:", ws.id);

    console.log("\n=== Published agents ===");
    const published = await prisma.aiAgent.findMany({ where: { workspaceId: ws.id, status: "PUBLISHED", deletedAt: null }, select: { id: true, name: true, slug: true, version: true } });
    for (const a of published) console.log("  pub:", a.id, a.name, "v" + a.version);

    console.log("\n=== Connections ===");
    const conns = await prisma.channelConnection.findMany({ where: { workspaceId: ws.id }, select: { id: true, channelId: true, stateVersion: true, state: true } });
    for (const c of conns) console.log("  conn:", c.id, "channel=" + c.channelId, "stateVersion=" + c.stateVersion, "state=" + c.state);

    console.log("\n=== Latest config per connection (active agentExecution) ===");
    const snapshots = await prisma.agentRuntimeSnapshot.findMany({ where: { workspaceId: ws.id }, select: { id: true, agentId: true } });
    const snapshotToAgent = new Map(snapshots.map((s) => [s.id, s.agentId]));
    for (const c of conns) {
      const latest = await prisma.channelConfiguration.findFirst({ where: { connectionId: c.id }, orderBy: { revision: "desc" }, select: { revision: true, configuration: true, hash: true, checksum: true } });
      if (!latest) { console.log(`  conn ${c.id}: NO config`); continue; }
      const exec = latest.configuration && latest.configuration.agentExecution;
      const snapId = exec && exec.agentRuntimeSnapshotId;
      const agentId = snapId ? snapshotToAgent.get(snapId) : undefined;
      console.log(`  conn ${c.id}: revision=${latest.revision} activeSnapshot=${snapId} -> agent=${agentId} hash=${latest.hash}`);
      console.log(`     agentExecution keys:`, exec ? Object.keys(exec) : []);
    }

    console.log("\n=== Published agents with READY orchestration (potential Agent B) ===");
    for (const a of published) {
      const snap = await prisma.agentRuntimeSnapshot.findFirst({ where: { workspaceId: ws.id, agentId: a.id }, select: { id: true } });
      if (!snap) { console.log(`  ${a.name}: NO runtime snapshot`); continue; }
      const orch = await prisma.agentExecutionOrchestration.findFirst({ where: { workspaceId: ws.id, status: "READY", agentRuntimeSnapshotId: snap.id }, orderBy: { createdAt: "desc" }, select: { id: true, agentRuntimeSnapshotId: true, promptExecutionPayloadId: true, providerRuntimeSnapshotId: true, conversationRuntimeSnapshotId: true, executionPipelineSnapshotId: true } });
      console.log(`  ${a.name}: snapshot=${snap.id} readyOrch=${orch ? "YES id=" + orch.id : "NO"}`);
      if (orch) console.log(`     orch assets snapshot=${orch.agentRuntimeSnapshotId} prompt=${orch.promptExecutionPayloadId} provider=${orch.providerRuntimeSnapshotId} conv=${orch.conversationRuntimeSnapshotId} pipeline=${orch.executionPipelineSnapshotId}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error("PROBE_FAILED", e.message); process.exit(1); });
