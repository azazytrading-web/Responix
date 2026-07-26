import { WorkspaceController } from "./workspace.controller";

const forbiddenFields = [
  "passwordHash",
  "refreshTokenHash",
  "resetPasswordToken",
  "verificationToken",
  "verificationCode",
  "mfaSecret",
  "backupCodes",
  "deletedAt",
  "deletedBy",
  "securityVersion"
] as const;

const poison = Object.fromEntries(forbiddenFields.map((field) => [field, `forbidden-${field}`]));
const now = new Date("2026-01-01T00:00:00.000Z");

const user = {
  id: "user-id",
  workspaceId: "workspace-id",
  firstName: "Safe",
  lastName: "User",
  fullName: "Safe User",
  email: "safe@example.com",
  phone: null,
  avatar: null,
  roleId: "role-id",
  departmentId: null,
  status: "ACTIVE",
  language: "en",
  timezone: "UTC",
  lastLoginAt: null,
  emailVerified: true,
  mfaEnabled: false,
  createdAt: now,
  updatedAt: now,
  ...poison
};

const role = {
  id: "role-id",
  workspaceId: "workspace-id",
  name: "Agent",
  description: null,
  priority: 10,
  systemRole: true,
  createdAt: now,
  updatedAt: now,
  ...poison
};

const membership = {
  id: "membership-id",
  workspaceId: "workspace-id",
  userId: "user-id",
  roleId: "role-id",
  status: "ACTIVE",
  invitedAt: now,
  acceptedAt: now,
  suspendedAt: null,
  removedAt: null,
  createdAt: now,
  updatedAt: now,
  user,
  role,
  ...poison
};

const workspace = {
  id: "workspace-id",
  name: "Workspace",
  slug: "workspace",
  companyName: null,
  ownerId: "user-id",
  status: "ACTIVE",
  language: "en",
  timezone: "UTC",
  currency: "USD",
  createdAt: now,
  updatedAt: now,
  ...poison
};

function expectNoForbiddenFields(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(expectNoForbiddenFields);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    expect(forbiddenFields).not.toContain(key);
    expectNoForbiddenFields(nested);
  }
}

describe("WorkspaceController serialization fortress", () => {
  const service = {
    create: jest.fn().mockResolvedValue({
      workspace,
      membership,
      subscription: {
        id: "subscription-id",
        workspaceId: "workspace-id",
        planId: "plan-id",
        status: "TRIAL",
        ...poison
      }
    }),
    workspace: jest.fn().mockResolvedValue(workspace),
    update: jest.fn().mockResolvedValue(workspace),
    suspendWorkspace: jest.fn().mockResolvedValue(workspace),
    archiveWorkspace: jest.fn().mockResolvedValue(workspace),
    restoreWorkspace: jest.fn().mockResolvedValue(workspace),
    softDeleteWorkspace: jest.fn().mockResolvedValue(workspace),
    members: jest.fn().mockResolvedValue({
      data: [membership],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
    }),
    invite: jest.fn().mockResolvedValue({
      membership,
      invitationToken: "public-invitation-token",
      expiresAt: now,
      ...poison
    }),
    acceptInvitation: jest.fn().mockResolvedValue(membership),
    rejectInvitation: jest.fn().mockResolvedValue(membership),
    revokeInvitation: jest.fn().mockResolvedValue(membership),
    removeMember: jest.fn().mockResolvedValue(membership),
    suspendMember: jest.fn().mockResolvedValue(membership),
    restoreMember: jest.fn().mockResolvedValue(membership),
    updateMemberRole: jest.fn().mockResolvedValue(membership)
  };
  const controller = new WorkspaceController(service as never);
  const currentWorkspace = { id: "workspace-id" };
  const currentUser = { id: "user-id" };
  const params = { membershipId: "membership-id" };

  const endpoints: Array<[string, () => Promise<unknown>]> = [
    ["create workspace", () => controller.create(currentUser, { name: "Workspace", slug: "workspace" })],
    ["get workspace", () => controller.get(currentWorkspace, currentUser)],
    ["update workspace", () => controller.update(currentWorkspace, currentUser, { name: "Updated" })],
    ["suspend workspace", () => controller.suspend(currentWorkspace, currentUser)],
    ["archive workspace", () => controller.archive(currentWorkspace, currentUser)],
    ["restore workspace", () => controller.restore(currentWorkspace, currentUser)],
    ["delete workspace", () => controller.softDelete(currentWorkspace, currentUser)],
    ["list members", () => controller.members(currentWorkspace, currentUser, { page: 1, limit: 25 })],
    [
      "invite member",
      () =>
        controller.invite(currentWorkspace, currentUser, {
          userId: "target-user-id",
          roleId: "role-id"
        })
    ],
    [
      "accept invitation",
      () =>
        controller.accept(
          {
            user: {
              sub: "user-id",
              workspaceId: "workspace-id",
              membershipId: "membership-id",
              sessionId: "session-id"
            }
          },
          { token: "invitation-token-value-that-is-long-enough" }
        )
    ],
    [
      "reject invitation",
      () =>
        controller.reject(
          {
            user: {
              sub: "user-id",
              workspaceId: "workspace-id",
              membershipId: "membership-id",
              sessionId: "session-id"
            }
          },
          { token: "invitation-token-value-that-is-long-enough" }
        )
    ],
    ["revoke invitation", () => controller.revokeInvitation(currentWorkspace, currentUser, params)],
    ["remove member", () => controller.remove(currentWorkspace, currentUser, params)],
    ["suspend member", () => controller.suspendMember(currentWorkspace, currentUser, params)],
    ["restore member", () => controller.restoreMember(currentWorkspace, currentUser, params)],
    [
      "update member role",
      () => controller.updateMemberRole(currentWorkspace, currentUser, params, { roleId: "role-id" })
    ]
  ];

  it.each(endpoints)("excludes forbidden fields from %s", async (_name, invoke) => {
    expectNoForbiddenFields(await invoke());
  });
});
