import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigationRegistry } from "../navigation/registry";
import { CommandPalette } from "./command-palette";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
const registry = new NavigationRegistry();
registry.load({
  items: [
    { id: "dashboard", label: "Dashboard", route: "/", order: 1, placement: "sidebar" },
    { id: "team", label: "Team", route: "/company/members", order: 2, placement: "sidebar", visibility: { permissions: ["workspace.members.read"] } },
    { id: "agents", label: "Agents", route: "/ai/agents", order: 3, placement: "sidebar", visibility: { permissions: ["agent.studio.read"] } },
    { id: "providers", label: "Providers", route: "/ai/providers", order: 4, placement: "sidebar", visibility: { permissions: ["ai.configure"] } },
    { id: "prompts", label: "Prompt Library", route: "/ai/prompts", order: 5, placement: "sidebar", visibility: { permissions: ["prompt.library.read"] } }
  ]
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }), usePathname: () => "/" }));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@responix/auth", () => ({ useAuth: () => ({ workspace: { id: "w1" } }) }));
vi.mock("../platform", () => ({ usePlatformBootstrap: () => ({ navigationRegistry: registry, permissions: ["workspace.members.read", "agent.studio.read", "ai.configure", "prompt.library.read"], features: [] }) }));

describe("CommandPalette", () => {
  beforeEach(() => mocks.push.mockReset());

  it("uses only backend-resolved manifest navigation", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(screen.getByRole("button", { name: "navigation: Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "navigation: Team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "navigation: Agents" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "navigation: Providers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "navigation: Prompt Library" })).toBeInTheDocument();
    expect(screen.queryByText(/Inbox|Customers|Workflows|Knowledge Base/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "navigation: Agents" }));
    expect(mocks.push).toHaveBeenCalledWith("/ai/agents");
  });
});
