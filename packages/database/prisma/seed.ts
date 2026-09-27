import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

const developmentAdministrator = {
  email: "admin@responix.local",
  password: process.env.RESPONIX_DEV_ADMIN_PASSWORD ?? "ResponixDev2026!",
  fullName: "Responix Administrator",
  workspaceName: "Responix Development",
  workspaceSlug: "responix-development",
  roleName: "Administrator"
} as const;

const developmentPlatformManifest = {
  schemaVersion: "1.0",
  id: "responix-development-dashboard",
  navigation: {
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        route: "/",
        icon: { name: "LayoutDashboard" },
        order: 1,
        placement: "sidebar"
      },
      {
        id: "company",
        label: "Company",
        route: "/company",
        icon: { name: "Building2" },
        order: 2,
        placement: "sidebar",
        visibility: { permissions: ["workspace.read"] }
      },
      {
        id: "platform",
        label: "Platform Control",
        route: "/platform",
        icon: { name: "Settings" },
        order: 3,
        placement: "sidebar",
        visibility: { permissions: ["platform.configure"] }
      },
      {
        id: "team",
        label: "Team",
        route: "/company/members",
        icon: { name: "Users" },
        order: 4,
        placement: "sidebar",
        visibility: { permissions: ["workspace.members.read"] }
      },
      {
        id: "agents",
        label: "Agents",
        route: "/ai/agents",
        icon: { name: "Bot" },
        order: 5,
        placement: "sidebar",
        visibility: { permissions: ["agent.studio.read"] }
      },
      {
        id: "providers",
        label: "Providers",
        route: "/ai/providers",
        icon: { name: "Plug" },
        order: 6,
        placement: "sidebar",
        visibility: { permissions: ["ai.configure"] }
      },
      {
        id: "prompts",
        label: "Prompt Library",
        route: "/ai/prompts",
        icon: { name: "BookOpen" },
        order: 7,
        placement: "sidebar",
        visibility: { permissions: ["prompt.library.read"] }
      },
      {
        id: "whatsapp",
        label: "WhatsApp Business",
        route: "/channels/whatsapp",
        icon: { name: "MessageCircle" },
        order: 8,
        placement: "sidebar",
        visibility: { permissions: ["channel.runtime.read", "whatsapp.connection.read"] }
      },
      {
        id: "inbox",
        label: "Inbox",
        route: "/inbox",
        icon: { name: "MessageSquare" },
        order: 9,
        placement: "sidebar",
        visibility: { permissions: ["channel.runtime.read"] }
      },
      {
        id: "knowledge",
        label: "Knowledge Base",
        route: "/knowledge",
        icon: { name: "Database" },
        order: 10,
        placement: "sidebar",
        visibility: { permissions: ["knowledge.base.read"] }
      }
    ]
  },
  dashboard: {
    pages: [
      {
        id: "home",
        title: "Dashboard",
        route: "/",
        layout: "grid",
        order: 1,
        sections: []
      },
      {
        id: "company",
        title: "Company",
        route: "/company",
        layout: "grid",
        order: 2,
        sections: [],
        visibility: { permissions: ["workspace.read"] }
      },
      {
        id: "platform",
        title: "Platform Control",
        route: "/platform",
        layout: "grid",
        order: 3,
        sections: [],
        visibility: { permissions: ["platform.configure"] }
      },
      {
        id: "team",
        title: "Team",
        route: "/company/members",
        layout: "grid",
        order: 4,
        sections: [],
        visibility: { permissions: ["workspace.members.read"] }
      },
      {
        id: "agents",
        title: "Agents",
        route: "/ai/agents",
        layout: "grid",
        order: 5,
        sections: [],
        visibility: { permissions: ["agent.studio.read"] }
      },
      {
        id: "providers",
        title: "Providers",
        route: "/ai/providers",
        layout: "grid",
        order: 6,
        sections: [],
        visibility: { permissions: ["ai.configure"] }
      },
      {
        id: "prompts",
        title: "Prompt Library",
        route: "/ai/prompts",
        layout: "grid",
        order: 7,
        sections: [],
        visibility: { permissions: ["prompt.library.read"] }
      },
      {
        id: "whatsapp",
        title: "WhatsApp Business",
        route: "/channels/whatsapp",
        layout: "grid",
        order: 8,
        sections: [],
        visibility: { permissions: ["channel.runtime.read", "whatsapp.connection.read"] }
      },
      {
        id: "inbox",
        title: "Inbox",
        route: "/inbox",
        layout: "grid",
        order: 9,
        sections: [],
        visibility: { permissions: ["channel.runtime.read"] }
      },
      {
        id: "knowledge",
        title: "Knowledge Base",
        route: "/knowledge",
        layout: "grid",
        order: 10,
        sections: [],
        visibility: { permissions: ["knowledge.base.read"] }
      }
    ]
  },
  themes: [
    {
      id: "default",
      brand: { name: "Responix", shortName: "R" },
      colors: {
        primary: "hsl(221.2 83.2% 53.3%)",
        secondary: "hsl(210 40% 96.1%)"
      }
    }
  ],
  features: [],
  plugins: [],
  openApi: {}
} as const;

