import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeBaseListPage } from "./list-page";

interface QueryState {
  data: unknown;
  isPending: boolean;
  isError: boolean;
  refetch: ReturnType<typeof vi.fn>;
}

interface ListMocks {
  platform: {
    state: string;
    snapshot: { workspace: { id: string } } | null;
    retry: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn<(permission: string) => boolean>>;
  };
  spaces: QueryState;
  documents: QueryState;
  runtimes: QueryState;
  documentsConfig: unknown;
  mutation: { isPending: boolean; mutateAsync: ReturnType<typeof vi.fn> };
}

const mocks = vi.hoisted((): ListMocks => ({
  platform: { state: "READY", snapshot: { workspace: { id: "w1" } }, retry: vi.fn(), hasPermission: vi.fn(() => true) },
  spaces: { data: [], isPending: false, isError: false, refetch: vi.fn() },
  documents: { data: { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } }, isPending: false, isError: false, refetch: vi.fn() },
  runtimes: { data: { data: [] }, isPending: false, isError: false, refetch: vi.fn() },
  documentsConfig: undefined,
  mutation: { isPending: false, mutateAsync: vi.fn() }
}));

vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (config: { queryKey?: unknown }) => {
    const key = JSON.stringify(config.queryKey ?? []);
    if (key.includes("spaces")) return mocks.spaces;
    if (key.includes("runtimes")) return mocks.runtimes;
    mocks.documentsConfig = config;
    return mocks.documents;
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => mocks.mutation
}));

const space = (id: string, name: string, status = "DRAFT") => ({
  id,
  workspaceId: "w1",
  name,
  slug: id,
  description: null,
  categoryId: null,
  metadata: null,
  status,
  createdById: null,
  updatedById: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
  deletedAt: null
});

const document = (id: string, status: "DRAFT" | "INDEXING" | "READY" | "FAILED" | "ARCHIVED" | "PUBLISHED") => ({
  id,
  workspaceId: "w1",
  knowledgeBaseId: "s1",
  collectionId: null,
  folderId: null,
  categoryId: null,
  name: `Document ${id}`,
  slug: `doc-${id}`,
  description: null,
  sourceType: "FILE",
  fileName: `Document ${id}.pdf`,
  originalName: null,
  mimeType: "application/pdf",
  fileSize: "1024",
  language: "en",
  indexingStatus: status === "INDEXING" ? "PROCESSING" : status === "FAILED" ? "FAILED" : "COMPLETED",
  totalChunks: 3,
  status,
  revision: 1,
  createdById: null,
  updatedById: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  archivedAt: null,
  deletedAt: null,
  embeddingStatusMetadata: status === "FAILED" ? { message: "Embedding provider unavailable" } : null
});

describe("KnowledgeBaseListPage", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.platform.state = "READY";
    mocks.platform.snapshot = { workspace: { id: "w1" } };
    mocks.platform.hasPermission.mockReset().mockReturnValue(true);
    mocks.spaces.data = [];
    mocks.spaces.isPending = false;
    mocks.spaces.isError = false;
    mocks.documents.data = { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } };
    mocks.documents.isPending = false;
    mocks.documents.isError = false;
    mocks.runtimes.data = { data: [] };
    mocks.runtimes.isPending = false;
    mocks.runtimes.isError = false;
    mocks.documentsConfig = undefined;
    mocks.mutation.isPending = false;
    mocks.mutation.mutateAsync.mockReset();
  });

  it("renders empty and populated workspace states", () => {
    const view = render(<KnowledgeBaseListPage />);
    expect(screen.getByText("No knowledge spaces yet")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Create space" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Create space" })[0]).toHaveAttribute("href", "/knowledge/new");
    mocks.spaces.data = [space("s1", "Support Articles")];
    mocks.documents.data = { data: [document("d1", "READY")], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    view.rerender(<KnowledgeBaseListPage />);
    expect(screen.getAllByText("Support Articles").length).toBeGreaterThan(0);
    expect(screen.getByText("Document d1.pdf")).toBeInTheDocument();
  });

  it("uses a workspace-scoped query key and backend search", () => {
    mocks.spaces.data = [space("s1", "Support Articles")];
    render(<KnowledgeBaseListPage />);
    expect(mocks.documentsConfig).toMatchObject({
      queryKey: ["workspace", "w1", "knowledge", "documents", { page: 1, search: "", status: "", spaceId: "s1" }]
    });
    fireEvent.change(screen.getByLabelText("Search documents"), { target: { value: "sales" } });
    fireEvent.click(screen.getByRole("button", { name: /Search/ }));
    expect(mocks.documentsConfig).toMatchObject({
      queryKey: ["workspace", "w1", "knowledge", "documents", { page: 1, search: "sales", status: "", spaceId: "s1" }]
    });
  });

  it("renders retryable errors and permission denial", () => {
    mocks.spaces.isError = true;
    mocks.spaces.data = undefined;
    const view = render(<KnowledgeBaseListPage />);
    expect(screen.getByText("Knowledge Base unavailable")).toBeInTheDocument();
    mocks.spaces.isError = false;
    mocks.spaces.data = [space("s1", "Support Articles")];
    mocks.platform.hasPermission.mockImplementation((p: string) => p !== "knowledge.base.read");
    view.rerender(<KnowledgeBaseListPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create space" })).not.toBeInTheDocument();
  });

  it("renders lifecycle actions gated by status", () => {
    mocks.spaces.data = [space("s1", "Support Articles")];
    const view = render(<KnowledgeBaseListPage />);
    mocks.documents.data = { data: [document("d1", "DRAFT")], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    view.rerender(<KnowledgeBaseListPage />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();

    mocks.documents.data = { data: [document("d2", "ARCHIVED")], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    view.rerender(<KnowledgeBaseListPage />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publish" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });


  it("calls the lifecycle mutation for each status-aware action", async () => {
    mocks.mutation.mutateAsync.mockResolvedValue({});
    mocks.spaces.data = [space("s1", "Support Articles")];
    const view = render(<KnowledgeBaseListPage />);
    mocks.documents.data = { data: [document("d1", "DRAFT")], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    view.rerender(<KnowledgeBaseListPage />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await vi.waitFor(() => expect(mocks.mutation.mutateAsync).toHaveBeenCalledWith({ id: "d1", action: "publish" }));
  });

  it("respects the delete confirmation dialog", () => {
    const confirm = vi.fn(() => false);
    vi.spyOn(window, "confirm").mockImplementation(confirm);
    mocks.spaces.data = [space("s1", "Support Articles")];
    mocks.documents.data = { data: [document("d1", "DRAFT")], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    render(<KnowledgeBaseListPage />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Delete this document?"));
    expect(mocks.mutation.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows the upload control only with write permission", () => {
    mocks.spaces.data = [space("s1", "Support Articles")];
    const view = render(<KnowledgeBaseListPage />);
    expect(screen.getAllByRole("button", { name: /Upload document/ }).length).toBeGreaterThan(0);
    mocks.platform.hasPermission.mockImplementation((p: string) => p !== "knowledge.base.write");
    view.rerender(<KnowledgeBaseListPage />);
    expect(screen.queryAllByRole("button", { name: /Upload document/ })).toHaveLength(0);
  });

  it("surfaces the embedding failure reason for failed documents", () => {
    mocks.spaces.data = [space("s1", "Support Articles")];
    mocks.documents.data = { data: [document("d1", "FAILED")], pagination: { page: 1, limit: 25, total: 1, totalPages: 1 } };
    render(<KnowledgeBaseListPage />);
    expect(screen.getByRole("alert")).toHaveTextContent("Embedding provider unavailable");
  });
});

