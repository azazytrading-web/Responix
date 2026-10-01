import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SystemLauncher } from "./system-launcher";

describe("SystemLauncher", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("presents OIC first and links each system to its independent application", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve({ available: false }) }));
    render(<SystemLauncher />);

    const systemNames = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(systemNames).toEqual(["OIC", "Responix"]);
    const openLinks = screen.getAllByRole("link", { name: /Open System/ });
    expect(openLinks[0]).toHaveAttribute("href", "http://localhost:3002");
    expect(openLinks[1]).toHaveAttribute("href", "http://localhost:3001");
    await waitFor(() => expect(screen.getByText("OIC API OFFLINE")).toBeInTheDocument());
  });
});
