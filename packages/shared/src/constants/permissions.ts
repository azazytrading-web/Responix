export const PERMISSIONS = {
  PLATFORM_READ: "platform.read",
  PLATFORM_CONFIGURE: "platform.configure",
  AI_CONFIGURE: "ai.configure",
  AI_MODELS_WRITE: "ai.models.write",
  WORKFLOW_CONFIGURE: "workflow.configure",
  TOOL_CONFIGURE: "tool.configure",
  KNOWLEDGE_CONFIGURE: "knowledge.configure",
  CHANNEL_RUNTIME_READ: "channel.runtime.read",
  CONVERSATION_READ: "conversation.read",
  EXECUTION_READ: "execution.read",
  MEMORY_READ: "memory.read",
  RETRIEVAL_READ: "retrieval.read",
  OPTIMIZATION_READ: "optimization.read",
  ANALYTICS_READ: "analytics.read",
  BILLING_READ: "billing.read",
  WORKSPACE_MEMBERS_MANAGE: "workspace.members.manage",
  WORKSPACE_READ: "workspace.read",
  AUDIT_READ: "audit.read",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
