import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError, PermissionDeniedError } from "@responix/api-client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceManagementPage } from "./page";

interface WorkspacePageMocks {
  platform: {
    state: string;
    snapshot: { workspace: { id: string } } | null;
    retry: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn>;
  };
  query: {
    data: unknown;
    isPending: boolean;
    isError: boolean;
    refetch: ReturnType<typeof vi.fn>;
  };
  mutation: {
    isPending: boolean;
    mutateAsync: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };
  queryClient: { setQueryData: ReturnType<typeof vi.fn> };
  restoreSession: ReturnType<typeof vi.fn>;
  invalidateBootstrap: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted((): WorkspacePageMocks => ({
  platform: {
    state: "READY",
    snapshot: { workspace: { id: "w1" } },
    retry: vi.fn(),
    hasPermission: vi.fn(() => true)
  },
  query: { data: undefined, isPending: false, isError: false, refetch: vi.fn() },
  mutation: { isPending: false, mutateAsync: vi.fn(), reset: vi.fn() },
  queryClient: { setQueryData: vi.fn() },
  restoreSession: vi.fn(),
  invalidateBootstrap: vi.fn()
}));

vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("@responix/auth", () => ({ useAuth: () => ({ restoreSession: mocks.restoreSession }) }));
vi.mock("@responix/state", () => ({
  platformBootstrapService: { invalidate: mocks.invalidateBootstrap }
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => mocks.query,
  useMutation: () => mocks.mutation,
  useQueryClient: () => mocks.queryClient
}));

const workspace = {
  id: "w1",
  name: "Responix Development",
  slug: "responix-development",
  companyName: "Responix",
  country: "",
  ownerId: "u1",
  language: "en",
  timezone: "Africa/Cairo",
  currency: "USD",
  status: "ACTIVE",
  maxUsers: 10,
  maxAgents: 10,
  maxMessages: 1000,
  maxStorage: 1000,
  maxTokens: 1000,
  currentStorageUsage: 0,
  currentTokenUsage: 0,
  aiEnabled: false,
  whatsappEnabled: false,
  emailEnabled: false,
  apiEnabled: false,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z"
};

describe("WorkspaceManagementPage", () => {
  beforeEach(() => {
    mocks.platform.state = "READY";
    mocks.platform.snapshot = { workspace: { id: "w1" } };
    mocks.platform.retry.mockReset();
    mocks.platform.hasPermission.mockReturnValue(true);
    mocks.query.data = workspace;
    mocks.query.isPending = false;
    mocks.query.isError = false;
    mocks.query.refetch.mockReset();
    mocks.mutation.isPending = false;
    mocks.mutation.mutateAsync.mockReset();
    mocks.mutation.reset.mockReset();
    mocks.queryClient.setQueryData.mockReset();
    mocks.restoreSession.mockReset();
    mocks.restoreSession.mockResolvedValue(undefined);
    mocks.invalidateBootstrap.mockReset();
  });

  it("renders authenticated workspace data and its empty integration state", () => {
    render(<WorkspaceManagementPage />);
    expect(screen.getByTestId("workspace-management")).toBeInTheDocument();
    expect(screen.getByText("Responix Development")).toBeInTheDocument();
    expect(screen.getByText("No workspace integrations enabled")).toBeInTheDocument();
  });

  it("renders loading and retryable request-error states", () => {
    mocks.query.isPending = true;
    const view = render(<WorkspaceManagementPage />);
    expect(view.container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    mocks.query.isPending = false;
    mocks.query.isError = true;
    mocks.query.data = undefined;
    view.rerender(<WorkspaceManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.query.refetch).toHaveBeenCalledTimes(1);
  });

  it("does not expose workspace data without workspace.read", () => {
    mocks.platform.hasPermission.mockImplementation((permission: string) => permission !== "workspace.read");
    render(<WorkspaceManagementPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-management")).not.toBeInTheDocument();
  });

  it("exposes editing only with workspace.update and restores values on cancel", () => {
    const view = render(<WorkspaceManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit workspace" }));
    const name = screen.getByLabelText<HTMLInputElement>("Workspace name");
    expect(name.value).toBe("Responix Development");
    fireEvent.change(name, { target: { value: "Unsaved name" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("heading", { name: "Edit workspace" })).not.toBeInTheDocument();
    expect(mocks.mutation.mutateAsync).not.toHaveBeenCalled();

    mocks.platform.hasPermission.mockImplementation((permission: string) => permission === "workspace.read");
    view.rerender(<WorkspaceManagementPage />);
    expect(screen.queryByRole("button", { name: "Edit workspace" })).not.toBeInTheDocument();
  });

  it("mirrors field limits and prevents empty or double submission", () => {
    const view = render(<WorkspaceManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Change at least one field");

    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "x".repeat(121) } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Workspace name must be 120 characters or fewer.")).toBeInTheDocument();
    expect(mocks.mutation.mutateAsync).not.toHaveBeenCalled();

    mocks.mutation.isPending = true;
    view.rerender(<WorkspaceManagementPage />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });

  it("patches changed fields, updates cache, and refreshes platform state", async () => {
    const updated = { ...workspace, country: "Egypt" };
    mocks.mutation.mutateAsync.mockResolvedValue(updated);
    render(<WorkspaceManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit workspace" }));
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "Egypt" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(mocks.mutation.mutateAsync).toHaveBeenCalledWith({ country: "Egypt" }));
    expect(mocks.queryClient.setQueryData).toHaveBeenCalledWith(
      ["workspace", "w1", "current"], updated
    );
    expect(mocks.invalidateBootstrap).toHaveBeenCalledWith("w1");
    expect(mocks.platform.retry).toHaveBeenCalledTimes(1);
    expect(mocks.restoreSession).not.toHaveBeenCalled();
  });

  it("restores authoritative session metadata after a workspace-name update", async () => {
    mocks.mutation.mutateAsync.mockResolvedValue({ ...workspace, name: "Updated workspace" });
    render(<WorkspaceManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit workspace" }));
    fireEvent.change(screen.getByLabelText("Workspace name"), { target: { value: "Updated workspace" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.restoreSession).toHaveBeenCalledTimes(1));
    expect(mocks.platform.retry).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new ApiError(400, "VALIDATION_ERROR", "Currency is invalid"), "Currency is invalid"],
    [new PermissionDeniedError("Workspace update is forbidden"), "Workspace update is forbidden"]
  ])("shows the real backend mutation error", async (error, message) => {
    mocks.mutation.mutateAsync.mockRejectedValue(error);
    render(<WorkspaceManagementPage />);
    fireEvent.click(screen.getByRole("button", { name: "Edit workspace" }));
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "EUR" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(mocks.queryClient.setQueryData).not.toHaveBeenCalled();
  });
});
