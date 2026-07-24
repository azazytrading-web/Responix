import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  "users.create",
  "users.update",
  "crm.view",
  "billing.update",
  "ai.configure",
  "knowledge.upload",
  "reports.export"
];

const roles = [
  { name: "Administrator", description: "System administrator", priority: 100 },
  { name: "Manager", description: "Workspace manager", priority: 50 },
  { name: "Agent", description: "Customer engagement agent", priority: 10 }
];

async function seed(): Promise<void> {
  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code }
    });
  }

  for (const role of roles) {
    const existing = await prisma.role.findFirst({
      where: { workspaceId: null, name: role.name }
    });

    if (!existing) {
      await prisma.role.create({
        data: { ...role, systemRole: true }
      });
    }
  }

  await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      monthlyPrice: 0,
      yearlyPrice: 0,
      featuresJson: []
    }
  });

  for (const featureName of ["ai", "knowledge", "workflows"]) {
    await prisma.featureFlag.upsert({
      where: { featureName },
      update: {},
      create: { featureName, enabled: false }
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "database.retention" },
    update: {},
    create: {
      key: "database.retention",
      value: { archiveAfterDays: 365 }
    }
  });

  for (const channel of [
    { name: "web", displayName: "Web" },
    { name: "whatsapp", displayName: "WhatsApp" },
    { name: "email", displayName: "Email" }
  ]) {
    await prisma.channel.upsert({
      where: { name: channel.name },
      update: {},
      create: channel
    });
  }

  const provider = await prisma.aiProvider.upsert({
    where: { providerName: "OpenAI" },
    update: {},
    create: {
      providerName: "OpenAI",
      authenticationType: "api_key"
    }
  });

  await prisma.aiModel.upsert({
    where: {
      providerId_modelName: {
        providerId: provider.id,
        modelName: "gpt-4.1-mini"
      }
    },
    update: {},
    create: {
      providerId: provider.id,
      modelName: "gpt-4.1-mini",
      displayName: "GPT-4.1 mini",
      contextWindow: 1_000_000
    }
  });
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
