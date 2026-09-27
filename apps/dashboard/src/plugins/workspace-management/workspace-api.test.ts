import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WORKSPACE_EDITABLE_FIELDS,
  changedWorkspaceFields,
  updateCurrentWorkspace,
  validateWorkspaceUpdate
} from "./workspace-api";

const mocks = vi.hoisted(() => ({ patch: vi.fn(), get: vi.fn() }));

vi.mock("@responix/api-client", () => ({ apiClient: mocks }));

const values = {
  name: "Workspace",
  companyName: "Company",
  country: "Egypt",
  timezone: "Africa/Cairo",
  language: "en",
  currency: "USD"
};

describe("workspace update API contract", () => {
  beforeEach(() => mocks.patch.mockReset());

  it("exposes only backend-supported editable fields and limits", () => {
    expect(WORKSPACE_EDITABLE_FIELDS).toEqual({
      name: { label: "Workspace name", maxLength: 120 },
      companyName: { label: "Company name", maxLength: 120 },
      country: { label: "Country", maxLength: 80 },
      timezone: { label: "Timezone", maxLength: 50 },
      language: { label: "Language", maxLength: 12 },
      currency: { label: "Currency", maxLength: 3 }
    });
    expect(validateWorkspaceUpdate(values)).toEqual({});
    expect(validateWorkspaceUpdate({ ...values, currency: "EURO" })).toEqual({
      currency: "Currency must be 3 characters or fewer."
    });
  });

  it("serializes only changed fields through the canonical API client", async () => {
    const updated = { id: "w1", country: "Jordan" };
    mocks.patch.mockResolvedValue(updated);
    const payload = changedWorkspaceFields(values, { ...values, country: "Jordan" });

    await expect(updateCurrentWorkspace(payload)).resolves.toBe(updated);
    expect(payload).toEqual({ country: "Jordan" });
    expect(mocks.patch).toHaveBeenCalledWith(
      "/api/v1/workspaces/current",
      { country: "Jordan" },
      { credentials: "include" }
    );
  });
});
