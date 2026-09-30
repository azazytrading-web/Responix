import { PrismaClient } from "@prisma/client";

export class OicDatabaseService extends PrismaClient {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  constructor() {
    const databaseUrl = process.env.OIC_DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("OIC_DATABASE_URL is required");
    }
    super({ datasources: { db: { url: databaseUrl } } });
  }
}