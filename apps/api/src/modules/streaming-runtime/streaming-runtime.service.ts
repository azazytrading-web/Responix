import { Injectable } from "@nestjs/common";
import { ReplaySubject } from "rxjs";
import { StreamSessionStatus } from "@prisma/client";
import type {
  CancelStreamSessionDto, CreateStreamSessionDto, StreamSessionListQueryDto
} from "./dto/streaming-runtime.dto";
import { StreamingRuntimeRepository } from "./streaming-runtime.repository";
import type {
  StreamingChunkInput, StreamingCompletion
} from "./streaming-runtime.types";

export interface RuntimeStreamEvent {
  id: string;
  event: string;
  data: unknown;
}

@Injectable()
export class StreamingRuntimeService {
  private readonly events = new Map<string, ReplaySubject<RuntimeStreamEvent>>();

  constructor(private readonly repository: StreamingRuntimeRepository) {}

  async create(workspaceId: string, actorId: string, dto: CreateStreamSessionDto) {
    const session = await this.repository.create(workspaceId, actorId, dto);
    this.events.set(session.id, new ReplaySubject<RuntimeStreamEvent>(256));
    this.emit(session.id, "started", session, String(session.stateVersion));
    return session;
  }

  connect(workspaceId: string, actorId: string, id: string, expectedVersion: number) {
    return this.transition(workspaceId, actorId, id, "CONNECTING", expectedVersion);
  }

  start(workspaceId: string, actorId: string, id: string, expectedVersion: number) {
    return this.transition(workspaceId, actorId, id, "STREAMING", expectedVersion);
  }

  async append(
    workspaceId: string, actorId: string, id: string, input: StreamingChunkInput
  ) {
    const chunk = await this.repository.appendChunk(workspaceId, actorId, id, input);
    this.emit(id, "chunk", chunk, String(chunk.sequence));
    return chunk;
  }

  async complete(
    workspaceId: string, actorId: string, id: string, expectedVersion: number,
    completion: StreamingCompletion
  ) {
    const value = await this.repository.complete(
      workspaceId, actorId, id, expectedVersion, completion
    );
    this.close(id, "completed", value);
    return value;
  }

  async cancel(
    workspaceId: string, actorId: string, id: string, dto: CancelStreamSessionDto
  ) {
    const session = await this.repository.get(workspaceId, id);
    if (this.terminal(session.status)) return session;
    const value = await this.repository.transition(
      workspaceId, actorId, id, "CANCELLED", session.stateVersion,
      { code: "CANCELLATION", message: dto.reason ?? "Stream cancelled" }
    );
    this.close(id, "cancelled", value);
    return value;
  }

  async fail(
    workspaceId: string, actorId: string, id: string, expectedVersion: number,
    code: string, message: string, timedOut = false
  ) {
    const value = await this.transition(
      workspaceId, actorId, id, timedOut ? "TIMED_OUT" : "FAILED",
      expectedVersion, { code, message }
    );
    this.close(id, timedOut ? "timeout" : "failed", value);
    return value;
  }

  get(workspaceId: string, id: string) {
    return this.repository.get(workspaceId, id);
  }
  list(workspaceId: string, query: StreamSessionListQueryDto) {
    return this.repository.list(workspaceId, query);
  }
  diagnostics(workspaceId: string, id: string) {
    return this.repository.diagnostics(workspaceId, id);
  }
  metrics(workspaceId: string, id: string) {
    return this.repository.metrics(workspaceId, id);
  }
  chunks(workspaceId: string, id: string) {
    return this.repository.chunks(workspaceId, id);
  }
  compare(workspaceId: string, leftId: string, rightId: string) {
    return this.repository.compare(workspaceId, leftId, rightId);
  }

  observe(id: string) {
    let subject = this.events.get(id);
    if (!subject) {
      subject = new ReplaySubject<RuntimeStreamEvent>(256);
      this.events.set(id, subject);
    }
    return subject.asObservable();
  }

  private async transition(
    workspaceId: string, actorId: string, id: string, to: StreamSessionStatus,
    expectedVersion: number, diagnostic?: { code: string; message: string }
  ) {
    const value = await this.repository.transition(
      workspaceId, actorId, id, to, expectedVersion, diagnostic
    );
    this.emit(id, "state", value, String(value.stateVersion));
    return value;
  }

  private emit(id: string, event: string, data: unknown, eventId: string) {
    this.events.get(id)?.next({ id: eventId, event, data });
  }

  private close(id: string, event: string, data: unknown) {
    const subject = this.events.get(id);
    subject?.next({ id: "final", event, data });
    subject?.complete();
  }

  private terminal(status: StreamSessionStatus) {
    return status === "COMPLETED" || status === "CANCELLED" ||
      status === "FAILED" || status === "TIMED_OUT";
  }
}
