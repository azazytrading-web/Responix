import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";

type Draft = Record<string, unknown>;
const json = (value: Draft): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

@Injectable()
export class StudioProjectRepository {
  constructor(private readonly prisma: PrismaService) {}
  async createProject(input: { workspaceId: string; actorId: string; name: string; slug: string; description?: string; draft?: Draft }) {
    return this.prisma.$transaction(async (tx) => {
      const project = await tx.studioProject.create({ data: { workspaceId: input.workspaceId, name: input.name, slug: input.slug, description: input.description, draft: json(input.draft ?? {}), createdById: input.actorId, updatedById: input.actorId }, select: this.projectSelect });
      await this.audit(tx, input.workspaceId, input.actorId, "studio.project.created", project.id, null, project);
      return project;
    });
  }
  async updateDraft(input: { workspaceId: string; actorId: string; projectId: string; name?: string; description?: string; draft: Draft }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireProject(tx, input.workspaceId, input.projectId);
      if (current.status === "ARCHIVED") throw new NotFoundException("Archived projects cannot be edited");
      const project = await tx.studioProject.update({ where: { id: input.projectId }, data: { name: input.name, description: input.description, draft: json(input.draft), status: "DRAFT", updatedById: input.actorId }, select: this.projectSelect });
      await this.audit(tx, input.workspaceId, input.actorId, "studio.project.draft_updated", project.id, current, project);
      return project;
    });
  }
  async publishProject(input: { workspaceId: string; actorId: string; projectId: string; changeSummary?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireProject(tx, input.workspaceId, input.projectId);
      if (current.status === "ARCHIVED") throw new NotFoundException("Archived projects cannot be published");
      const revision = current.revision + 1;
      const snapshot = { name: current.name, slug: current.slug, description: current.description, draft: current.draft };
      const publishedAt = new Date();
      const created = await tx.studioProjectRevision.create({ data: { projectId: current.id, revision, snapshot, changeSummary: input.changeSummary, createdById: input.actorId, publishedAt }, select: { id: true, revision: true, publishedAt: true, changeSummary: true, snapshot: true } });
      const project = await tx.studioProject.update({ where: { id: current.id }, data: { status: "PUBLISHED", revision, updatedById: input.actorId }, select: this.projectSelect });
      await this.audit(tx, input.workspaceId, input.actorId, "studio.project.published", project.id, current, { project, revision: created.revision });
      return { project, revision: created };
    });
  }
  async rollbackProject(input: { workspaceId: string; actorId: string; projectId: string; revision: number; changeSummary?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.requireProject(tx, input.workspaceId, input.projectId);
      const source = await tx.studioProjectRevision.findFirst({ where: { projectId: current.id, revision: input.revision, publishedAt: { not: null } } });
      if (!source) throw new NotFoundException("Published revision was not found");
      const restored = source.snapshot as Draft;
      const next = current.revision + 1;
      const publishedAt = new Date();
      const revision = await tx.studioProjectRevision.create({ data: { projectId: current.id, revision: next, snapshot: source.snapshot as Prisma.InputJsonValue, changeSummary: input.changeSummary ?? `Rollback to revision ${input.revision}`, createdById: input.actorId, publishedAt }, select: { id: true, revision: true, publishedAt: true, changeSummary: true, snapshot: true } });
      const project = await tx.studioProject.update({ where: { id: current.id }, data: { name: typeof restored.name === "string" ? restored.name : current.name, description: typeof restored.description === "string" ? restored.description : current.description, draft: restored.draft ?? {}, status: "PUBLISHED", revision: next, updatedById: input.actorId }, select: this.projectSelect });
      await this.audit(tx, input.workspaceId, input.actorId, "studio.project.rolled_back", project.id, current, { project, revision: revision.revision });
      return { project, revision };
    });
  }
  async archiveProject(workspaceId: string, actorId: string, projectId: string) {
    return this.prisma.$transaction(async (tx) => { const current = await this.requireProject(tx, workspaceId, projectId); const project = await tx.studioProject.update({ where: { id: projectId }, data: { status: "ARCHIVED", archivedAt: new Date(), updatedById: actorId }, select: this.projectSelect }); await this.audit(tx, workspaceId, actorId, "studio.project.archived", project.id, current, project); return project; });
  }
  listProjects(workspaceId: string) { return this.prisma.studioProject.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" }, select: this.projectSelect }); }
  async getProject(workspaceId: string, projectId: string) { return this.requireProject(this.prisma, workspaceId, projectId); }
  getRevisionHistory(workspaceId: string, projectId: string) { return this.prisma.studioProjectRevision.findMany({ where: { project: { workspaceId }, projectId }, orderBy: { revision: "desc" }, select: { id: true, revision: true, changeSummary: true, createdById: true, createdAt: true, publishedAt: true, snapshot: true } }); }
  private readonly projectSelect = { id: true, workspaceId: true, name: true, slug: true, description: true, status: true, draft: true, revision: true, createdById: true, updatedById: true, createdAt: true, updatedAt: true, archivedAt: true } as const;
  private async requireProject(client: PrismaService | Prisma.TransactionClient, workspaceId: string, projectId: string) { const project = await client.studioProject.findFirst({ where: { id: projectId, workspaceId }, select: this.projectSelect }); if (!project) throw new NotFoundException("Studio project was not found"); return project; }
  private async audit(tx: Prisma.TransactionClient, workspaceId: string, actorId: string, action: string, projectId: string, before: unknown, after: unknown) { await tx.auditLog.create({ data: { workspaceId, userId: actorId, action, entityType: "StudioProject", entityId: projectId, oldValues: before as Prisma.InputJsonValue, newValues: after as Prisma.InputJsonValue } }); }
}
