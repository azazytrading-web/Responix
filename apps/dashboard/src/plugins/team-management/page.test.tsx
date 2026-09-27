import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeamManagementPage } from "./page";

const member = {
  id: "membership-1",
  userId: "user-1",
  roleId: "role-1",
  status: "ACTIVE",
  invitedAt: "2026-08-01T00:00:00.000Z",
  acceptedAt: "2026-08-01T00:00:00.000Z",
  user: { id: "user-1", fullName: "Amina Hassan", email: "amina@example.com", status: "ACTIVE" },
  role: { id: "role-1", name: "Administrator" }
};

const mocks = vi.hoisted(() => ({
  platform: {
    state: "READY",
    snapshot: { workspace: { id: "workspace-1" } },
    retry: vi.fn(),
    hasPermission: vi.fn((permission: string) => {
      void permission;
      return true;
    })
  },
  members: { data: { data: [] as typeof member[], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }, isPending: false, isError: false, refetch: vi.fn() },
  roles: { data: [{ id: "role-1", name: "Administrator" }], isPending: false, isError: false },
  invite: { isPending: false, mutateAsync: vi.fn() },
  action: { isPending: false, mutateAsync: vi.fn() },
  invalidateQueries: vi.fn()
}));

vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[] }) => options.queryKey.includes("roles") ? mocks.roles : mocks.members,
  useMutation: (options: { mutationFn: unknown }) => String(options.mutationFn).includes("inviteTeamMember") ? mocks.invite : mocks.action,
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries })
}));

describe("TeamManagementPage", () => {
  beforeEach(() => {
    mocks.platform.state = "READY";
    mocks.platform.snapshot = { workspace: { id: "workspace-1" } };
    mocks.platform.hasPermission.mockReturnValue(true);
    mocks.platform.retry.mockReset();
    mocks.members.data = { data: [member], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    mocks.members.isPending = false;
    mocks.members.isError = false;
    mocks.members.refetch.mockReset();
    mocks.roles.isPending = false;
    mocks.roles.isError = false;
    mocks.invite.isPending = false;
    mocks.invite.mutateAsync.mockReset().mockResolvedValue({ invitationToken: "invite-token" });
    mocks.action.isPending = false;
    mocks.action.mutateAsync.mockReset().mockResolvedValue(member);
    mocks.invalidateQueries.mockReset().mockResolvedValue(undefined);
  });

  it("renders real member data and permission-gated management actions", () => {
    render(<TeamManagementPage />);
    expect(screen.getByTestId("team-management")).toBeInTheDocument();
    expect(screen.getByText("Amina Hassan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite member" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
  });

  it("renders read-only and empty states without management permission", () => {
    mocks.platform.hasPermission.mockImplementation((permission: string) => permission === "workspace.members.read");
    mocks.members.data = { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } };
    render(<TeamManagementPage />);
    expect(screen.getByText("No workspace members")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite member" })).not.toBeInTheDocument();
  });

  it("blocks access without workspace.members.read", () => {
    mocks.platform.hasPermission.mockReturnValue(false);
    render(<TeamManagementPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("renders loading and retryable member errors", () => {
    mocks.members.isPending = true;
    const view = render(<TeamManagementPage />);
    expect(view.container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    mocks.members.isPending = false;
    mocks.members.isError = true;
    view.rerender(<TeamManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.members.refetch).toHaveBeenCalledTimes(1);
  });

  it("submits invitations through the existing workspace API", async () => {
    render(<TeamManagementPage />);
    fireEvent.change(screen.getByLabelText("User ID"), { target: { value: "00000000-0000-4000-8000-000000000001" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "role-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite member" }));
    await waitFor(() => expect(mocks.invite.mutateAsync).toHaveBeenCalled());
  });
});