async function seedDevelopmentWorkspaceManifestOnly(): Promise<void> {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: developmentAdministrator.workspaceSlug },
    select: { id: true }
  });
  if (!workspace) {
    throw new Error("The existing development workspace was not found");
  }
  await prisma.workspacePlatformManifest.upsert({
    where: { workspaceId: workspace.id },
    update: {
      schemaVersion: developmentPlatformManifest.schemaVersion,
      compatibilityVersion: "1.0",
      revision: { increment: 1 },
      manifest: developmentPlatformManifest
    },
    create: {
      workspaceId: workspace.id,
      schemaVersion: developmentPlatformManifest.schemaVersion,
      compatibilityVersion: "1.0",
      manifest: developmentPlatformManifest
    }
  });
}

async function seedDevelopmentWorkspaceUpdatePermissionOnly(): Promise<void> {
  const permissionCodes = [
    "workspace.update", "workspace.members.read", "workspace.members.manage",
    "ai.providers.read", "ai.providers.write", "ai.providers.validate",
    "channel.runtime.read", "channel.runtime.write", "channel.runtime.admin",
    "whatsapp.connection.read", "whatsapp.connection.write", "whatsapp.connection.admin"
  ];
  const permissionRecords = await Promise.all(permissionCodes.map((code) =>
    prisma.permission.upsert({ where: { code }, update: {}, create: { code }, select: { id: true, code: true } })
  ));
  const [role, workspace] = await Promise.all([
    prisma.role.findFirst({
      where: { workspaceId: null, name: developmentAdministrator.roleName, deletedAt: null },
      select: { id: true }
    }),
    prisma.workspace.findUnique({
      where: { slug: developmentAdministrator.workspaceSlug },
      select: { id: true }
    })
  ]);
  if (!role || !workspace) {
    throw new Error("The existing workspace, permissions, and Administrator role are required");
  }
  for (const permission of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id }
    });
  }
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { permissionRevision: { increment: 1 } }
  });
}

const permissions = [
  "users.create",
  "users.update",
  "crm.view",
  "billing.update",
  "ai.configure",
  "ai.providers.read",
  "ai.providers.write",
  "ai.providers.validate",
  "ai.invoke",
  "ai.logs.read",
  "knowledge.upload",
  "reports.export",
  "platform.read",
  "platform.configure",
  "workspace.read",
  "workspace.update",
  "workspace.members.read",
  "workspace.members.manage",
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
  "prompt.library.delete",
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
  "tool.runtime.read",
  "tool.runtime.stream",
  "tool.execution.execute",
  "tool.execution.cancel",
  "tool.history.read",
  "tool.admin.manage",
  "workflow.engine.read",
  "workflow.engine.write",
  "workflow.engine.publish",
  "workflow.engine.rollback",
  "workflow.engine.archive",
  "workflow.engine.delete",
  "workflow.engine.manage",
  "workflow.execution.execute",
  "workflow.execution.cancel",
  "workflow.runtime.read",
  "workflow.runtime.approve",
  "workflow.history.read",
  "workflow.admin.manage",
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
  "retrieval.execution.execute",
  "retrieval.execution.read",
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
  "runtime.optimization.invalidate",
  "runtime.optimization.manage",
  "stream.runtime.read",
  "stream.runtime.create",
  "stream.runtime.cancel",
  "stream.runtime.compare",
  "stream.runtime.audit",
  "memory.runtime.read",
  "memory.runtime.write",
  "memory.runtime.publish",
  "memory.runtime.archive",
  "memory.runtime.compare",
  "channel.runtime.read",
  "channel.runtime.write",
  "channel.runtime.admin",
  "whatsapp.connection.read",
  "whatsapp.connection.write",
  "whatsapp.connection.admin"
];

const roles = [
  { name: "Administrator", description: "System administrator", priority: 100 },
  { name: "Manager", description: "Workspace manager", priority: 50 },
  { name: "Agent", description: "Customer engagement agent", priority: 10 }
];

