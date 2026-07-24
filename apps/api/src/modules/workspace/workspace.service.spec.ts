import {
  DuplicateMembershipException,
  LastOwnerException,
  WorkspaceQuotaExceededException
} from "../../common/domain-errors";
import { WorkspaceService } from "./workspace.service";

const workspace = { id: "workspace", status: "ACTIVE", maxUsers: 1, deletedAt: null };
const actor = { id: "actor", userId: "actor", status: "ACTIVE", role: { name: "Owner" } };

describe("WorkspaceService", () => {
  const repository = {
    find: jest.fn(),
    membership: jest.fn(),
    findUser: jest.fn(),
    findRole: jest.fn(),
    membershipByUser: jest.fn(),
    countOccupiedMemberships: jest.fn(),
    createMembershipWithInvitation: jest.fn(),
    memberById: jest.fn(),
    countActiveOwners: jest.fn(),
    updateMembership: jest.fn(),
    findPendingInvitation: jest.fn(),
    revokeInvitation: jest.fn()
  };
  const service = new WorkspaceService(repository as never);

  beforeEach(() => {
    jest.resetAllMocks();
    repository.find.mockResolvedValue(workspace);
    repository.membership.mockResolvedValue(actor);
  });

  it("rejects duplicate membership invitations", async () => {
    repository.findUser.mockResolvedValue({ id: "target" });
    repository.findRole.mockResolvedValue({ id: "role", name: "Agent" });
    repository.membershipByUser.mockResolvedValue({ id: "existing" });

    await expect(service.invite("workspace", "actor", "target", "role")).rejects.toBeInstanceOf(
      DuplicateMembershipException
    );
  });

  it("enforces the workspace member quota", async () => {
    repository.findUser.mockResolvedValue({ id: "target" });
    repository.findRole.mockResolvedValue({ id: "role", name: "Agent" });
    repository.membershipByUser.mockResolvedValue(null);
    repository.countOccupiedMemberships.mockResolvedValue(1);

    await expect(service.invite("workspace", "actor", "target", "role")).rejects.toBeInstanceOf(
      WorkspaceQuotaExceededException
    );
  });

  it("prevents suspension of the last active owner", async () => {
    repository.memberById.mockResolvedValue({
      id: "member",
      userId: "target",
      status: "ACTIVE",
      role: { name: "Owner" }
    });
    repository.countActiveOwners.mockResolvedValue(1);

    await expect(service.suspendMember("workspace", "actor", "member")).rejects.toBeInstanceOf(
      LastOwnerException
    );
  });

  it("revokes sessions atomically when suspending a member", async () => {
    repository.memberById.mockResolvedValue({
      id: "member",
      userId: "target",
      status: "ACTIVE",
      role: { name: "Agent" }
    });
    repository.updateMembership.mockResolvedValue({ id: "member", status: "SUSPENDED" });

    await expect(service.suspendMember("workspace", "actor", "member")).resolves.toMatchObject({
      status: "SUSPENDED"
    });
    expect(repository.updateMembership).toHaveBeenCalledWith(
      "workspace",
      "member",
      expect.objectContaining({ status: "SUSPENDED" }),
      expect.objectContaining({ revokeSessions: true })
    );
  });
});
