/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { PromptLibraryRepository } from "./prompt-library.repository";

const prompt = (overrides: Record<string, unknown> = {}) => ({
  id: "prompt",
  workspaceId: "workspace",
  categoryId: "category",
  name: "Welcome",
  slug: "welcome",
  description: "Greeting",
  status: "DRAFT",
  draft: { body: "Hello" },
  variables: [],
  metadata: {},
  revision: 0,
  favorite: false,
  createdById: "actor",
  updatedById: "actor",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  category: {
    id: "category",
    workspaceId: "workspace",
    name: "General",
    slug: "general",
    createdAt: new Date(),
    updatedAt: new Date()
  },
  tags: [
    {
      tag: {
        id: "tag",
        workspaceId: "workspace",
        name: "Greeting",
        slug: "greeting",
        createdAt: new Date()
      }
    }
  ],
  ...overrides
});

describe("PromptLibraryRepository", () => {
  const prisma = {
    promptLibraryItem: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    promptLibraryVersion: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
    promptCategory: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn()
    },
    promptTag: {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn()
    },
    promptTagAssignment: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn()
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn()
  };
  const repository = new PromptLibraryRepository(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (transaction: typeof prisma) => unknown)(prisma);
    });
    prisma.promptLibraryItem.findFirst.mockResolvedValue(prompt());
    prisma.promptLibraryItem.create.mockResolvedValue(prompt());
    prisma.promptLibraryItem.update.mockResolvedValue(prompt());
    prisma.promptCategory.findFirst.mockResolvedValue(prompt().category);
    prisma.promptTag.count.mockResolvedValue(1);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it("creates prompts, validates workspace references, and audits in one transaction", async () => {
    await repository.create({
      workspaceId: "workspace",
      actorId: "actor",
      name: "Welcome",
      slug: "welcome",
      categoryId: "category",
      tagIds: ["tag"]
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.promptCategory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "category", workspaceId: "workspace" } })
    );
    expect(prisma.promptTag.count).toHaveBeenCalledWith({
      where: { workspaceId: "workspace", id: { in: ["tag"] } }
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "prompt.created", workspaceId: "workspace" })
      })
    );
  });

  it("rejects cross-workspace categories and tags", async () => {
    prisma.promptCategory.findFirst.mockResolvedValue(null);
    await expect(
      repository.create({
        workspaceId: "workspace",
        actorId: "actor",
        name: "Welcome",
        slug: "welcome",
        categoryId: "foreign"
      })
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.promptCategory.findFirst.mockResolvedValue(prompt().category);
    prisma.promptTag.count.mockResolvedValue(0);
    await expect(
      repository.create({
        workspaceId: "workspace",
        actorId: "actor",
        name: "Welcome",
        slug: "welcome",
        tagIds: ["foreign"]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("forbids editing published prompts", async () => {
    prisma.promptLibraryItem.findFirst.mockResolvedValue(prompt({ status: "PUBLISHED", revision: 1 }));
    await expect(
      repository.updateDraft({
        workspaceId: "workspace",
        actorId: "actor",
        id: "prompt",
        draft: { body: "Changed" }
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.promptLibraryItem.update).not.toHaveBeenCalled();
  });

  it("publishes an immutable version and increments revision transactionally", async () => {
    const version = { id: "version", promptId: "prompt", revision: 1 };
    prisma.promptLibraryVersion.create.mockResolvedValue(version);
    prisma.promptLibraryItem.update.mockResolvedValue(prompt({ status: "PUBLISHED", revision: 1 }));

    const result = await repository.publish({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      changeSummary: "Ready"
    });

    expect(prisma.promptLibraryVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptId: "prompt",
          revision: 1,
          changeSummary: "Ready",
          snapshot: expect.objectContaining({ tagIds: ["tag"] })
        })
      })
    );
    expect(result.version).toBe(version);
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "prompt.published" })
      })
    );
  });

  it("rollback creates a new published version without changing the source version", async () => {
    prisma.promptLibraryItem.findFirst.mockResolvedValue(prompt({ status: "PUBLISHED", revision: 3 }));
    prisma.promptLibraryVersion.findFirst.mockResolvedValue({
      id: "source",
      promptId: "prompt",
      revision: 1,
      snapshot: {
        name: "Original",
        slug: "welcome",
        description: null,
        categoryId: "category",
        tagIds: ["tag"],
        draft: { body: "Original" },
        variables: [],
        metadata: {}
      },
      changeSummary: null,
      createdById: "actor",
      createdAt: new Date(),
      publishedAt: new Date()
    });
    prisma.promptLibraryVersion.create.mockResolvedValue({ id: "new", revision: 4 });

    await repository.rollback({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      revision: 1
    });

    expect(prisma.promptLibraryVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ revision: 4, changeSummary: "Rollback to revision 1" })
      })
    );
    expect(prisma.promptLibraryVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ promptId: "prompt", revision: 1 })
      })
    );
  });

  it("archives and restores published state without deleting history", async () => {
    prisma.promptLibraryItem.findFirst
      .mockResolvedValueOnce(prompt({ status: "PUBLISHED", revision: 2 }))
      .mockResolvedValueOnce(
        prompt({ status: "ARCHIVED", revision: 2, deletedAt: new Date() })
      );
    await repository.archive("workspace", "actor", "prompt");
    await repository.restore("workspace", "actor", "prompt");

    expect(prisma.promptLibraryItem.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ status: "ARCHIVED", deletedAt: expect.any(Date) })
      })
    );
    expect(prisma.promptLibraryItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED", deletedAt: null })
      })
    );
    expect(prisma.promptLibraryVersion.create).not.toHaveBeenCalled();
  });

  it("clones into an independent draft with no versions or shared prompt id", async () => {
    prisma.promptLibraryItem.create.mockResolvedValue(
      prompt({ id: "clone", name: "Copy", slug: "copy", categoryId: "category" })
    );
    await repository.clone({
      workspaceId: "workspace",
      actorId: "actor",
      id: "prompt",
      name: "Copy",
      slug: "copy"
    });

    expect(prisma.promptLibraryItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace",
          name: "Copy",
          slug: "copy",
          status: "DRAFT",
          revision: 0,
          favorite: false
        })
      })
    );
    expect(prisma.promptLibraryVersion.create).not.toHaveBeenCalled();
  });

  it("searches, filters, sorts, and paginates in the workspace", async () => {
    prisma.promptLibraryItem.findMany.mockResolvedValue([prompt()]);
    prisma.promptLibraryItem.count.mockResolvedValue(1);
    const result = await repository.list({
      workspaceId: "workspace",
      page: 2,
      limit: 10,
      search: "hello",
      categoryId: "category",
      tagIds: ["tag"],
      favorite: true,
      sortBy: "name",
      sortOrder: "asc"
    });

    expect(prisma.promptLibraryItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: "workspace",
          deletedAt: null,
          categoryId: "category",
          favorite: true,
          tags: { some: { tagId: { in: ["tag"] } } }
        }),
        skip: 10,
        take: 10,
        orderBy: [{ name: "asc" }, { id: "asc" }]
      })
    );
    expect(result.pagination).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
  });

  it("rolls back the entire mutation when audit creation fails", async () => {
    const failure = new Error("audit unavailable");
    prisma.$transaction.mockImplementation(async (callback: unknown) => {
      await (callback as (transaction: typeof prisma) => unknown)(prisma);
      throw failure;
    });
    await expect(repository.setFavorite("workspace", "actor", "prompt", true)).rejects.toBe(
      failure
    );
  });

  it("protects taxonomy deletion while in use", async () => {
    prisma.promptTag.findFirst.mockResolvedValue(prompt().tags[0]?.tag);
    prisma.promptTagAssignment.count.mockResolvedValue(1);
    await expect(repository.deleteTag("workspace", "actor", "tag")).rejects.toBeInstanceOf(
      ConflictException
    );
    expect(prisma.promptTag.delete).not.toHaveBeenCalled();
  });
});
