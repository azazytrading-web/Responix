import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SystemLauncher } from "./system-launcher";

describe("SystemLauncher", () => {
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("presents Responix and OIC as separate systems and links to the OIC placeholder", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve({ available: false }) }));
    render(<SystemLauncher />);

    expect(screen.getByRole("heading", { name: "Responix" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OIC" })).toBeInTheDocument();
    const openLinks = screen.getAllByRole("link", { name: /Open System/ });
    expect(openLinks[0]).toHaveAttribute("href", "http://localhost:3001");
    expect(openLinks[1]).toHaveAttribute("href", "/oic");
    await waitFor(() => expect(screen.getByText("OIC API OFFLINE")).toBeInTheDocument());
  });
});
