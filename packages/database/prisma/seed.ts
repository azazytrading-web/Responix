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
  "provider.runtime.manage",
  "retrieval.runtime.read",
  "retrieval.runtime.create",
  "retrieval.runtime.update",
  "retrieval.runtime.publish",
  "retrieval.runtime.archive",
  "retrieval.runtime.restore",
  "retrieval.runtime.compare",
  "conversation.runtime.read",
  "conversation.runtime.create",
  "conversation.runtime.update",
  "conversation.runtime.publish",
  "conversation.runtime.rollback",
  "conversation.runtime.clone",
  "conversation.runtime.archive",
  "conversation.runtime.restore",
  "conversation.runtime.delete",
  "conversation.runtime.compare",
  "execution.pipeline.read",
  "execution.pipeline.create",
  "execution.pipeline.update",
  "execution.pipeline.publish",
  "execution.pipeline.rollback",
  "execution.pipeline.archive",
  "execution.pipeline.restore",
  "execution.pipeline.delete",
  "prompt.execution.render",
  "prompt.execution.validate",
  "prompt.execution.read",
  "agent.execution.create",
  "agent.execution.read",
  "agent.execution.manage",
  "agent.execution.cancel",
  "runtime.optimization.create",
  "runtime.optimization.read",
  "runtime.optimization.manage",
  "stream.runtime.read",
  "stream.runtime.create",
  "stream.runtime.cancel",
  "stream.runtime.compare",
  "stream.runtime.audit"
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
    where: { code: { in: permissions.filter((code) => code.startsWith("ai.") || code.startsWith("platform.") || code.startsWith("studio.") || code.startsWith("prompt.") || code.startsWith("agent.") || code.startsWith("knowledge.") || code.startsWith("tool.") || code.startsWith("workflow.") || code.startsWith("runtime.orchestration.") || code.startsWith("execution.kernel.") || code.startsWith("provider.") || code.startsWith("retrieval.") || code.startsWith("conversation.")) } }
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

  const providers = [
    {
      providerName: "OpenAI", apiBaseUrl: "https://api.openai.com/v1",
      modelName: "gpt-4.1-mini", displayName: "GPT-4.1 mini", contextWindow: 1_000_000
    },
    {
      providerName: "Claude", apiBaseUrl: "https://api.anthropic.com/v1",
      modelName: "claude-3-5-sonnet-latest", displayName: "Claude 3.5 Sonnet",
      contextWindow: 200_000
    },
    {
      providerName: "Gemini", apiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
      modelName: "gemini-2.0-flash", displayName: "Gemini 2.0 Flash", contextWindow: 1_000_000
    },
    {
      providerName: "Azure OpenAI", apiBaseUrl: null,
      modelName: "gpt-4.1-mini", displayName: "Azure GPT-4.1 mini", contextWindow: 1_000_000
    },
    {
      providerName: "OpenRouter", apiBaseUrl: "https://openrouter.ai/api/v1",
      modelName: "openai/gpt-4.1-mini", displayName: "OpenRouter GPT-4.1 mini",
      contextWindow: 1_000_000
    },
    {
      providerName: "DeepSeek", apiBaseUrl: "https://api.deepseek.com",
      modelName: "deepseek-chat", displayName: "DeepSeek Chat",
      contextWindow: 65_536
    }
  ];
  for (const definition of providers) {
    const provider = await prisma.aiProvider.upsert({
      where: { providerName: definition.providerName },
      update: {},
      create: {
        providerName: definition.providerName,
        apiBaseUrl: definition.apiBaseUrl,
        authenticationType: "api_key"
      }
    });
    await prisma.aiModel.upsert({
      where: {
        providerId_modelName: {
          providerId: provider.id, modelName: definition.modelName
        }
      },
      update: {},
      create: {
        providerId: provider.id, modelName: definition.modelName,
        displayName: definition.displayName, contextWindow: definition.contextWindow
      }
    });
  }
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
