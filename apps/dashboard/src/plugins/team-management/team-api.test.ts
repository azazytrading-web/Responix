import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  inviteTeamMember,
  listTeamMembers,
  removeTeamMember,
  restoreTeamMember,
  revokeTeamInvitation,
  suspendTeamMember,
  updateTeamMemberRole
} from "./team-api";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock("@responix/api-client", () => ({ apiClient: mocks }));

describe("team management API", () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

  it("lists workspace-scoped members with backend pagination", async () => {
    mocks.get.mockResolvedValue({ data: [], pagination: { page: 2 } });
    await listTeamMembers(2);
    expect(mocks.get).toHaveBeenCalledWith("/api/v1/workspaces/current/members", {
      credentials: "include",
      query: { page: 2, limit: 25 }
    });
  });

  it("uses only existing member lifecycle routes", async () => {
    mocks.post.mockResolvedValue({});
    mocks.patch.mockResolvedValue({});
    mocks.delete.mockResolvedValue({});

    await inviteTeamMember("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002");
    await updateTeamMemberRole("member-1", "role-2");
    await suspendTeamMember("member-1");
    await restoreTeamMember("member-1");
    await revokeTeamInvitation("member-1");
    await removeTeamMember("member-1");

    expect(mocks.post).toHaveBeenCalledWith("/api/v1/workspaces/current/members", expect.any(Object), { credentials: "include" });
    expect(mocks.patch).toHaveBeenCalledWith("/api/v1/workspaces/current/members/member-1/role", { roleId: "role-2" }, { credentials: "include" });
    expect(mocks.post).toHaveBeenCalledWith("/api/v1/workspaces/current/members/member-1/suspend", undefined, { credentials: "include" });
    expect(mocks.post).toHaveBeenCalledWith("/api/v1/workspaces/current/members/member-1/restore", undefined, { credentials: "include" });
    expect(mocks.delete).toHaveBeenCalledWith("/api/v1/workspaces/current/members/member-1/invitation", { credentials: "include" });
    expect(mocks.delete).toHaveBeenCalledWith("/api/v1/workspaces/current/members/member-1", { credentials: "include" });
  });
});
