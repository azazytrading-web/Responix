const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const q = (sql) => p.$queryRawUnsafe(sql);
  try {
    console.log("FAILED_DOC_META:", JSON.stringify(await q("SELECT id, embedding_status_metadata, parser_metadata, metadata, file_metadata, mime_type, file_name, file_size::text, indexing_status, created_at FROM knowledge_documents WHERE status='FAILED' ORDER BY created_at DESC LIMIT 1")));
    console.log("AGENT_RUNTIME_TABLES:", JSON.stringify(await q("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%agent_runtime%' OR table_name LIKE '%agent%' ORDER BY 1")));
    console.log("EXEC_ORCH:", JSON.stringify(await q("SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%orchestration%' OR table_name LIKE '%execution_pipeline%' ORDER BY 1")));
    console.log("WORKSPACES:", JSON.stringify(await q("SELECT id, name FROM workspaces")));
    console.log("MEMBERSHIPS:", JSON.stringify(await q("SELECT u.email, m.workspace_id, m.role_id, r.name AS role FROM users u JOIN workspace_memberships m ON m.user_id = u.id LEFT JOIN roles r ON r.id = m.role_id LIMIT 5")));
  } catch (e) {
    console.log("ERR:", e.message.slice(0, 400));
  } finally {
    await p.$disconnect();
  }
})();



