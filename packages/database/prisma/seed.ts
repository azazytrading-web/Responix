import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const permissions = [
  "users.create",
  "users.update",
  "crm.view",
  "billing.update",
  "ai.configure",
  "ai.invoke",
  "ai.logs.read",
  "knowledge.upload",
  "reports.export",
  "platform.read",
  "platform.configure",
  "studio.project.read",
  "studio.project.write",
  "studio.project.publish",
  "studio.project.rollback",
  "studio.project.archive",
  "prompt.library.read",
  "prompt.library.write",
  "prompt.library.publish",
  "prompt.library.rollback",
  "prompt.library.archive",
  "prompt.library.manage",
  "agent.studio.read",
  "agent.studio.write",
  "agent.studio.publish",
  "agent.studio.rollback",
  "agent.studio.archive",
  "agent.studio.delete",
  "knowledge.base.read",
  "knowledge.base.write",
  "knowledge.base.publish",
  "knowledge.base.rollback",
  "knowledge.base.archive",
  "knowledge.base.delete",
  "knowledge.base.manage",
  "tool.registry.read",
  "tool.registry.write",
  "tool.registry.publish",
  "tool.registry.rollback",
  "tool.registry.archive",
  "tool.registry.delete",
  "tool.registry.manage",
  "workflow.engine.read",
  "workflow.engine.write",
  "workflow.engine.publish",
  "workflow.engine.rollback",
  "workflow.engine.archive",
  "workflow.engine.delete",
  "workflow.engine.manage",
  "runtime.orchestration.read",
  "runtime.orchestration.write",
  "runtime.orchestration.publish",
  "runtime.orchestration.rollback",
  "runtime.orchestration.archive",
  "runtime.orchestration.delete",
  "runtime.orchestration.manage",
  "execution.kernel.create",
  "execution.kernel.read",
  "execution.kernel.update",
  "execution.kernel.manage",
  "execution.kernel.audit",
  "agent.runtime.prepare",
  "agent.runtime.read",
  "agent.runtime.validate",
  "agent.runtime.snapshot",
  "agent.runtime.manage",
  "prompt.compiler.compile",
  "prompt.compiler.preview",
  "prompt.compiler.validate",
  "prompt.compiler.read",
  "prompt.compiler.manage",
  "provider.runtime.prepare",
  "provider.runtime.validate",
  "provider.runtime.read",
  "provider.runtime.snapshot",
  "provider.runtime.manage"
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

  const aiPermissions = await prisma.permission.findMany({
    where: { code: { in: permissions.filter((code) => code.startsWith("ai.") || code.startsWith("platform.") || code.startsWith("studio.") || code.startsWith("prompt.") || code.startsWith("agent.") || code.startsWith("knowledge.") || code.startsWith("tool.") || code.startsWith("workflow.") || code.startsWith("runtime.orchestration.") || code.startsWith("execution.kernel.") || code.startsWith("provider.")) } }
  });
  const aiAdministrators = await prisma.role.findMany({
    where: { workspaceId: null, name: { in: ["Owner", "Administrator"] } }
  });
  for (const role of aiAdministrators) {
    for (const permission of aiPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
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
    const existingFeature = await prisma.featureFlag.findFirst({
      where: { workspaceId: null, featureName },
      select: { id: true }
    });
    if (!existingFeature) {
      await prisma.featureFlag.create({ data: { workspaceId: null, featureName, enabled: false } });
    }
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
