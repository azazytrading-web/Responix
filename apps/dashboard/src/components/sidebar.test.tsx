import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./sidebar";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  navigation: [] as Array<Record<string, unknown>>,
  platform: { navigationRegistry: {} }
}));

vi.mock("@responix/auth", () => ({
  useAuth: () => ({ user: { fullName: "Test User", email: "test@example.com" }, logout: mocks.logout })
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("../navigation", () => ({
  useResolvedNavigation: () => mocks.navigation,
  resolveIcon: () => undefined
}));
vi.mock("./workspace-switcher", () => ({ WorkspaceSwitcher: () => <div>Workspace</div> }));

describe("Sidebar", () => {
  beforeEach(() => {
    mocks.logout.mockReset();
    mocks.navigation = [
      { id: "company", label: "Company", route: "/company", depth: 0, active: false, group: "workspace" },
      { id: "members", label: "Members", route: "/company/members", depth: 1, parentId: "company", active: true, group: "workspace" },
      { id: "hidden", label: "Hidden", route: "/hidden", depth: 0, active: false, group: "workspace" }
    ];
  });

  it("renders real nested routes and exposes the active route", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Company" })).toHaveAttribute("href", "/company");
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute("href", "/company/members");
    expect(screen.getByRole("link", { name: "Members" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Hidden" })).toBeInTheDocument();
  });

  it("renders only the navigation items supplied by the permission-filtered registry", () => {
    mocks.navigation = [{ id: "dashboard", label: "Dashboard", route: "/", depth: 0, active: true }];
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Members" })).not.toBeInTheDocument();
  });
});
