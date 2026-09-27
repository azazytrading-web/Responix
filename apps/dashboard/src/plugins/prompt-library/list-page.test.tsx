import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptListPage } from "./list-page";
interface ListMocks {
  platform: {
    state: string;
    snapshot: { workspace: { id: string } } | null;
    retry: ReturnType<typeof vi.fn>;
    hasPermission: ReturnType<typeof vi.fn<(permission: string) => boolean>>;
  };
  query: { data: unknown; isPending: boolean; isError: boolean; refetch: ReturnType<typeof vi.fn> };
  config: unknown;
  mutation: ReturnType<typeof vi.fn>;
}
const mocks = vi.hoisted((): ListMocks => ({
  platform: {
    state: "READY",
    snapshot: { workspace: { id: "w1" } },
    retry: vi.fn(),
    hasPermission: vi.fn(() => true)
  },
  query: {
    data: { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } },
    isPending: false,
    isError: false,
    refetch: vi.fn()
  },
  config: undefined,
  mutation: vi.fn()
}));
vi.mock("../../platform", () => ({ usePlatformBootstrap: () => mocks.platform }));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (c: unknown) => {
    mocks.config = c;
    return mocks.query;
  },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ isPending: false, mutateAsync: mocks.mutation })
}));
vi.mock("./resource-manager", () => ({ PromptResourceManager: () => <div>Resource manager</div> }));
describe("PromptListPage", () => {
  beforeEach(() => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mocks.mutation.mockReset();
    mocks.platform.hasPermission.mockReturnValue(true);
    mocks.query.data = { data: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } };
    mocks.query.isPending = false;
    mocks.query.isError = false;
  });
  it("renders empty state, create action, and workspace query", () => {
    render(<PromptListPage />);
    expect(screen.getByText("No prompts yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create Prompt/ })).toHaveAttribute(
      "href",
      "/ai/prompts/new"
    );
    expect(mocks.config).toMatchObject({
      queryKey: [
        "workspace",
        "w1",
        "prompts",
        "list",
        { page: 1, search: "", status: "", archived: false }
      ]
    });
  });
  it("searches and renders persisted resources", () => {
    const view = render(<PromptListPage />);
    fireEvent.change(screen.getByLabelText("Search prompts"), { target: { value: "sales" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(mocks.config).toMatchObject({
      queryKey: [
        "workspace",
        "w1",
        "prompts",
        "list",
        { page: 1, search: "sales", status: "", archived: false }
      ]
    });
    mocks.query.data = {
      data: [
        {
          id: "p1",
          name: "Sales",
          slug: "sales",
          description: null,
          status: "DRAFT",
          revision: 0,
          variables: [],
          favorite: false
        }
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
    };
    view.rerender(<PromptListPage />);
    expect(screen.getByRole("link", { name: "Sales" })).toHaveAttribute("href", "/ai/prompts/p1");
  });
  it("enforces read permission", () => {
    mocks.platform.hasPermission.mockReturnValue(false);
    render(<PromptListPage />);
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });
  it("shows Edit and Delete, but not Archive, for a destructive draft path", () => {
    mocks.query.data = {
      data: [
        {
          id: "p1",
          name: "Draft",
          slug: "d",
          description: null,
          status: "DRAFT",
          revision: 0,
          variables: [],
          favorite: false
        }
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
    };
    render(<PromptListPage />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/ai/prompts/p1");
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  });
  it("requires confirmation before deleting a draft Prompt", () => {
    const confirm = vi.fn(() => false);
    vi.spyOn(window, "confirm").mockImplementation(confirm);
    mocks.query.data = {
      data: [
        {
          id: "p1",
          name: "Draft",
          slug: "d",
          description: null,
          status: "DRAFT",
          revision: 0,
          variables: [],
          favorite: false
        }
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
    };
    render(<PromptListPage />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith("Delete this Prompt? This action cannot be undone.");
    expect(mocks.mutation).not.toHaveBeenCalled();
  });
  it("renders Archive only for published prompts", () => {
    mocks.query.data = {
      data: [
        {
          id: "p2",
          name: "Published",
          slug: "p",
          description: null,
          status: "PUBLISHED",
          revision: 1,
          variables: [],
          favorite: false
        }
      ],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 }
    };
    render(<PromptListPage />);
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
  it("shows Delete and Restore for an archived Prompt", () => {
    mocks.query.data = {
      data: [{ id:"p3",name:"Archived",slug:"archived",description:null,status:"ARCHIVED",revision:1,variables:[],favorite:false }],
      pagination: { page:1,limit:25,total:1,totalPages:1 }
    };
    render(<PromptListPage />);
    expect(screen.getByRole("button", { name:"Delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name:"Restore" })).toBeInTheDocument();
  });
});
