import { Injectable } from "@nestjs/common";
import { StudioProjectRepository } from "./studio-project.repository";
@Injectable()
export class StudioProjectService {
  constructor(private readonly repository: StudioProjectRepository) {}
  create(workspaceId: string, actorId: string, dto: { name: string; slug: string; description?: string; draft?: Record<string, unknown> }) { return this.repository.createProject({ workspaceId, actorId, ...dto }); }
  updateDraft(workspaceId: string, actorId: string, projectId: string, dto: { name?: string; description?: string; draft: Record<string, unknown> }) { return this.repository.updateDraft({ workspaceId, actorId, projectId, ...dto }); }
  publish(workspaceId: string, actorId: string, projectId: string, changeSummary?: string) { return this.repository.publishProject({ workspaceId, actorId, projectId, changeSummary }); }
  rollback(workspaceId: string, actorId: string, projectId: string, revision: number, changeSummary?: string) { return this.repository.rollbackProject({ workspaceId, actorId, projectId, revision, changeSummary }); }
  archive(workspaceId: string, actorId: string, projectId: string) { return this.repository.archiveProject(workspaceId, actorId, projectId); }
  list(workspaceId: string) { return this.repository.listProjects(workspaceId); }
  get(workspaceId: string, projectId: string) { return this.repository.getProject(workspaceId, projectId); }
  history(workspaceId: string, projectId: string) { return this.repository.getRevisionHistory(workspaceId, projectId); }
}