async function seed(): Promise<void> {
  if (process.env.RESPONIX_SEED_MANIFEST_ONLY === "true") {
    await seedDevelopmentWorkspaceManifestOnly();
    return;
  }
  if (process.env.RESPONIX_SEED_WORKSPACE_UPDATE_ONLY === "true") {
    await seedDevelopmentWorkspaceUpdatePermissionOnly();
    return;
  }
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

  const seededPermissions = await prisma.permission.findMany({
    where: { code: { in: permissions } }
  });
  const administratorRoles = await prisma.role.findMany({
    where: { workspaceId: null, name: { in: ["Owner", "Administrator"] } }
  });
  for (const role of administratorRoles) {
    for (const permission of seededPermissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id }
      });
    }
  }

  const starterPlan = await prisma.plan.upsert({
    where: { name: "Starter" },
    update: {},
    create: {
      name: "Starter",
      monthlyPrice: 0,
      yearlyPrice: 0,
      featuresJson: []
    }
  });

  const administratorRole = administratorRoles.find(
    (role) => role.name === developmentAdministrator.roleName
  );
  if (!administratorRole) {
    throw new Error("The canonical Administrator role was not seeded");
  }

  const passwordHash = await hash(developmentAdministrator.password);
  const workspace = await prisma.workspace.upsert({
    where: { slug: developmentAdministrator.workspaceSlug },
    update: {
      name: developmentAdministrator.workspaceName,
      planId: starterPlan.id,
      status: "ACTIVE",
      deletedAt: null
    },
    create: {
      name: developmentAdministrator.workspaceName,
      slug: developmentAdministrator.workspaceSlug,
      companyName: developmentAdministrator.workspaceName,
      planId: starterPlan.id,
      status: "ACTIVE"
    }
  });
  const existingSubscription = await prisma.subscription.findFirst({
    where: {
      workspaceId: workspace.id,
      deletedAt: null,
      status: { in: ["ACTIVE", "TRIAL"] }
    },
    orderBy: { createdAt: "desc" }
  });
  const subscription = existingSubscription ?? await prisma.subscription.create({
    data: {
      workspaceId: workspace.id,
      planId: starterPlan.id,
      billingCycle: "MONTHLY",
      status: "TRIAL",
      startedAt: new Date(),
      autoRenew: false
    }
  });
  const administrator = await prisma.user.upsert({
    where: {
      workspaceId_email: {
        workspaceId: workspace.id,
        email: developmentAdministrator.email
      }
    },
    update: {
      fullName: developmentAdministrator.fullName,
      firstName: "Responix",
      lastName: "Administrator",
      passwordHash,
      roleId: administratorRole.id,
      status: "ACTIVE",
      emailVerified: true,
      deletedAt: null
    },
    create: {
      workspaceId: workspace.id,
      email: developmentAdministrator.email,
      fullName: developmentAdministrator.fullName,
      firstName: "Responix",
      lastName: "Administrator",
      passwordHash,
      roleId: administratorRole.id,
      status: "ACTIVE",
      emailVerified: true
    }
  });
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { ownerId: administrator.id, subscriptionId: subscription.id }
  });
  await prisma.workspaceMembership.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: administrator.id
      }
    },
    update: {
      roleId: administratorRole.id,
      status: "ACTIVE",
      acceptedAt: new Date(),
      suspendedAt: null,
      removedAt: null
    },
    create: {
      workspaceId: workspace.id,
      userId: administrator.id,
      roleId: administratorRole.id,
      status: "ACTIVE",
      acceptedAt: new Date()
    }
  });
  await prisma.workspacePlatformManifest.upsert({
    where: { workspaceId: workspace.id },
    update: {
      schemaVersion: developmentPlatformManifest.schemaVersion,
      compatibilityVersion: "1.0",
      revision: { increment: 1 },
      manifest: developmentPlatformManifest
    },
    create: {
      workspaceId: workspace.id,
      schemaVersion: developmentPlatformManifest.schemaVersion,
      compatibilityVersion: "1.0",
      manifest: developmentPlatformManifest
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
    { name: "baileys", displayName: "Baileys" },
    { name: "email", displayName: "Email" }
  ]) {
    await prisma.channelProvider.upsert({
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

  console.log(`Email: ${developmentAdministrator.email}`);
  console.log(`Password: ${developmentAdministrator.password}`);
  console.log(`Workspace: ${developmentAdministrator.workspaceName}`);
  console.log(`Role: ${developmentAdministrator.roleName}`);
}

seed()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
