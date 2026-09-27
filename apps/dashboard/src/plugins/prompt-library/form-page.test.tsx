import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptCreatePage, PromptEditPage } from "./form-page";
interface FormMocks {
  platform: {
    state: string;
    snapshot: { workspace: { id: string } } | null;
    retry: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn<(permission: string) => boolean>>;
  };
  queries: unknown[];
  mutation: ReturnType<typeof vi.fn<(fn: () => unknown) => void>>;
  replace: ReturnType<typeof vi.fn>;
  promptData: Record<string, unknown> | undefined;
  create: ReturnType<typeof vi.fn<(input: unknown) => Promise<unknown>>>;
  update: ReturnType<typeof vi.fn<(id: string, input: unknown) => Promise<unknown>>>;
  clone: ReturnType<typeof vi.fn<(id: string, input: unknown) => Promise<unknown>>>;
}
const mocks = vi.hoisted((): FormMocks => ({
  platform: {
    state: "READY",
    snapshot: { workspace: { id: "w1" } },
    retry: vi.fn(),
    hasPermission: vi.fn(() => true)
  },
  queries: [],
  mutation: vi.fn(),
  replace: vi.fn(),
  promptData: undefined,
  create: vi.fn(),
  update: vi.fn(),
  clone: vi.fn()
}));
vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: { queryKey: unknown[] }) => {
    mocks.queries.push(c.queryKey);
    const key = c.queryKey.at(-1);
    if (key === "categories" || key === "tags")
      return { data: [], isPending: false, isError: false };
    return { data: mocks.promptData, isPending: false, isError: false, refetch: vi.fn() };
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn(), setQueryData: vi.fn() }),
  useMutation: (c: { mutationFn: () => unknown; onSuccess?: (value: unknown) => unknown }) => ({
    isPending: false,
    mutateAsync: () => Promise.resolve().then(async () => {
        mocks.mutation(c.mutationFn);
        const value=await c.mutationFn();
        await c.onSuccess?.(value);
        return value;
      })
  })
}));
vi.mock("./prompt-api", () => ({
  promptQueryRoot: (workspaceId?: string) => ["workspace", workspaceId, "prompts"],
  createPrompt: (input: unknown) => mocks.create(input),
  updatePrompt: (id: string, input: unknown) => mocks.update(id, input),
  clonePrompt: (id: string, input: unknown) => mocks.clone(id, input),
  publishPrompt: vi.fn(),
  getPrompt: vi.fn(),
  listCategories: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([])
}));
const prompt = (draft: Record<string, unknown>, name = "Support") => ({
  id: "p1",
  workspaceId: "w1",
  name,
  slug: "support",
  description: null,
  status: "DRAFT",
  categoryId: null,
  draft,
  variables: [],
  metadata: {},
  revision: 0,
  favorite: false,
  createdById: "u1",
  updatedById: "u1",
  createdAt: "",
  updatedAt: "",
  deletedAt: null,
  category: null,
  tags: []
});
describe("Prompt form", () => {
  beforeEach(() => {
    mocks.platform.hasPermission.mockReturnValue(true);
    mocks.queries.length = 0;
    mocks.mutation.mockClear();
    mocks.promptData = undefined;
    mocks.create.mockReset();
    mocks.update.mockReset();
    mocks.clone.mockReset();
    mocks.replace.mockReset();
  });
  it("validates required identity", () => {
    render(<PromptCreatePage />);
    fireEvent.click(screen.getByRole("button", { name: "Create prompt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Prompt name is required");
  });
  it("sends the User Prompt as draft.sections.userPrompt when creating", async () => {
    mocks.create.mockImplementation((input) =>
      Promise.resolve(prompt((input as { draft: Record<string, unknown> }).draft))
    );
    render(<PromptCreatePage />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Support" } });
    fireEvent.change(screen.getByLabelText("User Prompt"), {
      target: { value: "Answer the real customer request." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create prompt" }));
    await vi.waitFor(() => expect(mocks.create).toHaveBeenCalled());
    expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({
      draft: { sections: { userPrompt: "Answer the real customer request." } }
    });
  });
  it("uses workspace-scoped resource queries", () => {
    render(<PromptCreatePage />);
    expect(mocks.queries).toContainEqual(["workspace", "w1", "prompts", "categories"]);
    expect(mocks.queries).toContainEqual(["workspace", "w1", "prompts", "tags"]);
  });
  it("edits and reloads the canonical User Prompt through the update endpoint", async () => {
    mocks.promptData = prompt({ sections: { userPrompt: "Original" } }, "Original");
    mocks.update.mockImplementation((_id, input) =>
      Promise.resolve(prompt((input as { draft: Record<string, unknown> }).draft, "Changed"))
    );
    const view = render(<PromptEditPage promptId="p1" />);
    expect(screen.getByLabelText<HTMLInputElement>("User Prompt").value).toBe("Original");
    fireEvent.change(screen.getByLabelText("User Prompt"), {
      target: { value: "Persisted change" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await vi.waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0]?.[1]).toMatchObject({
      draft: { sections: { userPrompt: "Persisted change" } }
    });
    expect(mocks.update.mock.calls[0]?.[1]).not.toHaveProperty("slug");
    view.unmount();
    mocks.promptData = prompt({ sections: { userPrompt: "Persisted change" } }, "Changed");
    render(<PromptEditPage promptId="p1" />);
    expect(screen.getByLabelText<HTMLInputElement>("User Prompt").value).toBe("Persisted change");
  });
  it("opens a supported editable draft for a published Prompt", async () => {
    mocks.promptData = { ...prompt({ sections: { userPrompt: "Published" } }), status: "PUBLISHED" };
    mocks.clone.mockResolvedValue({ ...prompt({ sections: { userPrompt: "Published" } }), id: "draft-copy" });
    render(<PromptEditPage promptId="p1" />);
    fireEvent.click(screen.getByRole("button", { name: "Edit as new draft" }));
    await vi.waitFor(() => expect(mocks.clone).toHaveBeenCalledWith("p1", expect.objectContaining({ name: "Support Draft" })));
    expect(mocks.replace).toHaveBeenCalledWith("/ai/prompts/draft-copy");
  });
  it("denies create without write permission", () => {
    mocks.platform.hasPermission.mockImplementation((p: string) => p !== "prompt.library.write");
    render(<PromptCreatePage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });
  it("requires read permission for existing prompt", () => {
    mocks.platform.hasPermission.mockImplementation((p: string) => p !== "prompt.library.read");
    render(<PromptEditPage promptId="p1" />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });
});
