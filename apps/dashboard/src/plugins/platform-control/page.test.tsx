import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformControlPage } from "./page";

const mocks = vi.hoisted(() => ({
  platform: {
    state: "READY",
    snapshot: null as null | {
      platform: {
        permissions: string[];
        features: string[];
        license: Record<string, unknown>;
        branding: Record<string, unknown>;
        manifest: Record<string, unknown>;
      };
    },
    retry: vi.fn(),
    hasPermission: vi.fn((permission: string) => permission === "platform.configure")
  }
}));

vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));

describe("PlatformControlPage", () => {
  beforeEach(() => {
    mocks.platform.state = "READY";
    mocks.platform.snapshot = {
      platform: {
        permissions: ["platform.read", "platform.configure"],
        features: ["ai", "knowledge"],
        license: { status: "TRIAL", active: true },
        branding: { appName: "Responix", accentColor: "#2563eb", locale: "en", direction: "LTR" },
        manifest: { id: "responix-development-dashboard", schemaVersion: "1.0" }
      }
    };
    mocks.platform.retry.mockReset();
    mocks.platform.hasPermission.mockImplementation((permission) => permission === "platform.configure");
  });

  it("renders the canonical platform snapshot", () => {
    render(<PlatformControlPage />);

    expect(screen.getByTestId("platform-control")).toBeInTheDocument();
    expect(screen.getByText("TRIAL")).toBeInTheDocument();
    expect(screen.getByText("responix-development-dashboard")).toBeInTheDocument();
    expect(screen.getByText("#2563eb")).toBeInTheDocument();
    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("platform.configure")).toBeInTheDocument();
  });

  it("renders the empty-feature state", () => {
    if (mocks.platform.snapshot) mocks.platform.snapshot.platform.features = [];
    render(<PlatformControlPage />);
    expect(screen.getByText("No optional feature entitlements")).toBeInTheDocument();
    expect(screen.getByText(/Core permission-gated modules remain available/)).toBeInTheDocument();
  });

  it("renders loading and retryable bootstrap errors", () => {
    mocks.platform.state = "LOADING";
    mocks.platform.snapshot = null;
    const view = render(<PlatformControlPage />);
    expect(view.container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);

    mocks.platform.state = "ERROR";
    view.rerender(<PlatformControlPage />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.platform.retry).toHaveBeenCalledTimes(1);
  });

  it("does not expose platform data without platform.configure", () => {
    mocks.platform.hasPermission.mockReturnValue(false);
    render(<PlatformControlPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByTestId("platform-control")).not.toBeInTheDocument();
  });
});
