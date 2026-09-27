import { WorkspaceResponseDto } from "./workspace-response.dto";

describe("WorkspaceResponseDto", () => {
  it("converts Prisma bigint storage values into JSON-compatible numbers", () => {
    const response = WorkspaceResponseDto.from({
      id: "workspace-1",
      name: "Responix Development",
      slug: "responix-development",
      maxStorage: 1_000n,
      currentStorageUsage: 25n
    });

    expect(response).toMatchObject({
      maxStorage: 1_000,
      currentStorageUsage: 25
    });
    expect(() => JSON.stringify(response)).not.toThrow();
  });
});
