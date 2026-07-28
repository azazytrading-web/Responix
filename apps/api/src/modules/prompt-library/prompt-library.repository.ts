import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, StudioProjectStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

export type PromptJson = Record<string, unknown>;
export type PromptSortBy = "name" | "createdAt" | "updatedAt" | "revision";
export type PromptSortOrder = "asc" | "desc";
export type PromptListInput = {
  workspaceId: string;
  page: number;
  limit: number;
  search?: string;
  status?: StudioProjectStatus;
  categoryId?: string;
  tagIds?: string[];
  favorite?: boolean;
  archived?: boolean;
  sortBy: PromptSortBy;
  sortOrder: PromptSortOrder;
};

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class PromptLibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    workspaceId: string;
    actorId: string;
    name: string;
    slug: string;
    description?: string;
    categoryId?: string;
    tagIds?: string[];
    draft?: PromptJson;
    variables?: unknown[];
    metadata?: PromptJson;
  }) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        await this.validateReferences(tx, input.workspaceId, input.categoryId, input.tagIds ?? []);
        const prompt = await tx.promptLibraryItem.create({
          data: {
            workspaceId: input.workspaceId,
            name: input.name,
            slug: input.slug,
            description: input.description,
            categoryId: input.categoryId,
            draft: json(input.draft ?? {}),
            variables: json(input.variables ?? []),
            metadata: json(input.metadata ?? {}),
            createdById: input.actorId,
            updatedById: input.actorId,
            tags: input.tagIds?.length
              ? { create: input.tagIds.map((tagId) => ({ tagId })) }
              : undefined
          },
          select: this.promptSelect
        });
        await this.audit(tx, input.workspaceId, input.actorId, "prompt.created", prompt.id, null, prompt);
        return prompt;
      })
    );
  }

  async updateDraft(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    name?: string;
    description?: string | null;
    categoryId?: string | null;
    tagIds?: string[];
    draft?: PromptJson;
    variables?: unknown[];
    metadata?: PromptJson;
  }) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requirePrompt(tx, input.workspaceId, input.id);
        this.assertDraft(current.status);
        await this.validateReferences(
          tx,
          input.workspaceId,
          input.categoryId ?? undefined,
          input.tagIds ?? []
        );
        const prompt = await tx.promptLibraryItem.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description,
            categoryId: input.categoryId,
            draft: input.draft === undefined ? undefined : json(input.draft),
            variables: input.variables === undefined ? undefined : json(input.variables),
            metadata: input.metadata === undefined ? undefined : json(input.metadata),
            updatedById: input.actorId,
            tags:
              input.tagIds === undefined
                ? undefined
                : {
                    deleteMany: {},
                    create: input.tagIds.map((tagId) => ({ tagId }))
                  }
          },
          select: this.promptSelect
        });
        await this.audit(
          tx,
          input.workspaceId,
          input.actorId,
          "prompt.draft_updated",
          prompt.id,
          current,
          prompt
        );
        return prompt;
      })
    );
  }

  updateMetadata(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    metadata: PromptJson;
    variables?: unknown[];
  }) {
    return this.updateDraft(input);
  }

  async publish(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    changeSummary?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrompt(tx, input.workspaceId, input.id);
      this.assertDraft(current.status);
      const revision = current.revision + 1;
      const snapshot = this.snapshot(current);
      const publishedAt = new Date();
      const version = await tx.promptLibraryVersion.create({
        data: {
          promptId: current.id,
          revision,
          snapshot: json(snapshot),
          changeSummary: input.changeSummary,
          createdById: input.actorId,
          publishedAt
        },
        select: this.versionSelect
      });
      const prompt = await tx.promptLibraryItem.update({
        where: { id: current.id },
        data: {
          status: "PUBLISHED",
          revision,
          updatedById: input.actorId
        },
        select: this.promptSelect
      });
      await this.audit(tx, input.workspaceId, input.actorId, "prompt.published", prompt.id, current, {
        prompt,
        version
      });
      return { prompt, version };
    });
  }

  async rollback(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    revision: number;
    changeSummary?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrompt(tx, input.workspaceId, input.id);
      const source = await tx.promptLibraryVersion.findFirst({
        where: {
          promptId: current.id,
          revision: input.revision,
          publishedAt: { not: null }
        },
        select: this.versionSelect
      });
      if (!source) throw new NotFoundException("Published prompt version was not found");
      const restored = this.readSnapshot(source.snapshot);
      await this.validateReferences(
        tx,
        input.workspaceId,
        restored.categoryId ?? undefined,
        restored.tagIds
      );
      const nextRevision = current.revision + 1;
      const publishedAt = new Date();
      const version = await tx.promptLibraryVersion.create({
        data: {
          promptId: current.id,
          revision: nextRevision,
          snapshot: json(restored),
          changeSummary: input.changeSummary ?? `Rollback to revision ${input.revision}`,
          createdById: input.actorId,
          publishedAt
        },
        select: this.versionSelect
      });
      const prompt = await tx.promptLibraryItem.update({
        where: { id: current.id },
        data: {
          name: restored.name,
          description: restored.description,
          categoryId: restored.categoryId,
          draft: json(restored.draft),
          variables: json(restored.variables),
          metadata: json(restored.metadata),
          status: "PUBLISHED",
          revision: nextRevision,
          updatedById: input.actorId,
          tags: {
            deleteMany: {},
            create: restored.tagIds.map((tagId) => ({ tagId }))
          }
        },
        select: this.promptSelect
      });
      await this.audit(tx, input.workspaceId, input.actorId, "prompt.rolled_back", prompt.id, current, {
        sourceRevision: input.revision,
        prompt,
        version
      });
      return { prompt, version };
    });
  }

  async clone(input: {
    workspaceId: string;
    actorId: string;
    id: string;
    name: string;
    slug: string;
  }) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const source = await this.requirePrompt(tx, input.workspaceId, input.id);
        const tagIds = source.tags.map(({ tag }) => tag.id);
        const prompt = await tx.promptLibraryItem.create({
          data: {
            workspaceId: input.workspaceId,
            categoryId: source.categoryId,
            name: input.name,
            slug: input.slug,
            description: source.description,
            status: "DRAFT",
            draft: json(source.draft),
            variables: json(source.variables),
            metadata: json(source.metadata),
            revision: 0,
            favorite: false,
            createdById: input.actorId,
            updatedById: input.actorId,
            tags: tagIds.length
              ? { create: tagIds.map((tagId) => ({ tagId })) }
              : undefined
          },
          select: this.promptSelect
        });
        await this.audit(tx, input.workspaceId, input.actorId, "prompt.cloned", prompt.id, null, {
          sourcePromptId: source.id,
          prompt
        });
        return prompt;
      })
    );
  }

  get(workspaceId: string, id: string, includeArchived = false) {
    return this.requirePrompt(this.prisma, workspaceId, id, includeArchived);
  }

  async history(workspaceId: string, id: string) {
    await this.requirePrompt(this.prisma, workspaceId, id, true);
    return this.prisma.promptLibraryVersion.findMany({
      where: { promptId: id, prompt: { workspaceId } },
      orderBy: { revision: "desc" },
      select: this.versionSelect
    });
  }

  async list(input: PromptListInput) {
    const where: Prisma.PromptLibraryItemWhereInput = {
      workspaceId: input.workspaceId,
      deletedAt: input.archived ? { not: null } : null,
      status: input.status,
      categoryId: input.categoryId,
      favorite: input.favorite,
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { slug: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(input.tagIds?.length
        ? { tags: { some: { tagId: { in: input.tagIds } } } }
        : {})
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.promptLibraryItem.findMany({
        where,
        orderBy: [{ [input.sortBy]: input.sortOrder }, { id: "asc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: this.promptSelect
      }),
      this.prisma.promptLibraryItem.count({ where })
    ]);
    return {
      data,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit)
      }
    };
  }

  archive(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrompt(tx, workspaceId, id);
      const prompt = await tx.promptLibraryItem.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: "ARCHIVED",
          updatedById: actorId
        },
        select: this.promptSelect
      });
      await this.audit(tx, workspaceId, actorId, "prompt.archived", id, current, prompt);
      return prompt;
    });
  }

  restore(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrompt(tx, workspaceId, id, true);
      if (!current.deletedAt || current.status !== "ARCHIVED") {
        throw new ConflictException("Only archived prompts can be restored");
      }
      const prompt = await tx.promptLibraryItem.update({
        where: { id },
        data: {
          deletedAt: null,
          status: current.revision > 0 ? "PUBLISHED" : "DRAFT",
          updatedById: actorId
        },
        select: this.promptSelect
      });
      await this.audit(tx, workspaceId, actorId, "prompt.restored", id, current, prompt);
      return prompt;
    });
  }

  setFavorite(workspaceId: string, actorId: string, id: string, favorite: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requirePrompt(tx, workspaceId, id);
      const prompt = await tx.promptLibraryItem.update({
        where: { id },
        data: { favorite, updatedById: actorId },
        select: this.promptSelect
      });
      await this.audit(tx, workspaceId, actorId, "prompt.favorite_updated", id, current, prompt);
      return prompt;
    });
  }

  createCategory(workspaceId: string, actorId: string, name: string, slug: string) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const category = await tx.promptCategory.create({
          data: { workspaceId, name, slug },
          select: this.categorySelect
        });
        await this.audit(tx, workspaceId, actorId, "prompt.category_created", category.id, null, category, "PromptCategory");
        return category;
      })
    );
  }

  listCategories(workspaceId: string) {
    return this.prisma.promptCategory.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: this.categorySelect
    });
  }

  updateCategory(workspaceId: string, actorId: string, id: string, name?: string, slug?: string) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireCategory(tx, workspaceId, id);
        const category = await tx.promptCategory.update({
          where: { id },
          data: { name, slug },
          select: this.categorySelect
        });
        await this.audit(tx, workspaceId, actorId, "prompt.category_updated", id, current, category, "PromptCategory");
        return category;
      })
    );
  }

  deleteCategory(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireCategory(tx, workspaceId, id);
      const used = await tx.promptLibraryItem.count({ where: { workspaceId, categoryId: id } });
      if (used > 0) throw new ConflictException("Prompt category is in use");
      await tx.promptCategory.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "prompt.category_deleted", id, current, null, "PromptCategory");
    });
  }

  createTag(workspaceId: string, actorId: string, name: string, slug: string) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const tag = await tx.promptTag.create({
          data: { workspaceId, name, slug },
          select: this.tagSelect
        });
        await this.audit(tx, workspaceId, actorId, "prompt.tag_created", tag.id, null, tag, "PromptTag");
        return tag;
      })
    );
  }

  listTags(workspaceId: string) {
    return this.prisma.promptTag.findMany({
      where: { workspaceId },
      orderBy: { name: "asc" },
      select: this.tagSelect
    });
  }

  updateTag(workspaceId: string, actorId: string, id: string, name?: string, slug?: string) {
    return this.withUniqueErrors(async () =>
      this.prisma.$transaction(async (tx) => {
        const current = await this.requireTag(tx, workspaceId, id);
        const tag = await tx.promptTag.update({
          where: { id },
          data: { name, slug },
          select: this.tagSelect
        });
        await this.audit(tx, workspaceId, actorId, "prompt.tag_updated", id, current, tag, "PromptTag");
        return tag;
      })
    );
  }

  deleteTag(workspaceId: string, actorId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireTag(tx, workspaceId, id);
      const used = await tx.promptTagAssignment.count({ where: { tagId: id } });
      if (used > 0) throw new ConflictException("Prompt tag is in use");
      await tx.promptTag.delete({ where: { id } });
      await this.audit(tx, workspaceId, actorId, "prompt.tag_deleted", id, current, null, "PromptTag");
    });
  }

  assignTag(workspaceId: string, actorId: string, promptId: string, tagId: string) {
    return this.prisma.$transaction(async (tx) => {
      const prompt = await this.requirePrompt(tx, workspaceId, promptId);
      this.assertDraft(prompt.status);
      const tag = await this.requireTag(tx, workspaceId, tagId);
      await tx.promptTagAssignment.upsert({
        where: { promptId_tagId: { promptId, tagId } },
        create: { promptId, tagId },
        update: {}
      });
      await this.audit(tx, workspaceId, actorId, "prompt.tag_assigned", promptId, null, {
        tagId: tag.id
      });
    });
  }

  removeTag(workspaceId: string, actorId: string, promptId: string, tagId: string) {
    return this.prisma.$transaction(async (tx) => {
      const prompt = await this.requirePrompt(tx, workspaceId, promptId);
      this.assertDraft(prompt.status);
      await this.requireTag(tx, workspaceId, tagId);
      const deleted = await tx.promptTagAssignment.deleteMany({ where: { promptId, tagId } });
      if (deleted.count === 0) throw new NotFoundException("Prompt tag assignment was not found");
      await this.audit(tx, workspaceId, actorId, "prompt.tag_removed", promptId, { tagId }, null);
    });
  }

  private readonly categorySelect = {
    id: true,
    workspaceId: true,
    name: true,
    slug: true,
    createdAt: true,
    updatedAt: true
  } as const;

  private readonly tagSelect = {
    id: true,
    workspaceId: true,
    name: true,
    slug: true,
    createdAt: true
  } as const;

  private readonly promptSelect = {
    id: true,
    workspaceId: true,
    categoryId: true,
    name: true,
    slug: true,
    description: true,
    status: true,
    draft: true,
    variables: true,
    metadata: true,
    revision: true,
    favorite: true,
    createdById: true,
    updatedById: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    category: { select: this.categorySelect },
    tags: { select: { tag: { select: this.tagSelect } }, orderBy: { tag: { name: "asc" as const } } }
  } as const;

  private readonly versionSelect = {
    id: true,
    promptId: true,
    revision: true,
    snapshot: true,
    changeSummary: true,
    createdById: true,
    createdAt: true,
    publishedAt: true
  } as const;

  private requirePrompt(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string,
    includeArchived = false
  ) {
    return client.promptLibraryItem
      .findFirst({
        where: { id, workspaceId, ...(includeArchived ? {} : { deletedAt: null }) },
        select: this.promptSelect
      })
      .then((prompt) => {
        if (!prompt) throw new NotFoundException("Prompt was not found");
        return prompt;
      });
  }

  private requireCategory(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.promptCategory
      .findFirst({ where: { id, workspaceId }, select: this.categorySelect })
      .then((category) => {
        if (!category) throw new NotFoundException("Prompt category was not found");
        return category;
      });
  }

  private requireTag(
    client: PrismaService | Prisma.TransactionClient,
    workspaceId: string,
    id: string
  ) {
    return client.promptTag
      .findFirst({ where: { id, workspaceId }, select: this.tagSelect })
      .then((tag) => {
        if (!tag) throw new NotFoundException("Prompt tag was not found");
        return tag;
      });
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    categoryId: string | undefined,
    tagIds: string[]
  ) {
    if (categoryId) await this.requireCategory(tx, workspaceId, categoryId);
    if (new Set(tagIds).size !== tagIds.length) {
      throw new BadRequestException("Prompt tags must be unique");
    }
    if (tagIds.length) {
      const count = await tx.promptTag.count({ where: { workspaceId, id: { in: tagIds } } });
      if (count !== tagIds.length) {
        throw new BadRequestException("One or more prompt tags are not available in this workspace");
      }
    }
  }

  private assertDraft(status: StudioProjectStatus) {
    if (status !== "DRAFT") throw new BadRequestException("Only draft prompts can be modified");
  }

  private snapshot(prompt: Awaited<ReturnType<PromptLibraryRepository["requirePrompt"]>>) {
    return {
      name: prompt.name,
      slug: prompt.slug,
      description: prompt.description,
      categoryId: prompt.categoryId,
      tagIds: prompt.tags.map(({ tag }) => tag.id),
      draft: prompt.draft,
      variables: prompt.variables,
      metadata: prompt.metadata
    };
  }

  private readSnapshot(value: Prisma.JsonValue) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("Published prompt version has an invalid snapshot");
    }
    const snapshot = value as Record<string, Prisma.JsonValue>;
    if (
      typeof snapshot.name !== "string" ||
      typeof snapshot.slug !== "string" ||
      !snapshot.draft ||
      typeof snapshot.draft !== "object" ||
      Array.isArray(snapshot.draft) ||
      !Array.isArray(snapshot.variables) ||
      !snapshot.metadata ||
      typeof snapshot.metadata !== "object" ||
      Array.isArray(snapshot.metadata) ||
      !Array.isArray(snapshot.tagIds) ||
      !snapshot.tagIds.every((tagId) => typeof tagId === "string")
    ) {
      throw new ConflictException("Published prompt version has an invalid snapshot");
    }
    return {
      name: snapshot.name,
      slug: snapshot.slug,
      description: typeof snapshot.description === "string" ? snapshot.description : null,
      categoryId: typeof snapshot.categoryId === "string" ? snapshot.categoryId : null,
      tagIds: snapshot.tagIds,
      draft: snapshot.draft as PromptJson,
      variables: snapshot.variables,
      metadata: snapshot.metadata as PromptJson
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    actorId: string,
    action: string,
    entityId: string,
    before: unknown,
    after: unknown,
    entityType = "PromptLibraryItem"
  ) {
    await tx.auditLog.create({
      data: {
        workspaceId,
        userId: actorId,
        action,
        entityType,
        entityId,
        oldValues: before === null ? Prisma.JsonNull : json(before),
        newValues: after === null ? Prisma.JsonNull : json(after)
      }
    });
  }

  private async withUniqueErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("A resource with this slug already exists in the workspace");
      }
      throw error;
    }
  }
}
