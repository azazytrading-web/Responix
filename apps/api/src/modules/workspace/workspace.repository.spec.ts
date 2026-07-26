import { WorkspaceRepository } from "./workspace.repository";

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
];

function expectSafeUserSelect(select: Record<string, unknown>): void {
  for (const field of forbiddenFields) {
    expect(select).not.toHaveProperty(field);
  }
  expect(select).toMatchObject({
    id: true,
    workspaceId: true,
    fullName: true,
    email: true
  });
}

describe("WorkspaceRepository safe user boundaries", () => {
  const membershipRecord = {
    id: "membership-id",
    workspaceId: "workspace-id",
    userId: "user-id",
    roleId: "role-id",
    status: "ACTIVE",
    invitedAt: new Date(),
    acceptedAt: null,
    suspendedAt: null,
    removedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {},
    role: {}
  };
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: "user-id" }) },
    workspaceMembership: {
      findMany: jest.fn().mockResolvedValue([membershipRecord]),
      count: jest.fn().mockResolvedValue(1),
      findFirst: jest.fn().mockResolvedValue(membershipRecord),
      create: jest.fn().mockResolvedValue(membershipRecord),
      update: jest.fn().mockResolvedValue(membershipRecord)
    },
    workspaceInvitation: {
      create: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ id: "invitation-id" })
    },
    auditLog: { create: jest.fn() },
    session: { updateMany: jest.fn() },
    $transaction: jest.fn()
  };
  prisma.$transaction.mockImplementation(async (input: unknown) => {
    if (Array.isArray(input)) return Promise.all(input);
    return (input as (transaction: typeof prisma) => unknown)(prisma);
  });
  const repository = new WorkspaceRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("selects only allowlisted user fields when finding a user", async () => {
    await repository.findUser("user-id");
    const calls = prisma.user.findFirst.mock.calls as unknown[][];
    const query = calls[0]?.[0] as {
      select: Record<string, unknown>;
    };
    expectSafeUserSelect(query.select);
  });

  it("selects only allowlisted nested users when listing members", async () => {
    await repository.members("workspace-id", 1, 25);
    const calls = prisma.workspaceMembership.findMany.mock.calls as unknown[][];
    const query = calls[0]?.[0] as {
      select: { user: { select: Record<string, unknown> } };
    };
    expectSafeUserSelect(query.select.user.select);
  });

  it("does not return invitation token hashes from repository lookups", async () => {
    await repository.findPendingInvitation("membership-id");
    const calls = prisma.workspaceInvitation.findFirst.mock.calls as unknown[][];
    const query = calls[0]?.[0] as { select: Record<string, unknown> };
    expect(query.select).not.toHaveProperty("tokenHash");
    expect(query.select).toMatchObject({
      id: true,
      workspaceId: true,
      membershipId: true,
      targetUserId: true
    });
  });

  it.each([
    ["member lookup", () => repository.memberById("workspace-id", "membership-id")],
    [
      "membership invitation",
      () =>
        repository.createMembershipWithInvitation({
          workspaceId: "workspace-id",
          userId: "user-id",
          roleId: "role-id",
          invitedByUserId: "actor-id",
          tokenHash: "token-hash",
          expiresAt: new Date(),
          audit: {
            workspaceId: "workspace-id",
            userId: "actor-id",
            action: "member.invited",
            entityType: "membership",
            entityId: "pending"
          }
        })
    ],
    [
      "membership update",
      () =>
        repository.updateMembership(
          "workspace-id",
          "membership-id",
          { status: "SUSPENDED" },
          {
            audit: {
              workspaceId: "workspace-id",
              userId: "actor-id",
              action: "member.suspended",
              entityType: "membership",
              entityId: "membership-id"
            }
          }
        )
    ]
  ])("uses a safe nested user selection for %s", async (_name, invoke) => {
    await invoke();
    const calls: unknown[][] = [
      ...(prisma.workspaceMembership.findFirst.mock.calls as unknown[][]),
      ...(prisma.workspaceMembership.create.mock.calls as unknown[][]),
      ...(prisma.workspaceMembership.update.mock.calls as unknown[][])
    ];
    const query = calls.at(-1)?.[0] as {
      select: { user: { select: Record<string, unknown> } };
    };
    expectSafeUserSelect(query.select.user.select);
  });
});
