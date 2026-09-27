import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHomePage } from "./page";

const mocks = vi.hoisted(() => ({
  platform: {
    state: "READY",
    snapshot: null as null | {
      workspace: { id: string; name: string; slug: string; status: string };
      dashboard: { version: string; layouts: string[]; widgets: unknown[] };
      navigation: { items: Array<{ id: string }> };
    },
    permissions: ["platform.read"] as string[],
    features: [] as string[],
    retry: vi.fn(),
    hasPermission: vi.fn((permission: string) => permission === "platform.read")
  }
}));

vi.mock("../../platform", () => ({
  usePlatformBootstrap: () => mocks.platform
}));

describe("DashboardHomePage", () => {
  beforeEach(() => {
    mocks.platform.state = "READY";
    mocks.platform.snapshot = {
      workspace: { id: "w1", name: "Responix Development", slug: "responix-development", status: "ACTIVE" },
      dashboard: { version: "1.0", layouts: ["grid"], widgets: [{ kind: "card" }] },
      navigation: { items: [{ id: "dashboard" }] }
    };
    mocks.platform.permissions = ["platform.read", "workspace.read"];
    mocks.platform.features = [];
    mocks.platform.retry.mockReset();
    mocks.platform.hasPermission.mockImplementation((permission) => permission === "platform.read");
  });

  it("renders real workspace and bootstrap state", () => {
    render(<DashboardHomePage />);

    expect(screen.getByTestId("dashboard-home")).toBeInTheDocument();
    expect(screen.getByText("Responix Development")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("No optional features enabled")).toBeInTheDocument();
  });

  it("renders the loading and retryable error states", () => {
    mocks.platform.state = "LOADING";
    mocks.platform.snapshot = null;
    const view = render(<DashboardHomePage />);
    expect(view.container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    mocks.platform.state = "ERROR";
    view.rerender(<DashboardHomePage />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.platform.retry).toHaveBeenCalledTimes(1);
  });

  it("does not expose dashboard state without platform.read", () => {
    mocks.platform.hasPermission.mockReturnValue(false);
    render(<DashboardHomePage />);

    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-home")).not.toBeInTheDocument();
  });
});
