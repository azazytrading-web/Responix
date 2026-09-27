// One-off migration drift check (no env auto-load; pass DATABASE_URL explicitly).
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  try {
    const tables = await p.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND lower(table_name) LIKE '%retrieval%' ORDER BY table_name"
    );
    console.log("retrieval* tables:", tables.map((r) => r.table_name).join(", "));
    for (const t of tables) {
      const cols = await p.$queryRawUnsafe(
        "SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position",
        t.table_name
      );
      console.log("  " + t.table_name + ": " + cols.map((r) => r.column_name).join(", "));
    }
  } catch (e) {
    console.log("ERR", e.message);
  } finally {
    await p.$disconnect();
  }
})();
