import { defineConfig } from "prisma/config";
import { loadEnvFile } from "node:process";

loadEnvFile(new URL("../../.env", import.meta.url));

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
